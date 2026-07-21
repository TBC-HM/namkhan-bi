// app/api/marketing/director/generate-plan/route.ts
// PBS 2026-07-22 (Newsletter Engine v2): AI Editorial Director — 12-month plan generator.
//
// POST body:
//   { property_id: number,
//     start_date: 'YYYY-MM-DD', end_date: 'YYYY-MM-DD',
//     goals?: string[] | null,           // optional override; default = director_goals table
//     audience_types?: ('b2c'|'b2b')[],  // default ['b2c']
//     named_locks?: { date: string, title: string, goal: string }[],
//     regenerate_empty_only?: boolean,   // default false — if true, only fill dates without a slot
//     slot_count?: number,               // default 22 (approx one every 8 days over 5 months)
//     lifecycle_ok?: boolean             // reserved, currently ignored (lifecycles run auto)
//   }
//
// Returns: { ok, summary: { slots_created, per_goal, per_month }, plan: [ ... ] }

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 90;

const MODEL = 'claude-sonnet-4-6';
const DEFAULT_PROPERTY_ID = 260955;

interface GenBody {
  property_id?: number;
  start_date?: string;
  end_date?: string;
  goals?: string[] | null;
  audience_types?: ('b2c'|'b2b')[];
  named_locks?: { date: string; title: string; goal: string }[];
  regenerate_empty_only?: boolean;
  slot_count?: number;
}

interface AiSlot {
  slot_date: string;
  audience_type: 'b2c' | 'b2b';
  campaign_kind?: 'broadcast'|'lifecycle';
  goal_tag: string;
  title: string;
  subject?: string;
  body_md?: string;
  ctas?: unknown[];
  target_segments?: string[];
  ai_notes?: string;
}

async function loadGoals(sb: ReturnType<typeof getSupabaseAdmin>, pid: number) {
  const r = await sb.from('v_director_goals').select('*').eq('property_id', pid).eq('active', true).order('weight', { ascending: false });
  return (r.data as Array<{ goal_key: string; goal_label: string; weight: number }> | null) ?? [];
}
async function loadExistingSlots(sb: ReturnType<typeof getSupabaseAdmin>, pid: number, from: string, to: string) {
  const r = await sb.from('v_director_calendar').select('id, slot_date, goal_tag, status').eq('property_id', pid).gte('slot_date', from).lte('slot_date', to);
  return (r.data as Array<{ id: number; slot_date: string; goal_tag: string; status: string }> | null) ?? [];
}
async function loadRules(sb: ReturnType<typeof getSupabaseAdmin>, pid: number) {
  const r = await sb.from('v_marketing_email_general_rules').select('rule_kind, rule_text').or(`property_id.eq.${pid},property_id.is.null`);
  return (r.data as Array<{ rule_kind: string; rule_text: string }> | null) ?? [];
}
async function loadPropertyBackground(sb: ReturnType<typeof getSupabaseAdmin>, pid: number) {
  const [t, s, f, a] = await Promise.all([
    sb.from('v_transport_options').select('name, transport_type').eq('property_id', pid).eq('is_active', true).limit(10),
    sb.from('v_property_spa_treatments').select('name, is_signature').eq('property_id', pid).eq('is_active', true).limit(20),
    sb.from('v_property_fnb_menu_items').select('name, section, is_signature').eq('property_id', pid).eq('is_active', true).limit(30),
    sb.from('v_activities_catalog').select('name, category').eq('property_id', pid).eq('is_active', true).limit(20),
  ]);
  return {
    transport: (t.data as Array<{ name: string; transport_type: string | null }> | null) ?? [],
    spa: (s.data as Array<{ name: string; is_signature: boolean | null }> | null) ?? [],
    fnb: (f.data as Array<{ name: string; section: string | null; is_signature: boolean | null }> | null) ?? [],
    activities: (a.data as Array<{ name: string; category: string | null }> | null) ?? [],
  };
}

async function loadSubscriberCounts(sb: ReturnType<typeof getSupabaseAdmin>) {
  try {
    const r = await sb.from('v_marketing_subscribers').select('id', { count: 'exact', head: true });
    return { newsletter_active: r.count ?? 0 };
  } catch { return { newsletter_active: 0 }; }
}

async function callClaude(prompt: string, maxTokens = 8000): Promise<unknown> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) throw new Error('ANTHROPIC_API_KEY not configured');
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({
      model: MODEL, max_tokens: maxTokens,
      messages: [{ role: 'user', content: prompt }],
    }),
  });
  if (!res.ok) throw new Error(`anthropic ${res.status}: ${await res.text()}`);
  const j = await res.json();
  const text: string = j?.content?.[0]?.text ?? '';
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start < 0 || end < 0) throw new Error('no json in claude response');
  return JSON.parse(text.slice(start, end + 1));
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as GenBody;
    const pid = body.property_id ?? DEFAULT_PROPERTY_ID;
    const from = body.start_date;
    const to   = body.end_date;
    if (!from || !to) return NextResponse.json({ error: 'start_date and end_date required' }, { status: 400 });

    const audiences = body.audience_types && body.audience_types.length ? body.audience_types : ['b2c'] as const;
    const namedLocks = body.named_locks ?? [];
    const regenEmpty = body.regenerate_empty_only ?? false;
    const targetCount = Math.max(5, Math.min(60, body.slot_count ?? 22));

    const sb = getSupabaseAdmin();
    const [goals, existing, rules, bg, subCounts] = await Promise.all([
      loadGoals(sb, pid),
      loadExistingSlots(sb, pid, from, to),
      loadRules(sb, pid),
      loadPropertyBackground(sb, pid),
      loadSubscriberCounts(sb),
    ]);

    if (regenEmpty && existing.length >= targetCount) {
      return NextResponse.json({ ok: true, summary: { slots_created: 0, per_goal: {}, per_month: {}, note: 'nothing to fill' }, plan: [] });
    }

    const existingDates = new Set(existing.map(x => x.slot_date));
    const activeGoals = (body.goals && body.goals.length ? goals.filter(g => body.goals!.includes(g.goal_key)) : goals);
    const totalWeight = activeGoals.reduce((s, g) => s + g.weight, 0) || 1;
    const perGoalTarget: Record<string, number> = {};
    for (const g of activeGoals) perGoalTarget[g.goal_key] = Math.max(1, Math.round((g.weight / totalWeight) * targetCount));

    // cadence hints — the AI decides exact dates within these guardrails
    const cadence = [
      'B2C prospects: max 2 broadcasts/month, min 5 days apart',
      'B2C guests-insider: max 1/month (do not double-hit with prospects unless topic is truly universal)',
      'B2B: max 1/quarter — keep VERY selective; only when there is real news',
      'Christmas + NYE anchors are locked — do not schedule other broadcasts within 5 days of them',
      'Lifecycle emails (anticipation, gratitude, birthday, winback) run auto — DO NOT plan those here',
    ].join('\n');

    const goalsBlock = activeGoals.map(g => `- ${g.goal_key} (weight ${g.weight}) — ${g.goal_label} — target ~${perGoalTarget[g.goal_key]} slots`).join('\n');
    const locksBlock = namedLocks.length ? namedLocks.map(l => `- ${l.date} · ${l.title} · goal=${l.goal}`).join('\n') : '(none)';
    const existingBlock = existing.length
      ? existing.slice(0, 40).map(e => `- ${e.slot_date} · ${e.goal_tag} · ${e.status}`).join('\n') + (existing.length > 40 ? `\n... (+${existing.length - 40} more)` : '')
      : '(none)';

    const bgBlock = [
      `Retreats/Wellness/Roots restaurant/Eco-farm are the highest-value stories.`,
      `Signature spa treatments: ${bg.spa.filter(x=>x.is_signature).map(x=>x.name).join(', ') || 'n/a'}`,
      `Signature F&B: ${bg.fnb.filter(x=>x.is_signature).map(x=>x.name).join(', ') || 'n/a'}`,
      `Activities: ${bg.activities.map(x=>x.name).slice(0,8).join(', ')}`,
      `Transport touchpoints: ${bg.transport.map(x=>x.name).slice(0,4).join(', ')}`,
      `Active newsletter list size: ${subCounts.newsletter_active}`,
    ].join('\n');

    const rulesBlock = rules.length ? rules.map(r => `[${r.rule_kind}] ${r.rule_text}`).join('\n') : '(no explicit rules)';

    const prompt = `You are the AI Editorial Director for The Namkhan, a boutique eco-retreat in Laos. Plan the next block of BROADCAST newsletters (${audiences.join('+')}) between ${from} and ${to}.

TARGET TOTAL SLOTS: ${targetCount}
REGENERATE MODE: ${regenEmpty ? 'ONLY suggest slot_dates NOT in the existing list' : 'You may propose new dates alongside existing (dedup by date+goal is enforced downstream)'}

EDITORIAL GOALS (weight = target slot share):
${goalsBlock}

CADENCE RULES (must obey):
${cadence}

NAMED LOCKS (must include verbatim as slots on these dates):
${locksBlock}

EXISTING SLOTS IN RANGE (do NOT duplicate these dates):
${existingBlock}

PROPERTY BACKGROUND:
${bgBlock}

GENERAL EMAIL RULES:
${rulesBlock}

Now propose the plan. Return ONLY valid JSON in this exact shape:
{
  "plan": [
    {
      "slot_date": "YYYY-MM-DD",
      "audience_type": "b2c",
      "campaign_kind": "broadcast",
      "goal_tag": "one of the goal_keys above",
      "title": "40-70 char editorial title, no clickbait",
      "subject": "email subject line, unhurried voice, 50-70 chars",
      "body_md": "2-4 short paragraphs of markdown, weave in ≥1 real product name from the property background, no fake discounts, no 'Book now' shouting",
      "ai_notes": "1-sentence reason this slot is here"
    }
  ]
}

Rules:
- goal_tag MUST be one of: ${activeGoals.map(g=>g.goal_key).join(', ')}
- Distribute slots proportional to goal weights.
- Space b2c broadcasts by ≥5 days.
- Include EVERY named lock verbatim.
- No 'discount' language; use 'complimentary', 'included', 'thoughtful pricing'.
- Prefer signature items (spa Sabai package, Roots signature dishes) when goal permits.
- Return exactly ${targetCount} slots (± 2 tolerance).`;

    const raw = await callClaude(prompt);
    const plan = ((raw as { plan?: AiSlot[] }).plan ?? []).filter(s => s && s.slot_date && s.title && s.goal_tag);

    // Persist via RPC (upsert on unique (property_id, slot_date, audience_type, goal_tag))
    let created = 0;
    const perGoal: Record<string, number> = {};
    const perMonth: Record<string, number> = {};
    const persistedPlan: Array<{ slot_date: string; title: string; goal_tag: string; audience_type: string; id: number | null }> = [];

    for (const s of plan) {
      if (regenEmpty && existingDates.has(s.slot_date)) continue;
      const audience = (s.audience_type === 'b2b' ? 'b2b' : 'b2c');
      const kind = (s.campaign_kind === 'lifecycle' ? 'lifecycle' : 'broadcast');
      const { data, error } = await sb.rpc('fn_director_slot_upsert', {
        p_property_id: pid,
        p_slot_date: s.slot_date,
        p_audience_type: audience,
        p_campaign_kind: kind,
        p_goal_tag: s.goal_tag,
        p_title: s.title,
        p_subject: s.subject ?? s.title,
        p_body_md: s.body_md ?? null,
        p_hero_asset_id: null,
        p_ctas: (s.ctas ?? []) as unknown as object,
        p_target_segments: (s.target_segments ?? []) as unknown as string[],
        p_status: 'proposed',
        p_ai_notes: s.ai_notes ?? null,
      });
      if (error) continue;
      created++;
      perGoal[s.goal_tag] = (perGoal[s.goal_tag] ?? 0) + 1;
      const mk = s.slot_date.slice(0, 7);
      perMonth[mk] = (perMonth[mk] ?? 0) + 1;
      persistedPlan.push({ slot_date: s.slot_date, title: s.title, goal_tag: s.goal_tag, audience_type: audience, id: (data as number | null) ?? null });
    }

    return NextResponse.json({
      ok: true,
      summary: { slots_created: created, per_goal: perGoal, per_month: perMonth, target: targetCount, model: MODEL },
      plan: persistedPlan,
    });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
