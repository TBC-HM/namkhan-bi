// app/api/cockpit/skills/legal_contract_risk_report/route.ts
// Toga / Vera / Sherlock skill — produce a Risk Assessment Memorandum with
// red/yellow/green clause-by-clause assessment, top-5 immediate risks,
// and recommended mitigations.

import { NextResponse } from 'next/server';
import {
  fetchDocBody, callAnthropic, isLlmOk, logSkillRun, buildMemoSystemPrompt,
  personaSignature, deliverMemoToHod, type LegalAgentPersona,
} from '@/lib/legal-memo';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const RISK_FOCUS_HINTS: Record<string, string> = {
  all:         'Cover the full risk surface: compliance, financial, operational, employment, IP, data-privacy, dispute-resolution.',
  compliance:  'Weight compliance and regulatory exposure heavily — sector-specific permits, RGPD/GDPR, AML/KYC, tax obligations.',
  financial:   'Weight financial-exposure analysis: payment defaults, security deposits, escalators, currency, indemnification caps, liquidated damages.',
  operational: 'Weight operational risks: deliverables, SLAs, service-level credits, staffing, facility responsibilities, force majeure.',
  employment:  'Weight employment / labour exposure: subrogation duties, severance triggers, collective-bargaining alignment, notice periods, accrued vacation.',
};

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const {
    doc_id,
    focus = 'all',
    jurisdiction_hint,
    agent = 'auto',
    requested_by_role,
    property_id,
    case_ref,
  } = body as {
    doc_id?: string;
    focus?: keyof typeof RISK_FOCUS_HINTS | string;
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
  const focusGuidance = RISK_FOCUS_HINTS[(focus as string) || 'all'] || RISK_FOCUS_HINTS.all;

  const systemPrompt = buildMemoSystemPrompt({
    agentName: persona.displayName,
    agentDept: 'Legal Department',
    memoType: 'Risk Assessment Memorandum',
    audience: 'CEO, GENERAL COUNSEL, BOARD',
    jurisdictionHint: jurisdiction_hint,
  });

  const userPrompt = [
    `Subject (RE): Risk Assessment — ${doc.title}`,
    `Focus orientation: ${focusGuidance}`,
    `Document language: ${doc.language ?? 'unknown'}.`,
    '',
    'OVERRIDE THE STANDARD SKELETON. Use this RISK-ASSESSMENT skeleton (keep house-style header, Roman-numeral sections, signing block):',
    '',
    'I.   EXECUTIVE BOTTOM LINE',
    '     ≤ 4 lines. Overall risk colour (RED / YELLOW / GREEN). One-sentence headline. One-sentence on the single largest exposure quantified if possible.',
    'II.  RISK MATRIX',
    '     Three subsections — RED (MATERIAL · immediate action), YELLOW (ELEVATED · monitor or renegotiate), GREEN (STANDARD · acceptable).',
    '     For each entry use this fixed shape:',
    '        [Cl. §X.Y] — <short clause title>',
    '            > <monospace blockquote — relevant excerpt, ≤ 2 lines>',
    '            Risk: <1 sentence describing the risk>',
    '            Likelihood × Impact: <Low/Med/High × Low/Med/High>',
    '            Quantified exposure (if derivable): <€/$ amount or "qualitative only">',
    'III. CONCENTRATION & SCENARIO ANALYSIS',
    '     (a) What scenario triggers the largest cash exposure? Walk through the chain.',
    '     (b) What scenarios trigger reputational or regulatory exposure?',
    '     (c) Any single point of failure (one clause whose breach unlocks the rest)?',
    'IV.  RECOMMENDED MITIGATIONS — RANKED',
    '     Numbered, imperative voice. Each entry: action · owner (department) · target completion date · estimated cost / friction.',
    'V.   OPEN QUESTIONS / EVIDENCE REQUIRED',
    '     Bullet list — what additional facts would sharpen this assessment.',
    'VI.  AUTHORITIES & CLAUSE CITES',
    '',
    'CONTRACT BODY:',
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
      skill: 'legal_contract_risk_report', agent_role: persona.role,
      doc_id, ok: false, notes: llm.error,
    });
    return NextResponse.json({ ok: false, error: llm.error }, { status: 502 });
  }

  const memo_md = llm.text;
  const cost_usd_milli = Math.round((llm.usage.in * 3 + llm.usage.out * 15) / 1000);

  await logSkillRun({
    skill: 'legal_contract_risk_report', agent_role: persona.role,
    doc_id, ok: true, cost_usd_milli,
    notes: `focus=${focus}`,
  });

  const delivery = await deliverMemoToHod({
    memo_md,
    memo_type: 'Risk Assessment',
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
    focus,
    cost_usd_milli,
    prepared_by: persona.displayName,
    delivery,
  });
}
