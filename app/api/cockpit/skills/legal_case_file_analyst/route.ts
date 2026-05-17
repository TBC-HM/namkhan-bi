// Legal Case File Analyst — multi-document case intelligence.
//
// Input  : { doc_ids[] OR case_ref, case_name?, audience?, agent?,
//            requested_by_role?, property_id?, jurisdiction_hint? }
// Output : { ok, analysis_md, doc_titles, doc_ids, cost_usd_milli,
//            prepared_by, delivery: { delivered, ticket_id } }
//
// The skill is intentionally non-advisory: it ORGANIZES, CLASSIFIES,
// SUMMARIZES, and FLAGS, but does not give legal advice. The lawyer
// uses the output as a working brief.

import { NextResponse } from 'next/server';
import {
  SUPABASE, fetchDocBody, callAnthropic, isLlmOk, logSkillRun,
  personaSignature, deliverMemoToHod, ANTHROPIC_MODEL,
  type LegalAgentPersona,
} from '@/lib/legal-memo';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// PBS's analyst playbook — verbatim. Sets the persona, the rules, and the
// mandatory output structure (A through G). This is the system prompt.
const CASE_FILE_ANALYST_PROMPT = `
You are a Legal Case File Analyst.

Your task is to review a folder of documents relating to one specific lawsuit and create a structured case intelligence file.

IMPORTANT:
You are not the lawyer. You do not give legal advice. You organize, classify, summarize, and flag risks, deadlines, inconsistencies, and missing information for lawyer review.

CORE OBJECTIVES

1. Understand the case context
- Identify the parties involved.
- Identify the court, jurisdiction, case number, claim type, and current procedural status.
- Build a short plain-English explanation of what the lawsuit is about.
- Detect whether the matter is civil, criminal, administrative, labor, tax, commercial, real estate, or another category.

2. Build a timeline
- Read all documents in the folder.
- Extract all relevant dates.
- Sort events chronologically.
- Explain what happened on each date.
- Link each event to the source document.
- Mark whether the event is procedural, factual, financial, contractual, court-related, communication-related, or internal note.

3. Weight documents by importance
The most recent documents are usually more important than old documents, but not always.
Give priority in this order:
1. Court verdicts / judgments / orders
2. Official court notices
3. Lawyer filings / submissions
4. Deadlines / procedural calendars
5. Settlement offers or formal legal correspondence
6. Contracts / evidence documents
7. Emails with lawyers, opposing party, court, notary, authority
8. Internal notes / informal summaries

4. Classify every document
For each document, assign one document type:
- Court verdict / judgment
- Court order
- Court notice / summons
- Filing / claim / defence / appeal
- Lawyer letter
- Opposing party letter
- Settlement communication
- Contract / agreement
- Evidence
- Invoice / financial document
- Email
- Internal note
- Unknown / needs human review

Also assign:
- Importance: Critical / High / Medium / Low
- Recency: Latest / Recent / Historic
- Reliability: Official / Lawyer-reviewed / Third-party / Internal / Unclear

5. Extract deadlines and risk dates
Identify every date that may require action, including:
- Court response deadline
- Appeal deadline
- Hearing date
- Filing deadline
- Payment deadline
- Evidence submission deadline
- Settlement response deadline
- Limitation / prescription date
- Contractual notice deadline
- Any date phrased as "within X days"

For each date:
- Calculate the actual deadline if possible.
- Identify the document where it appears.
- Explain the consequence if missed, if stated in the document.
- Mark confidence: High / Medium / Low.
- If the date depends on service/receipt date, flag it as "needs lawyer confirmation".

6. Reminder logic
For every deadline or risk date:
- Create a reminder date at least 7 days before the deadline.
- If the deadline is within 7 days, mark as URGENT.
- If the deadline has already passed, mark as PAST DEADLINE — verify immediately.
- If the deadline is unclear, create a review reminder immediately.

7. Detect contradictions and missing information
Flag:
- Different documents showing different dates.
- Missing court notices.
- Missing proof of service.
- Missing attachments referenced in emails or filings.
- Unclear final status of the lawsuit.
- Old documents that may have been superseded by newer court decisions.
- Any document that appears important but unreadable, incomplete, unsigned, or not dated.

8. Output format
Return the result in the following structure (markdown). USE the exact section labels A, B, C, D, E, F, G:

A. Case Snapshot
- Case name:
- Parties:
- Court / authority:
- Case number:
- Legal area:
- Current known status:
- Latest critical document:
- Immediate risks:

B. Latest Important Documents
Markdown table:
| Date | Document name | Document type | Importance | Why it matters | Action required |

C. Full Timeline
Markdown table:
| Date | Event | Source document | Category | Importance | Notes |

D. Deadline Watchlist
Markdown table:
| Deadline date | Reminder date | Required action | Source document | Confidence | Status | Lawyer confirmation needed? |

E. Document Register
Markdown table:
| Document name | Document date | Upload / file date | Document type | Importance | Reliability | Summary | Superseded by newer document? |

F. Red Flags
List any urgent legal, procedural, document-quality, or timing risks. Use bullet points.

G. Questions for the Lawyer
Short numbered list of questions that must be confirmed by the lawyer before relying on the deadline list.

RULES
- Never invent dates.
- Never assume a deadline if the trigger date is unclear.
- Always separate "document date", "event date", "upload date", and "deadline date".
- If a document is newer and conflicts with an older document, treat the newer official court/lawyer document as more likely current, but flag the conflict.
- Do not bury deadlines in long text. Deadlines must always appear in the Deadline Watchlist.
- Use plain language.
- Be conservative: when in doubt, flag for lawyer review.
- Output is MARKDOWN ONLY. No JSON wrapper. Start the response with the literal text "A. Case Snapshot".
`.trim();

void ANTHROPIC_MODEL; // re-exported for visibility in this module

interface CaseDocRow {
  doc_id: string;
  title: string;
  doc_type: string | null;
  doc_subtype: string | null;
  language: string | null;
  source: string | null;
  created_at: string | null;
  body: string;
}

async function gatherDocsByCaseRef(caseRef: string): Promise<CaseDocRow[]> {
  // Pull every dms.documents row for this case via a SECURITY DEFINER
  // RPC if available, else fall back to direct table access. We project
  // a small column set and limit to current versions.
  const { data, error } = await SUPABASE
    .schema('dms')
    .from('documents')
    .select('doc_id, title, doc_type, doc_subtype, language, source, created_at, body_markdown')
    .eq('project', caseRef)
    .eq('is_current_version', true)
    .order('created_at', { ascending: true })
    .limit(200);
  if (error || !data) return [];
  return data.map((r) => ({
    doc_id: r.doc_id as string,
    title: (r.title as string) || '(untitled)',
    doc_type: (r.doc_type as string | null) ?? null,
    doc_subtype: (r.doc_subtype as string | null) ?? null,
    language: (r.language as string | null) ?? null,
    source: (r.source as string | null) ?? null,
    created_at: (r.created_at as string | null) ?? null,
    body: (r.body_markdown as string) || '',
  }));
}

async function gatherDocsByIds(ids: string[]): Promise<CaseDocRow[]> {
  const rows = await Promise.all(ids.map(async (id) => {
    const d = await fetchDocBody(id);
    if (!d) return null;
    return {
      doc_id: id,
      title: d.title,
      doc_type: d.doc_type ?? null,
      doc_subtype: null,
      language: d.language,
      source: d.source ?? null,
      created_at: null,
      body: d.body,
    } as CaseDocRow;
  }));
  return rows.filter((r): r is CaseDocRow => r !== null);
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const {
    doc_ids,
    case_ref,
    case_name,
    jurisdiction_hint,
    agent = 'auto',
    requested_by_role,
    property_id,
  } = body as {
    doc_ids?: string[];
    case_ref?: string;
    case_name?: string;
    jurisdiction_hint?: string;
    agent?: LegalAgentPersona;
    requested_by_role?: string;
    property_id?: number;
  };

  if (!doc_ids?.length && !case_ref) {
    return NextResponse.json(
      { ok: false, error: 'one of doc_ids[] or case_ref required' },
      { status: 400 },
    );
  }

  // Collect documents.
  const docs = doc_ids?.length
    ? await gatherDocsByIds(doc_ids)
    : await gatherDocsByCaseRef(case_ref!);

  if (docs.length === 0) {
    return NextResponse.json({ ok: false, error: 'no documents found for the given selector' }, { status: 404 });
  }

  const persona = personaSignature(agent);
  const today = new Date().toISOString().slice(0, 10);
  const resolvedCaseName = case_name || case_ref || docs[0].title;

  // Concatenate the document corpus. Cap each doc body so the whole
  // payload stays under the Anthropic input window with comfortable
  // headroom. 30 docs × 6000 chars = ~180k chars ≈ ~45k tokens.
  const PER_DOC_BUDGET = 6000;
  const corpus = docs.map((d, i) => [
    `=== DOCUMENT ${i + 1} ===`,
    `doc_id:      ${d.doc_id}`,
    `title:       ${d.title}`,
    `doc_type:    ${d.doc_type ?? 'unknown'}` + (d.doc_subtype ? ` / ${d.doc_subtype}` : ''),
    `language:    ${d.language ?? 'unknown'}`,
    `created_at:  ${d.created_at ?? 'unknown'}`,
    `source:      ${d.source ?? 'unknown'}`,
    '--- body ---',
    d.body.length > PER_DOC_BUDGET
      ? d.body.slice(0, PER_DOC_BUDGET) + `\n[... truncated, full body is ${d.body.length} chars ...]`
      : d.body,
    '=== END DOCUMENT ===',
  ].join('\n')).join('\n\n');

  const userPrompt = [
    `Reference date for "today": ${today}.`,
    jurisdiction_hint ? `Jurisdiction hint: ${jurisdiction_hint}.` : '',
    `Case name (use this as "Case name" in A. Case Snapshot): ${resolvedCaseName}.`,
    `Number of documents in this folder: ${docs.length}.`,
    `Document corpus follows. Each document is fenced by "=== DOCUMENT N ===" and "=== END DOCUMENT ===". The doc_id and title in each header are authoritative — cite them in the Source/Document columns of your output tables.`,
    '',
    corpus,
    '',
    'Now produce the structured case intelligence file. Output markdown only, starting with "A. Case Snapshot".',
  ].filter(Boolean).join('\n');

  const llm = await callAnthropic({
    systemPrompt: CASE_FILE_ANALYST_PROMPT,
    userPrompt,
    maxTokens: 8000,
  });

  if (!isLlmOk(llm)) {
    await logSkillRun({
      skill: 'legal_case_file_analyst', agent_role: persona.role,
      doc_id: docs[0].doc_id, ok: false, notes: llm.error,
    });
    return NextResponse.json({ ok: false, error: llm.error }, { status: 502 });
  }

  const analysis_md = llm.text;
  const cost_usd_milli = Math.round((llm.usage.in * 3 + llm.usage.out * 15) / 1000);

  await logSkillRun({
    skill: 'legal_case_file_analyst', agent_role: persona.role,
    doc_id: docs[0].doc_id, ok: true, cost_usd_milli,
    notes: `docs=${docs.length} · case=${resolvedCaseName}`,
  });

  const delivery = await deliverMemoToHod({
    memo_md: analysis_md,
    memo_type: 'Case File Intelligence',
    doc_title: resolvedCaseName,
    source_doc_id: docs[0].doc_id,
    property_id: property_id ?? null,
    prepared_by: persona.displayName,
    requested_by_role,
    case_ref: case_ref,
  });

  return NextResponse.json({
    ok: true,
    analysis_md,
    case_name: resolvedCaseName,
    case_ref: case_ref ?? null,
    doc_count: docs.length,
    doc_ids: docs.map((d) => d.doc_id),
    doc_titles: docs.map((d) => d.title),
    cost_usd_milli,
    prepared_by: persona.displayName,
    delivery,
  });
}
