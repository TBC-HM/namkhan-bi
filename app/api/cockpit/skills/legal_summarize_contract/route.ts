// app/api/cockpit/skills/legal_summarize_contract/route.ts
// Toga / Vera / Sherlock skill — produce a corporate-law-firm-style
// contract summary memo, audience-tunable.
//
// Input  : { doc_id, audience?, focus_areas?, jurisdiction_hint?, agent? }
// Output : { ok, memo_md, doc_title, audience, focus_areas, cost_usd_milli }

import { NextResponse } from 'next/server';
import {
  fetchDocBody, callAnthropic, isLlmOk, logSkillRun, buildMemoSystemPrompt,
  personaSignature, deliverMemoToHod, type LegalAgentPersona,
} from '@/lib/legal-memo';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const AUDIENCE_HINTS: Record<string, string> = {
  finance:    'CFO / Finance Department. Lead with money flows: total commitment, payment cadence, escalators, security deposits, FX exposure, off-balance-sheet implications. Renewal/termination economics get a full subsection.',
  operations: 'COO / Operations Department. Lead with operational obligations: deliverables, SLAs, staffing requirements, equipment/facility responsibilities, performance KPIs, default triggers.',
  ceo:        'CEO / Founder. Lead with strategic posture: what does this contract bind the Company to, what optionality is preserved, what is the worst-case exposure, what does the counterparty get out of it.',
  legal:      'Internal counsel. Standard balanced legal memorandum — all sections weighted equally, with explicit attention to enforceability and governing-law nuances.',
  board:      'Board of Directors / Investors. Lead with strategic and economic implications. Quantify exposure in absolute and as % of revenue/EBITDA where derivable. Flag any related-party / conflict aspects.',
};

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const {
    doc_id,
    audience = 'legal',
    focus_areas = [],
    jurisdiction_hint,
    agent = 'auto',
    requested_by_role,
    property_id,
    case_ref,
  } = body as {
    doc_id?: string;
    audience?: keyof typeof AUDIENCE_HINTS | string;
    focus_areas?: string[];
    jurisdiction_hint?: string;
    agent?: LegalAgentPersona;
    requested_by_role?: string;
    property_id?: number;
    case_ref?: string;
  };

  if (!doc_id) return NextResponse.json({ ok: false, error: 'doc_id required' }, { status: 400 });

  const doc = await fetchDocBody(doc_id);
  if (!doc) return NextResponse.json({ ok: false, error: 'document not found or unreadable' }, { status: 404 });

  const persona = personaSignature(agent);
  const audienceLabel =
    typeof audience === 'string' && AUDIENCE_HINTS[audience]
      ? audience.toUpperCase()
      : 'INTERNAL COUNSEL';
  const audienceGuidance = AUDIENCE_HINTS[(audience as string) || 'legal'] || AUDIENCE_HINTS.legal;

  const systemPrompt = buildMemoSystemPrompt({
    agentName: persona.displayName,
    agentDept: 'Legal Department',
    memoType: 'Contract Summary Memorandum',
    audience: audienceLabel,
    jurisdictionHint: jurisdiction_hint,
  });

  const focusLine = focus_areas.length > 0
    ? `Focus areas (give these disproportionate weight): ${focus_areas.join(' · ')}.`
    : 'Cover all sections of the canonical memorandum.';

  const userPrompt = [
    `You are summarising the following contract for ${audienceLabel}.`,
    `Audience guidance: ${audienceGuidance}`,
    focusLine,
    '',
    `SUBJECT (RE): Contract Summary — ${doc.title}`,
    `Document language detected: ${doc.language ?? 'unknown'}.`,
    '',
    'CONTRACT BODY (extracted text or structured summary):',
    '"""',
    doc.body || '(empty body)',
    '"""',
    '',
    'Produce the memorandum now. Start with "MEMORANDUM" on the first line.',
    `Sign as "${persona.displayName}" and reference doc_id ${doc_id}.`,
  ].join('\n');

  const llm = await callAnthropic({ systemPrompt, userPrompt, maxTokens: 4096 });

  if (!isLlmOk(llm)) {
    await logSkillRun({
      skill: 'legal_summarize_contract', agent_role: persona.role,
      doc_id, ok: false, notes: llm.error,
    });
    return NextResponse.json({ ok: false, error: llm.error }, { status: 502 });
  }

  const memo_md = llm.text;
  const cost_usd_milli = Math.round((llm.usage.in * 3 + llm.usage.out * 15) / 1000);

  await logSkillRun({
    skill: 'legal_summarize_contract', agent_role: persona.role,
    doc_id, ok: true, cost_usd_milli,
    notes: `audience=${audienceLabel} · focus=${focus_areas.join(',') || 'all'}`,
  });

  const delivery = await deliverMemoToHod({
    memo_md,
    memo_type: 'Contract Summary',
    doc_title: doc.title,
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
    audience: audienceLabel,
    focus_areas,
    cost_usd_milli,
    prepared_by: persona.displayName,
    delivery,
  });
}
