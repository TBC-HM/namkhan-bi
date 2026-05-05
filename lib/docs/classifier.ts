// lib/docs/classifier.ts
// Calls Anthropic Claude Haiku to classify a doc + extract structured fields.
// Uses fetch directly (no SDK) — same pattern as lib/composerRunner.ts.
//
// Returns the metadata Cloud the indexer writes into docs.documents.

const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages';
const MODEL = 'claude-haiku-4-5-20251001';

export type DocClassification = {
  doc_type:
    | 'partner' | 'legal' | 'audit' | 'insurance' | 'financial'
    | 'hr_doc' | 'sop' | 'template' | 'presentation' | 'research'
    | 'kb_article' | 'compliance' | 'note' | 'marketing';
  doc_subtype: string | null;
  importance: 'critical' | 'standard' | 'note' | 'research' | 'reference';
  title: string;
  title_lo: string | null;
  title_fr: string | null;
  language: 'en' | 'lo' | 'fr' | 'es' | 'mixed';
  summary: string;
  keywords: string[];
  tags: string[];
  external_party: string | null;
  parties: Record<string, unknown>;
  valid_from: string | null;   // YYYY-MM-DD
  valid_until: string | null;  // YYYY-MM-DD
  signed: boolean;
  reference_number: string | null;
  amount: number | null;
  amount_currency: 'USD' | 'LAK' | 'EUR' | 'THB' | null;
  period_year: number | null;
  sensitivity: 'public' | 'internal' | 'confidential' | 'restricted';
};

const SYSTEM_PROMPT = `You are a document indexer for a hotel BI portal.
Classify each document and extract structured fields. Respond ONLY with valid JSON
matching the schema below — no commentary, no markdown fences.

DOC TYPES (pick exactly one):
  partner       — partner agreements (SLH, Hilton, Travelife, Booking, Expedia)
  legal         — contracts, MOU, permits, licenses, NDA
  audit         — third-party audits (SGS, fire, food safety, environmental, ISO)
  insurance     — policies, certificates, claims
  financial     — invoices, receipts, statements, tax filings, budgets
  hr_doc        — staff contracts, payslips, ID docs, certifications
  sop           — standard operating procedures (FB, FO, HK, ENG, HR, safety)
  template      — re-usable templates (email, contract, checklist, form)
  presentation  — decks (board, partner, training, marketing)
  research      — market reports, comp data, industry articles
  kb_article    — internal knowledge base, runbooks, decision logs
  compliance    — regulatory filings, declarations
  note          — meeting notes, memos, internal communications
  marketing     — campaign briefs, content calendars, asset briefs, brand guides

IMPORTANCE (pick exactly one):
  critical   — legally binding / regulatory / cannot lose (contracts, audits, insurance, partner agreements, licenses)
  standard   — operational reference (SOPs, brand standards, financial statements)
  note       — internal memos, meeting notes, drafts
  research   — market data, comp set, articles for context
  reference  — templates, examples, training material

RULES:
  - If a field is unclear or missing, set it to null. NEVER invent.
  - Add "needs_review" to tags[] if classification confidence is low.
  - title: clean, human-readable (e.g. "SLH Membership Agreement 2024-2027" not "slh_v2_FINAL.pdf").
  - keywords: up to 20 lowercase terms incl. SYNONYMS (e.g. for a wine-stain SOP add: "wine, red wine, alcohol, beverage, stain, spill, carpet, cleaning").
  - tags: up to 8, structural (e.g. "annual", "renewal", "draft", "supersedes_v2").
  - external_party: the issuing org or counterparty (e.g. "SLH", "Travelife", "Hilton", "SGS"). Null if internal-only.
  - parties: jsonb e.g. {"counterparty":"SLH","internal_signatory":"PBS"}.
  - dates: YYYY-MM-DD only. valid_from = effective/issue date, valid_until = expiry/renewal/re-audit date.
    DATE EXTRACTION RULES (be thorough — many docs have dates the user wants to track):
      a) Filename patterns: "_27122024.pdf" → 2024-12-27 · "_2025.pdf" → 2025-01-01 (period_year=2025) ·
         "_FY26.pdf" → 2026 fiscal · "Feb-2025.pdf" → 2025-02-01 (valid_from).
      b) Body phrases: "valid until", "expires on", "renewal date", "termination",
         "agreement period", "effective from", "this agreement is dated",
         "until [date]", "for the period", "good through", "valid for X years".
      c) Audit/cert reports: "next audit due", "re-certification", "renewal cycle = N months".
      d) Contracts: "term: 3 years from [date]" → valid_from + valid_until = +3y.
         "auto-renewal" → set valid_until to end of current term + tag 'auto-renew'.
      e) Invoices/financial: usually no expiry — leave valid_until null, set period_year to invoice year.
      f) Insurance certs: "policy period: DD/MM/YYYY to DD/MM/YYYY" — both bounds.
      g) ALWAYS prefer body-text dates over filename dates if both present.
      h) If multiple candidate dates, pick the one most likely to be the LEGAL/EFFECTIVE date,
         NOT signing-date or printing-date.
      i) If unclear or no date is present anywhere, set null. NEVER guess a year.
  - sensitivity:
      restricted    — owner-only (board, M&A, exec comp)
      confidential  — partner agreements, audits, finance, HR, legal
      internal      — SOPs, templates, KB, research
      public        — marketing collateral, brochures
  - period_year: for financial/research docs, the YEAR the doc covers.

JSON SCHEMA (return EXACTLY this shape):
{
  "doc_type": "...",
  "doc_subtype": "..." | null,
  "importance": "...",
  "title": "...",
  "title_lo": "..." | null,
  "title_fr": "..." | null,
  "language": "en"|"lo"|"fr"|"es"|"mixed",
  "summary": "2-3 sentences, what's in this doc and why it matters",
  "keywords": ["...", ...],
  "tags": ["...", ...],
  "external_party": "..." | null,
  "parties": {},
  "valid_from": "YYYY-MM-DD" | null,
  "valid_until": "YYYY-MM-DD" | null,
  "signed": true | false,
  "reference_number": "..." | null,
  "amount": 0 | null,
  "amount_currency": "USD"|"LAK"|"EUR"|"THB" | null,
  "period_year": 0 | null,
  "sensitivity": "public"|"internal"|"confidential"|"restricted"
}`;

export async function classifyDocument(opts: {
  fileName: string;
  mimeType: string;
  extractedText: string;   // first ~8k tokens of body
}): Promise<DocClassification> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY not set');

  // Truncate to ~32k chars (~8k tokens) — enough for classification
  const text = (opts.extractedText || '').slice(0, 32_000);

  const userMsg =
    `FILENAME: ${opts.fileName}\n` +
    `MIME:     ${opts.mimeType}\n` +
    `\n--- EXTRACTED TEXT (first ${text.length} chars) ---\n` +
    (text || '[no text extracted — classify based on filename only]');

  const resp = await fetch(ANTHROPIC_URL, {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 2000,
      temperature: 0.1,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userMsg }],
    }),
  });

  if (!resp.ok) {
    const err = await resp.text();
    throw new Error(`Anthropic ${resp.status}: ${err}`);
  }

  const data = await resp.json() as { content: { type: string; text: string }[] };
  const raw = data.content.find(c => c.type === 'text')?.text ?? '';

  // Strip ```json fences if Haiku adds them despite instructions
  const cleaned = raw.trim().replace(/^```(?:json)?\s*/, '').replace(/```$/, '').trim();

  let parsed: DocClassification;
  try {
    parsed = JSON.parse(cleaned);
  } catch (e: any) {
    throw new Error(`Classifier returned non-JSON: ${cleaned.slice(0, 200)}`);
  }

  // Defensive defaults
  parsed.keywords = Array.isArray(parsed.keywords) ? parsed.keywords.slice(0, 20) : [];
  parsed.tags = Array.isArray(parsed.tags) ? parsed.tags.slice(0, 8) : [];
  parsed.parties = parsed.parties && typeof parsed.parties === 'object' ? parsed.parties : {};

  return parsed;
}
