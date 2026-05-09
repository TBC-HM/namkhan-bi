// app/api/canvas/ask/route.ts
// 2026-05-09 — single canvas. PBS asks a question; agent returns a Brief
// (signal + good/bad containers + proposal cards). Each proposal lands
// in cockpit_proposals with status='proposal' and auto-runs only if the
// agent_trust pair is unlocked.
//
// 2026-05-09 (later) — generic Anthropic-driven brief for non-BAR
// questions. The BAR-ladder long-weekend loop stays seeded; everything
// else routes to Sonnet with the design-system manifesto + recent ticket
// context as system prompt. Sonnet returns JSON conforming to BriefPayload;
// proposals seed into cockpit_proposals exactly like seeded ones.

import { NextResponse } from "next/server";
import { unstable_noStore as noStore } from "next/cache";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const maxDuration = 90;
export const dynamic = "force-dynamic";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "https://build-placeholder.supabase.co",
  process.env.SUPABASE_SERVICE_ROLE_KEY || "build-placeholder-key"
);

interface BriefPayload {
  signal: string;
  body: string;
  good: string[];
  bad: string[];
  proposals: {
    agent_role: string;
    action_type: string;
    dept: string;
    signal: string;
    body: string;
    action_payload: Record<string, unknown>;
  }[];
}

// ─── seeded briefs (will be replaced by Anthropic streaming) ─────────────

function seedBARLadderBrief(): BriefPayload {
  return {
    signal: 'Long-weekend (May 17–19) — demand +20% vs LY, BAR ladder under-priced 12% vs comp set',
    body: 'Three signals converge: pace is +18% on the 17th, comp set raised median rate $24 yesterday, BDC lead-time bucket 0–7d is filling 22% faster than STLY. The window to push rate without losing volume is now.',
    good: [
      'Premium room type sold out 17th — pricing power',
      'Direct share at 32% on long-weekend dates (above 30% target)',
      'Comp set already moved — we can match without leading',
    ],
    bad: [
      'BAR Premium $215 vs comp $245 — leaving ~$30/RN on the table',
      'BDC promo still active for those nights — 18% commission on each',
    ],
    proposals: [
      {
        agent_role: 'revenue_hod',
        action_type: 'bar_adjust',
        dept: 'revenue',
        signal: 'Raise BAR Premium +$15 for May 17–19',
        body: 'Lift BAR Premium $215 → $230 for the long-weekend window (17–19 May). Holds direct ADR competitive while still $15 below comp median. Apply via Cloudbeds rate plan = BAR.',
        action_payload: {
          rate_plan: 'BAR',
          room_type: 'Premium',
          adjustment_usd: 15,
          start_date: '2026-05-17',
          end_date: '2026-05-19',
        },
      },
      {
        agent_role: 'marketing_hod',
        action_type: 'send_direct_email',
        dept: 'marketing',
        signal: 'Send long-weekend promo to past direct guests',
        body: 'Compose a 3-line email + hero image to last 90 days direct bookers (audience: returning, no-OTA-source) offering 1 complimentary spa session for 2-night stays on the 17–19. Aim: protect direct share while rate climbs.',
        action_payload: {
          audience: 'past_direct_90d',
          stay_window: { from: '2026-05-17', to: '2026-05-19' },
          incentive: '1 spa session per 2nt',
          channel: 'email',
        },
      },
      {
        agent_role: 'revenue_hod',
        action_type: 'pause_ota_promo',
        dept: 'revenue',
        signal: 'Pause BDC promo for May 17–19',
        body: 'Disable the existing 12% Booking.com promo for the 17–19 stay window. Net commission saving ~$1.2k on expected RN. Re-enable for off-peak after the 20th.',
        action_payload: {
          channel: 'booking.com',
          promo_id: 'long_weekend_apr',
          paused_window: { from: '2026-05-17', to: '2026-05-19' },
        },
      },
    ],
  };
}

function fallbackGenericBrief(question: string): BriefPayload {
  return {
    signal: 'Generic brief — fallback (Anthropic call failed or key missing)',
    body: `You asked: "${question}". The pipeline is wired but the live brief generator returned no result. The BAR-ladder long-weekend loop is still available by asking about "BAR" or "rate ladder".`,
    good: ['Pipeline operational', 'Trust counter active', 'Approval gates locked'],
    bad: ['Live agent fallback path', 'No proposals generated for this question'],
    proposals: [],
  };
}

const SONNET = 'claude-sonnet-4-6';

// Knowledge base — `cockpit_knowledge_base` columns are (topic, key_fact, scope, ...).
// We pull manifesto + a question-keyword sample of all-other-scopes.

async function fetchManifesto(): Promise<string> {
  const { data } = await supabase
    .from('cockpit_knowledge_base')
    .select('topic, key_fact')
    .eq('scope', 'design_system_manifesto')
    .eq('active', true);
  if (!data || data.length === 0) return '';
  return data.map(r => `### ${r.topic}\n${r.key_fact}`).join('\n\n');
}

/**
 * Pull up to 12 KB rows whose `topic` or `key_fact` matches any keyword from
 * the question. Quick lexical match — embedding search is the upgrade path
 * once cockpit_knowledge_base.embedding is populated for every row.
 */
async function fetchRelevantKb(question: string): Promise<string> {
  const tokens = Array.from(new Set(
    question.toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter(t => t.length >= 4)
  )).slice(0, 8);
  if (tokens.length === 0) return '';

  const orFilter = tokens
    .flatMap(t => [`topic.ilike.%${t}%`, `key_fact.ilike.%${t}%`])
    .join(',');

  const { data } = await supabase
    .from('cockpit_knowledge_base')
    .select('scope, topic, key_fact, confidence')
    .neq('scope', 'design_system_manifesto')
    .eq('active', true)
    .or(orFilter)
    .order('updated_at', { ascending: false })
    .limit(12);
  if (!data || data.length === 0) return '';
  return data.map(r => `- [${r.scope} · ${r.confidence ?? '?'}] **${r.topic}** — ${r.key_fact}`).join('\n');
}

async function fetchAgentRoster(): Promise<string> {
  // governance.agents is exposed via supabase. Pull active agents only.
  const { data } = await supabase
    .schema('governance')
    .from('agents')
    .select('code, name, status, pillar, schedule_human, description')
    .in('status', ['active', 'beta'])
    .order('pillar')
    .order('name')
    .limit(60);
  if (!data || data.length === 0) return '';
  return data.map(r => `- ${r.code} (${r.pillar ?? '—'}) · ${r.status} · ${r.name}${r.description ? ` — ${r.description}` : ''}`).join('\n');
}

async function fetchRecentTicketContext(): Promise<string> {
  const { data } = await supabase
    .from('cockpit_tickets')
    .select('subject, status')
    .order('created_at', { ascending: false })
    .limit(8);
  if (!data || data.length === 0) return '';
  return data.map(r => `- [${r.status}] ${r.subject}`).join('\n');
}

async function generateBriefViaAnthropic(question: string): Promise<BriefPayload | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;

  const [manifesto, kb, agents, tickets] = await Promise.all([
    fetchManifesto(),
    fetchRelevantKb(question),
    fetchAgentRoster(),
    fetchRecentTicketContext(),
  ]);

  const system = `You are Vector, the Namkhan canvas agent. PBS (operator) asks a question; you return ONE Brief in strict JSON.

# Output schema (return JSON ONLY, no prose, no markdown fences):
{
  "signal":  string,             // 1 line, the headline answer
  "body":    string,             // 2–4 sentences explaining the signal
  "good":    string[],           // 1–4 bullets, each <= 110 chars, opportunity / strength
  "bad":     string[],           // 1–4 bullets, each <= 110 chars, leakage / risk
  "proposals": [                 // 0–3 entries; each becomes a row in cockpit_proposals
    {
      "agent_role":   string,    // pick from the AI team roster below; never invent agent codes
      "action_type":  string,    // short_snake_case verb e.g. bar_adjust, send_direct_email, audit_pl
      "dept":         string,    // revenue | sales | marketing | operations | guest | finance | it
      "signal":       string,    // 1-line title of the proposal card
      "body":         string,    // 1-3 sentences body
      "action_payload": object   // structured params the executor would use
    }
  ]
}

# Hotel context
- Property: The Namkhan, boutique 12-room hotel, Luang Prabang, Laos. SLH-affiliated.
- PMS: Cloudbeds (sole revenue source). Currency: $ (USD reporting), ₭ (LAK base).
- Hard rules: never invent data, never bypass Cloudbeds, never reduce direct-booking growth.

# Design manifesto (binding)
${manifesto || '[manifesto unavailable]'}

# AI team roster (governance.agents · active + beta)
Use these codes verbatim for proposal.agent_role. If no agent fits, pick the best HoD (revenue_hod, sales_hod, marketing_hod, ops_hod, guest_hod, finance_hod, it_hod).
${agents || '[no agents registered]'}

# Knowledge base — entries matching the question
${kb || '[no matching KB rows]'}

# Recent tickets (context only, do not echo)
${tickets || '[none]'}`;

  const user = `Question:\n${question}\n\nReturn the Brief JSON only.`;

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: SONNET,
      max_tokens: 1400,
      system,
      messages: [{ role: 'user', content: user }],
    }),
  });
  if (!res.ok) {
    console.error('canvas/ask anthropic error', res.status, await res.text().catch(() => ''));
    return null;
  }
  const json = await res.json().catch(() => null) as { content?: { text?: string }[] } | null;
  const text = json?.content?.[0]?.text?.trim();
  if (!text) return null;

  // Sonnet sometimes wraps in ```json fences; strip if present.
  const stripped = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
  try {
    const parsed = JSON.parse(stripped) as Partial<BriefPayload>;
    if (!parsed.signal || !parsed.body || !Array.isArray(parsed.good) || !Array.isArray(parsed.bad)) return null;
    return {
      signal:    String(parsed.signal),
      body:      String(parsed.body),
      good:      parsed.good.map(String),
      bad:       parsed.bad.map(String),
      proposals: Array.isArray(parsed.proposals) ? parsed.proposals as BriefPayload['proposals'] : [],
    };
  } catch (e) {
    console.error('canvas/ask json parse failed', e, 'text:', stripped.slice(0, 200));
    return null;
  }
}

async function chooseBrief(question: string): Promise<BriefPayload> {
  const q = question.toLowerCase();
  if (q.includes('bar') || q.includes('long weekend') || q.includes('rate') || q.includes('long-weekend') || q.includes('ladder')) {
    return seedBARLadderBrief();
  }
  const live = await generateBriefViaAnthropic(question);
  if (live) return live;
  return fallbackGenericBrief(question);
}

// ─── trust check ────────────────────────────────────────────────────────

async function isUnlocked(agent_role: string, action_type: string): Promise<boolean> {
  const { data } = await supabase
    .from('agent_trust')
    .select('auto_unlocked')
    .eq('agent_role', agent_role)
    .eq('action_type', action_type)
    .maybeSingle();
  return !!data?.auto_unlocked;
}

// ─── handler ────────────────────────────────────────────────────────────

export async function POST(req: Request) {
  noStore();
  const body = await req.json().catch(() => ({}));
  const question = String(body.question ?? '').trim();
  if (!question) return NextResponse.json({ error: 'question required' }, { status: 400 });

  const brief = await chooseBrief(question);

  // Insert proposals — each gets requires_approval based on trust state.
  const inserted: Array<Record<string, unknown>> = [];
  for (const p of brief.proposals) {
    const unlocked = await isUnlocked(p.agent_role, p.action_type);
    const { data } = await supabase
      .from('cockpit_proposals')
      .insert({
        agent_role: p.agent_role,
        action_type: p.action_type,
        dept: p.dept,
        signal: p.signal,
        body: p.body,
        action_payload: p.action_payload,
        requires_approval: !unlocked,
        status: unlocked ? 'in_process' : 'proposal',
        started_at: unlocked ? new Date().toISOString() : null,
      })
      .select()
      .single();
    if (data) inserted.push(data);
  }

  await supabase.from('cockpit_audit_log').insert({
    agent: 'canvas',
    action: 'ask',
    target: `q:${question.slice(0, 80)}`,
    success: true,
    metadata: { proposals_seeded: inserted.length, question },
    reasoning: brief.signal,
  });

  return NextResponse.json({
    brief: {
      signal: brief.signal,
      body:   brief.body,
      good:   brief.good,
      bad:    brief.bad,
    },
    proposals: inserted,
  });
}
