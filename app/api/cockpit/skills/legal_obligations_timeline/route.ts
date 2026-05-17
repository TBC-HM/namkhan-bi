// app/api/cockpit/skills/legal_obligations_timeline/route.ts
// Toga / Vera skill — extract every dated obligation from a contract (or
// set of contracts) into a chronological calendar.
//
// Output: a memorandum-format calendar with each row showing date,
// obligation, party responsible, trigger, and consequence-of-miss.

import { NextResponse } from 'next/server';
import {
  fetchDocBody, callAnthropic, isLlmOk, logSkillRun, buildMemoSystemPrompt,
  personaSignature, deliverMemoToHod, type LegalAgentPersona,
} from '@/lib/legal-memo';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const TIMEFRAME_HINTS: Record<string, string> = {
  'next-30-days':  'Only return obligations falling due within the next 30 calendar days from the reference date. Quiet on the rest.',
  'next-90-days':  'Only return obligations falling due within the next 90 calendar days.',
  'next-year':     'Return obligations falling due within the next 12 months.',
  'all':           'Return every dated obligation in the document, regardless of horizon.',
};

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const {
    doc_id,
    doc_ids,
    timeframe = 'all',
    reference_date,
    jurisdiction_hint,
    agent = 'auto',
    requested_by_role,
    property_id,
    case_ref,
  } = body as {
    doc_id?: string;
    doc_ids?: string[];
    timeframe?: keyof typeof TIMEFRAME_HINTS | string;
    reference_date?: string;
    jurisdiction_hint?: string;
    agent?: LegalAgentPersona;
    requested_by_role?: string;
    property_id?: number;
    case_ref?: string;
  };

  const idList = doc_ids && doc_ids.length > 0 ? doc_ids : (doc_id ? [doc_id] : []);
  if (idList.length === 0) {
    return NextResponse.json({ ok: false, error: 'doc_id or doc_ids[] required' }, { status: 400 });
  }

  const docs = await Promise.all(idList.map((id) => fetchDocBody(id)));
  const valid = docs.filter((d): d is NonNullable<typeof d> => d !== null);
  if (valid.length === 0) {
    return NextResponse.json({ ok: false, error: 'no documents found or unreadable' }, { status: 404 });
  }

  const persona = personaSignature(agent);
  const refDate = reference_date ?? new Date().toISOString().slice(0, 10);
  const horizonGuidance = TIMEFRAME_HINTS[(timeframe as string) || 'all'] || TIMEFRAME_HINTS.all;

  const systemPrompt = buildMemoSystemPrompt({
    agentName: persona.displayName,
    agentDept: 'Legal Department',
    memoType: 'Obligations Calendar Memorandum',
    audience: 'CEO, COO, GENERAL COUNSEL',
    jurisdictionHint: jurisdiction_hint,
  });

  const docsBlock = valid.map((d, i) => [
    `=== DOCUMENT ${i + 1}: ${d.title} (doc_id: ${idList[i]}) ===`,
    d.body || '(empty body)',
  ].join('\n')).join('\n\n');

  const userPrompt = [
    `Subject (RE): Obligations Calendar — ${valid.length === 1 ? valid[0].title : `${valid.length} documents`}`,
    `Reference date for "today": ${refDate}.`,
    `Timeframe filter: ${horizonGuidance}`,
    '',
    'OVERRIDE THE STANDARD SKELETON. Use this OBLIGATIONS-CALENDAR skeleton (keep house-style header, Roman-numeral sections, signing block):',
    '',
    'I.   EXECUTIVE SUMMARY',
    '     ≤ 3 lines. How many dated obligations, the most imminent, and any items already overdue as of the reference date.',
    'II.  CALENDAR — DUE WITHIN HORIZON',
    '     Markdown table with columns (in this exact order):',
    '     | Due date (YYYY-MM-DD) | Days from ref | Obligation | Party responsible | Trigger event | Consequence of miss | Source [Cl. §] |',
    '     Sort ascending by due date. Highlight any "overdue" rows with the inline tag (OVERDUE).',
    'III. CONDITIONAL OBLIGATIONS',
    '     Obligations whose due date depends on a future event (e.g. "30 days after notice"). Same column shape, but Due date column reads "T + N days from <trigger>".',
    'IV.  RENEWALS & TERMINATION WINDOWS',
    '     (a) Renewal/auto-renewal mechanism summary.',
    '     (b) Notice windows (date range during which notice may be given).',
    '     (c) Strategic recommendation: renew / renegotiate / terminate.',
    'V.   RECOMMENDED CALENDAR-INTEGRATION ACTIONS',
    '     Imperative list — what should be put on the company calendar / cron / Linear tracker NOW.',
    'VI.  CLAUSE CITES',
    '',
    'CONTRACT BODIES:',
    '"""',
    docsBlock,
    '"""',
    '',
    'Produce the memorandum now. Start with "MEMORANDUM" on the first line.',
    `Sign as "${persona.displayName}". Reference doc_id(s): ${idList.join(', ')}.`,
  ].join('\n');

  const llm = await callAnthropic({ systemPrompt, userPrompt, maxTokens: 6000 });

  if (!isLlmOk(llm)) {
    await logSkillRun({
      skill: 'legal_obligations_timeline', agent_role: persona.role,
      doc_id: idList[0], ok: false, notes: llm.error,
    });
    return NextResponse.json({ ok: false, error: llm.error }, { status: 502 });
  }

  const memo_md = llm.text;
  const cost_usd_milli = Math.round((llm.usage.in * 3 + llm.usage.out * 15) / 1000);

  await logSkillRun({
    skill: 'legal_obligations_timeline', agent_role: persona.role,
    doc_id: idList[0], ok: true, cost_usd_milli,
    notes: `docs=${idList.length} · timeframe=${timeframe}`,
  });

  const delivery = await deliverMemoToHod({
    memo_md,
    memo_type: 'Obligations Calendar',
    doc_title: valid.length === 1 ? valid[0].title : `${valid.length} documents`,
    source_doc_id: idList[0],
    property_id: property_id ?? null,
    prepared_by: persona.displayName,
    requested_by_role,
    case_ref,
  });

  return NextResponse.json({
    ok: true,
    memo_md,
    doc_titles: valid.map((d) => d.title),
    doc_ids: idList,
    timeframe,
    reference_date: refDate,
    cost_usd_milli,
    prepared_by: persona.displayName,
    delivery,
  });
}
