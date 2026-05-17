// app/api/cockpit/skills/legal_renegotiation_points/route.ts
// Toga / Vera skill — produce a Negotiation Posture Memorandum identifying
// clauses to renegotiate, ranked by adverse-to-Company impact, with
// proposed revisions, leverage points, and walk-away positions.

import { NextResponse } from 'next/server';
import {
  fetchDocBody, callAnthropic, isLlmOk, logSkillRun, buildMemoSystemPrompt,
  personaSignature, deliverMemoToHod, type LegalAgentPersona,
} from '@/lib/legal-memo';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const {
    doc_id,
    our_position = 'unspecified',
    leverage_signals = [],
    jurisdiction_hint,
    agent = 'auto',
    counterparty_name,
    requested_by_role,
    property_id,
    case_ref,
  } = body as {
    doc_id?: string;
    our_position?: string;
    leverage_signals?: string[];
    jurisdiction_hint?: string;
    agent?: LegalAgentPersona;
    counterparty_name?: string;
    requested_by_role?: string;
    property_id?: number;
    case_ref?: string;
  };

  if (!doc_id) return NextResponse.json({ ok: false, error: 'doc_id required' }, { status: 400 });

  const doc = await fetchDocBody(doc_id);
  if (!doc) return NextResponse.json({ ok: false, error: 'document not found or unreadable' }, { status: 404 });

  const persona = personaSignature(agent);

  const systemPrompt = buildMemoSystemPrompt({
    agentName: persona.displayName,
    agentDept: 'Legal Department',
    memoType: 'Negotiation Posture Memorandum',
    audience: 'INTERNAL COUNSEL & DEAL TEAM',
    jurisdictionHint: jurisdiction_hint,
  });

  const leverageBlock = leverage_signals.length > 0
    ? `Known leverage signals to weave into proposed revisions and walk-away analysis:\n  • ${leverage_signals.join('\n  • ')}`
    : 'No specific leverage signals provided. Derive leverage solely from the contract\'s structural weaknesses and any commercial context inferable from the document itself.';

  const userPrompt = [
    `Subject (RE): Negotiation Posture — ${counterparty_name ?? doc.title}`,
    `The Company's position in this deal: ${our_position}.`,
    `Document language detected: ${doc.language ?? 'unknown'}.`,
    leverageBlock,
    '',
    'OVERRIDE THE STANDARD MEMORANDUM SKELETON. Use the following NEGOTIATION-POSTURE skeleton instead, while keeping all house-style rules (header, Roman numerals, all-caps section titles, PRIVILEGED & CONFIDENTIAL line, signing block):',
    '',
    'I.   EXECUTIVE SUMMARY  (≤ 4 lines: deal posture in one sentence, top-3 issues in second sentence, recommended walk-away conditions in third).',
    'II.  STRATEGIC POSTURE',
    '     (a) The Company\'s position and BATNA.',
    '     (b) Counterparty\'s likely priorities and BATNA (inferred).',
    '     (c) Asymmetry analysis (where is leverage tilted, and why).',
    'III. CLAUSES TO RENEGOTIATE — RANKED',
    '     Present as a numbered list (1, 2, 3, ...) ordered by adverse-to-Company severity. Each entry MUST contain, in this fixed order:',
    '        Clause: [Cl. §X.Y or Article N]',
    '        Current text:',
    '            > <monospace blockquote — direct excerpt, ≤ 3 lines>',
    '        Adverse impact: <1-2 sentences quantifying where possible>',
    '        Proposed revision:',
    '            > <monospace blockquote — drafted replacement language>',
    '        Leverage to deploy: <what argument makes the counterparty concede>',
    '        Fallback position: <minimum acceptable concession>',
    'IV.  CLAUSES TO HOLD (do not raise — quiet wins)',
    '     Brief list of clauses already favourable to the Company that we should preserve in any redraft round.',
    'V.   WALK-AWAY CONDITIONS',
    '     Lettered list (a, b, c) of red lines. If the counterparty refuses any of these, recommend termination of negotiations.',
    'VI.  PROCESS RECOMMENDATION',
    '     Tactical sequence: which clauses to raise first, which to bundle, which to trade. One paragraph.',
    'VII. AUTHORITIES & CLAUSE CITES',
    '     Cited authorities (statutes, prior precedent, comparable deal terms in TBC portfolio if any).',
    '',
    'DRAFT BODY (extracted text):',
    '"""',
    doc.body || '(empty body)',
    '"""',
    '',
    'Produce the memorandum now. Start with "MEMORANDUM" on the first line.',
    `Sign as "${persona.displayName}" and reference doc_id ${doc_id}.`,
  ].join('\n');

  const llm = await callAnthropic({ systemPrompt, userPrompt, maxTokens: 5000 });

  if (!isLlmOk(llm)) {
    await logSkillRun({
      skill: 'legal_renegotiation_points', agent_role: persona.role,
      doc_id, ok: false, notes: llm.error,
    });
    return NextResponse.json({ ok: false, error: llm.error }, { status: 502 });
  }

  const memo_md = llm.text;
  const cost_usd_milli = Math.round((llm.usage.in * 3 + llm.usage.out * 15) / 1000);

  await logSkillRun({
    skill: 'legal_renegotiation_points', agent_role: persona.role,
    doc_id, ok: true, cost_usd_milli,
    notes: `our_position=${our_position}`,
  });

  const delivery = await deliverMemoToHod({
    memo_md,
    memo_type: 'Negotiation Posture',
    doc_title: counterparty_name ?? doc.title,
    source_doc_id: doc_id,
    property_id: property_id ?? null,
    prepared_by: persona.displayName,
    requested_by_role,
    case_ref,
  });

  return NextResponse.json({
    ok: true,
    memo_md,
    doc_title: doc.title,
    doc_id,
    our_position,
    cost_usd_milli,
    prepared_by: persona.displayName,
    delivery,
  });
}
