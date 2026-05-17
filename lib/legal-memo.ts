// lib/legal-memo.ts
// Canonical 5th-Avenue corporate-law-firm memorandum format used by all
// legal-department analytical skills (Toga, Vera, Sherlock).
//
// Every memo follows the same skeleton so downstream readers (CEOs, CFOs,
// counterparty counsel) get a recognisable, professional artefact:
//
//   MEMORANDUM
//   PRIVILEGED & CONFIDENTIAL · ATTORNEY WORK PRODUCT
//   TO | FROM | DATE | RE
//   I.   EXECUTIVE SUMMARY (≤ 4 lines)
//   II.  PARTIES & SCOPE
//   III. KEY ECONOMIC TERMS
//   IV.  MATERIAL OBLIGATIONS
//   V.   RISK ANALYSIS
//   VI.  RECOMMENDED ACTIONS
//   VII. AUTHORITIES & CLAUSE CITES
//
// Each skill returns markdown that renders directly in the chat surface
// and in any downstream report builder. No emojis. No flourish. Roman
// numerals, all-caps headers, monospace cite blocks. Voice = senior
// corporate associate writing for a managing partner who has 90 seconds.

import { createClient } from '@supabase/supabase-js';

export const SUPABASE = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://build-placeholder.supabase.co',
  process.env.SUPABASE_SERVICE_ROLE_KEY || 'build-placeholder-key',
);

export const ANTHROPIC_MODEL = 'claude-sonnet-4-6';

export const MEMO_HOUSE_STYLE = `
HOUSE STYLE — THE BEYOND CIRCLE LEGAL DEPARTMENT
================================================
Voice: senior corporate associate at a 5th-Avenue firm writing to a managing
partner who has 90 seconds. Crisp. Declarative. No hedging beyond what
the facts demand. No filler ("It is worth noting that..."). No emojis.

Formatting (mandatory):
  • Top block: MEMORANDUM heading, then PRIVILEGED & CONFIDENTIAL ·
    ATTORNEY WORK PRODUCT line, then a four-line TO / FROM / DATE / RE block.
  • Section numbering: Roman numerals I, II, III ... with ALL-CAPS titles.
  • Sub-points: lettered (a), (b), (c) — never bullets at top level.
  • Cite contract clauses inline as [Cl. §X.Y] or [Cl. Art. N] with the
    most-significant excerpts in monospace blockquote.
  • Money: always include currency. Use € / $ / ₭ symbols, not codes.
  • Dates: ISO 8601 (YYYY-MM-DD).
  • If the agent has insufficient data on a sub-point, write the section
    header followed by: "[Insufficient data — request: <specific items>]".
    NEVER fabricate a number.

Tone discipline:
  • Lead with the conclusion. Reasoning second.
  • No first person. Use "the Company" / "the Counterparty" / "counsel".
  • When recommending action, use imperative voice: "Renegotiate §7.2..."
    not "We could perhaps consider renegotiating...".
  • Risk colour-coding (when applicable): RED (material), YELLOW (elevated),
    GREEN (standard) — written inline, not as emojis.

End of every memo:
  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Prepared by <agent display name>  ·  <YYYY-MM-DD>
  The Beyond Circle · Legal Department
  Source document: <doc title> (doc_id: <uuid>)
`.trim();

export const MEMO_SKELETON_DEFAULT = `
MEMORANDUM
PRIVILEGED & CONFIDENTIAL · ATTORNEY WORK PRODUCT

TO:    {{audience}}
FROM:  {{from_agent}}, Legal Department · The Beyond Circle
DATE:  {{today}}
RE:    {{subject}}

────────────────────────────────────────────────────────

I.   EXECUTIVE SUMMARY
{{exec_summary_3_lines_max}}

II.  PARTIES & SCOPE
     (a) Counterparty: {{counterparty}}
     (b) Effective date / term: {{term}}
     (c) Governing law / venue: {{governing_law}}

III. KEY ECONOMIC TERMS
{{economic_terms_table_or_list}}

IV.  MATERIAL OBLIGATIONS
     (a) The Company's obligations: {{company_obligations}}
     (b) Counterparty's obligations: {{counterparty_obligations}}
     (c) Conditional / contingent obligations: {{contingent_obligations}}

V.   RISK ANALYSIS
{{risk_analysis_traffic_light}}

VI.  RECOMMENDED ACTIONS
{{recommended_actions_imperative_ranked}}

VII. AUTHORITIES & CLAUSE CITES
{{clause_excerpts_with_paragraph_numbers}}

────────────────────────────────────────────────────────
Prepared by {{from_agent}}  ·  {{today}}
The Beyond Circle · Legal Department
Source document: {{doc_title}} (doc_id: {{doc_id}})
`.trim();

// 'carla' is the canonical key for the holding legal lead (Toga is the
// legacy display name — kept as an accepted input for back-compat).
export type LegalAgentPersona = 'carla' | 'toga' | 'vera' | 'sherlock' | 'auto';

export function personaSignature(p: LegalAgentPersona): { displayName: string; role: string } {
  switch (p) {
    case 'carla':    return { displayName: 'Carla',    role: 'legal_specialist_donna' };
    case 'toga':     return { displayName: 'Carla',    role: 'legal_specialist_donna' }; // legacy alias
    case 'vera':     return { displayName: 'Vera',     role: 'legal_local_donna'      };
    case 'sherlock': return { displayName: 'Sherlock', role: 'forensic_detective'     };
    default:         return { displayName: 'Legal Department', role: 'legal' };
  }
}

export async function fetchDocBody(doc_id: string): Promise<{
  title: string;
  body: string;
  doc_type: string | null;
  language: string | null;
  source: string | null;
} | null> {
  const { data, error } = await SUPABASE.rpc('skill_get_document_content', {
    p_doc_id: doc_id,
    p_max_chars: 200000,
    p_offset: 0,
  });
  if (error || !data || !data[0]) return null;
  const row = data[0] as Record<string, unknown>;
  return {
    title:    (row.title as string) || '(untitled)',
    body:     (row.content_chunk as string) || '',
    doc_type: (row.doc_type as string) || null,
    language: (row.language as string) || null,
    source:   null,
  };
}

export type LlmOk = { ok: true; text: string; usage: { in: number; out: number } };
export type LlmErr = { ok: false; error: string };
export type LlmResult = LlmOk | LlmErr;

export function isLlmOk(r: LlmResult): r is LlmOk { return r.ok === true; }

export async function callAnthropic(args: {
  systemPrompt: string;
  userPrompt: string;
  maxTokens?: number;
}): Promise<LlmResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return { ok: false, error: 'ANTHROPIC_API_KEY not set' };

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: ANTHROPIC_MODEL,
      max_tokens: args.maxTokens ?? 4096,
      system: args.systemPrompt,
      messages: [{ role: 'user', content: args.userPrompt }],
    }),
  });
  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    return { ok: false, error: `anthropic ${res.status}: ${errText.slice(0, 240)}` };
  }
  const j = (await res.json()) as {
    content?: Array<{ type: string; text?: string }>;
    usage?: { input_tokens?: number; output_tokens?: number };
  };
  const text = (j.content || []).map((c) => (c.type === 'text' ? c.text : '')).join('').trim();
  return {
    ok: true,
    text,
    usage: {
      in: j.usage?.input_tokens ?? 0,
      out: j.usage?.output_tokens ?? 0,
    },
  };
}

export async function logSkillRun(args: {
  skill: string;
  agent_role: string;
  doc_id: string | null;
  ok: boolean;
  cost_usd_milli?: number;
  notes?: string;
}): Promise<void> {
  try {
    await SUPABASE.from('cockpit_audit_log').insert({
      agent: args.agent_role || 'legal-skill',
      action: args.skill,
      target: args.doc_id ? `dms.documents:${args.doc_id}` : null,
      success: args.ok,
      metadata: {
        skill: args.skill,
        cost_usd_milli: args.cost_usd_milli ?? null,
      },
      reasoning: args.notes ?? null,
    });
  } catch {
    // audit failure must never block the skill response
  }
}

// ─── Standing rule (locked 2026-05-14, PBS direct) ──────────────────────
// Every document an agent produces lands in the requesting HoD's inbox
// (cockpit_tickets, arm='agent_delivery') in addition to its primary
// destination (dms.documents / cockpit_audit_log). This applies to ALL
// departments — legal memos, marketing briefs, revenue analyses, etc.
//
// The producing skill is responsible for delivering. The receiving HoD
// reads the artefact in their property-scoped inbox at:
//   /h/<property_id>/inbox
//
// If `requested_by_role` is omitted, the delivery step is skipped and
// the artefact lives only in the audit log + DMS row.
export async function deliverMemoToHod(args: {
  memo_md: string;
  memo_type: string;             // "Contract Summary" / "Risk Assessment" / etc.
  doc_title: string;
  source_doc_id: string | null;
  property_id: number | null;
  prepared_by: string;           // "Toga" / "Vera" / "Sherlock"
  requested_by_role?: string;    // HoD slug, e.g. "finance_hod_donna"
  case_ref?: string;
}): Promise<{ delivered: boolean; ticket_id: number | null }> {
  if (!args.requested_by_role) return { delivered: false, ticket_id: null };

  const subject = `[${args.memo_type}] ${args.doc_title} — by ${args.prepared_by}`;
  const summary = [
    `**Request**: ${args.memo_type} — ${args.doc_title}`,
    '',
    args.memo_md,
    '',
    '---',
    `_Prepared by ${args.prepared_by} · delivered to your inbox by the Legal Department._`,
  ].join('\n');

  // cockpit_tickets.project_id is a cockpit-internal project FK
  // (cockpit.exec_projects), NOT a property_id. We store property_id in
  // metadata so the HoD inbox UI can scope to /h/<property_id>/inbox.
  const metadata: Record<string, unknown> = {
    assigned_role: args.requested_by_role,
    requesting_hod: args.requested_by_role,
    delivered_by_agent: args.prepared_by,
    memo_type: args.memo_type,
    source_doc_id: args.source_doc_id,
    case_ref: args.case_ref ?? null,
    property_id: args.property_id ?? null,
    priority: 'normal',
    delivery_channel: 'hod_inbox',
  };

  const { data, error } = await SUPABASE
    .from('cockpit_tickets')
    .insert({
      source: 'agent_delivery',
      arm: 'agent_work',
      intent: 'memo_delivery',
      status: 'awaits_user',
      email_subject: subject,
      parsed_summary: summary,
      metadata,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .select('id')
    .single();

  if (error || !data) {
    // Surface the failure in the audit log so this never goes silent again.
    try {
      await SUPABASE.from('cockpit_audit_log').insert({
        agent: 'deliver_memo_to_hod',
        action: 'hod_delivery_failed',
        target: `hod:${args.requested_by_role}`,
        success: false,
        metadata: { memo_type: args.memo_type, error: error?.message ?? 'no row returned' },
        reasoning: 'Insert into cockpit_tickets failed; HoD did not receive memo.',
      });
    } catch { /* audit best-effort */ }
    return { delivered: false, ticket_id: null };
  }
  return { delivered: true, ticket_id: data.id as number };
}

export function buildMemoSystemPrompt(opts: {
  agentName: string;     // Toga / Vera / Sherlock
  agentDept: string;     // "Holding Legal" / "Donna Legal-Finance" / "Investigations"
  memoType: string;      // "Contract Summary" / "Renegotiation Brief" / etc.
  audience: string;
  jurisdictionHint?: string;
}): string {
  return [
    `You are ${opts.agentName}, ${opts.agentDept} at The Beyond Circle.`,
    `You are drafting a ${opts.memoType} for ${opts.audience}.`,
    opts.jurisdictionHint ? `Jurisdiction context: ${opts.jurisdictionHint}.` : '',
    '',
    MEMO_HOUSE_STYLE,
    '',
    'OUTPUT REQUIREMENTS:',
    '- Markdown only. No JSON wrappers. No preamble.',
    '- Start with the literal text "MEMORANDUM" as the first line.',
    '- Include the PRIVILEGED & CONFIDENTIAL line.',
    '- Use Roman-numeral all-caps section headers.',
    '- Limit Section I to 3 short sentences (≤ 4 lines).',
    '- If a data point is missing, state "[Insufficient data — request: <items>]". Never invent.',
    '- Cite contract clauses inline as [Cl. §X.Y] with monospace blockquotes for material excerpts.',
    '- Close with the standard "Prepared by ..." block.',
  ].filter(Boolean).join('\n');
}
