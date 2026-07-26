// lib/docs/visionOcr.ts
// Vision OCR against Claude Haiku 4.5.
//
// TWO contracts (autospec-brain_module-20260725 · D1):
//  1. classifyPdfWithVision — legacy JSON contract (text + classification in
//     one call) used by /api/docs/ingest and /api/docs/reindex. Now with
//     (a) max_tokens raised 8000 → 32000 (the root cause of the 38+ stranded
//     "Vision OCR returned non-JSON" failures was JSON truncation), and
//     (b) a lenient salvage path: when the JSON wrapper is malformed but the
//     extracted text is present, we recover the text instead of throwing.
//  2. ocrPlainText — plain-text-only contract for the brain-extract OCR
//     worker (PDF pages or images). No JSON wrapper at all — nothing to
//     truncate, nothing to parse. brain-classify re-derives classification
//     from extracted_md, so the wrapper added risk and no value there.

const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages';
const MODEL = 'claude-haiku-4-5-20251001';

import type { DocClassification } from './classifier';

const SYSTEM_PROMPT = `You are a document indexer. Read the attached PDF (likely scanned/image-only)
and return a single JSON object with TWO things:

1) "extracted_text" — the FULL plain-text content of the document, as accurate as possible
   from OCR. Preserve paragraph breaks with \\n\\n. Skip page-number headers/footers.
   If a page is purely visual (logo, photo) write "[image-only page]". Cap at 100k chars.

2) All classification fields (same schema as the text-only classifier):
   doc_type, doc_subtype, importance, title, title_lo, title_fr, language,
   summary, keywords (up to 20 incl. synonyms), tags (up to 8),
   external_party, parties, valid_from, valid_until, signed,
   reference_number, amount, amount_currency, period_year, sensitivity.

DATE EXTRACTION (be thorough on valid_from / valid_until):
  - Filename patterns: "_27122024.pdf" → 2024-12-27, "_FY26" → 2026, "Feb-2025" → 2025-02-01.
  - Body phrases: "valid until", "expires on", "renewal date", "agreement period",
    "effective from", "for the period", "good through", "policy period: X to Y".
  - Audits/certs: "next audit due", "re-certification cycle", "valid for N months".
  - Contracts: "term: 3 years from [date]" → derive both endpoints.
  - Invoices: usually no expiry — set period_year to invoice year, valid_until null.
  - Prefer body dates over filename dates if both present.
  - Pick the LEGAL/EFFECTIVE date (not the signing/printing date).
  - If unclear, set null. Never guess.

DOC TYPES (pick one): partner, legal, audit, insurance, financial, hr_doc, sop,
  template, presentation, research, kb_article, compliance, note, marketing,
  meeting_note, brand, vendor_doc, guest_doc, recipe_doc, training_material,
  external_feed, markdown, other.

IMPORTANCE: critical | standard | note | research | reference.
SENSITIVITY: public | internal | confidential | restricted.

RETURN ONLY VALID JSON. No commentary, no markdown fences.

Schema:
{
  "extracted_text": "...full OCR text...",
  "doc_type": "...", "doc_subtype": "..."|null, "importance": "...",
  "title": "...", "title_lo": "..."|null, "title_fr": "..."|null,
  "language": "en"|"lo"|"fr"|"es"|"mixed",
  "summary": "2-3 sentences",
  "keywords": ["...", ...], "tags": ["...", ...],
  "external_party": "..."|null, "parties": {},
  "valid_from": "YYYY-MM-DD"|null, "valid_until": "YYYY-MM-DD"|null,
  "signed": true|false, "reference_number": "..."|null,
  "amount": 0|null, "amount_currency": "USD"|"LAK"|"EUR"|"THB"|null,
  "period_year": 0|null, "sensitivity": "public"|"internal"|"confidential"|"restricted"
}`;

const PLAIN_TEXT_PROMPT = `You are an OCR engine. Read the attached document (a scanned PDF or a photo/image of a document) and return its FULL plain-text content, as accurately as possible.

Rules:
- Return ONLY the extracted text. No commentary, no JSON, no markdown fences, no preamble.
- Preserve paragraph breaks with blank lines. Preserve tables as simple aligned text lines.
- Keep the original language(s) — Lao, French, English, Spanish, Thai — exactly as written. Do NOT translate.
- Skip page-number headers/footers.
- If a page is purely visual (logo, photo, blank), write [image-only page] on its own line.
- If the document is fully illegible, return exactly: [illegible]`;

/** Unescape a JSON string body captured without its closing quote. Pure. */
function unescapeJsonString(s: string): string {
  return s
    .replace(/\\u([0-9a-fA-F]{4})/g, (_, h) => {
      try { return String.fromCharCode(parseInt(h, 16)); } catch { return ''; }
    })
    .replace(/\\n/g, '\n').replace(/\\r/g, '\r').replace(/\\t/g, '\t')
    .replace(/\\"/g, '"').replace(/\\\//g, '/').replace(/\\\\/g, '\\');
}

/**
 * Lenient salvage of the vision JSON contract (D1). Pure + exported for tests.
 * Strategy, in order:
 *  1. Straight JSON.parse (fences already stripped by caller).
 *  2. Truncated-JSON repair: if "extracted_text" opens but the wrapper never
 *     closes, scan the string value manually (handling escapes) to end-of-
 *     input and recover the text.
 *  3. Not-JSON-at-all: if the payload doesn't even look like JSON, treat the
 *     whole payload as the extracted text (the model answered plain text).
 * Returns null only when no usable text can be recovered.
 */
export function salvageVisionPayload(cleaned: string): { extracted_text: string; parsed: Record<string, unknown> | null } | null {
  // 1 — well-formed
  try {
    const p = JSON.parse(cleaned) as Record<string, unknown>;
    return { extracted_text: String(p.extracted_text ?? ''), parsed: p };
  } catch { /* continue */ }

  // 2 — truncated / malformed wrapper: manually scan the extracted_text value
  const keyM = cleaned.match(/"extracted_text"\s*:\s*"/);
  if (keyM && keyM.index !== undefined) {
    const start = keyM.index + keyM[0].length;
    let i = start;
    let out = '';
    while (i < cleaned.length) {
      const ch = cleaned[i];
      if (ch === '\\') { out += cleaned.slice(i, i + 2); i += 2; continue; }
      if (ch === '"') break; // proper close — wrapper broke elsewhere
      out += ch; i++;
    }
    const text = unescapeJsonString(out).trim();
    if (text.length >= 40) {
      // try to parse the remainder (classification fields) if the value closed properly
      let rest: Record<string, unknown> | null = null;
      if (i < cleaned.length && cleaned[i] === '"') {
        try {
          const wrapper = cleaned.slice(0, keyM.index) + '"extracted_text":""' + cleaned.slice(i + 1);
          rest = JSON.parse(wrapper) as Record<string, unknown>;
        } catch { rest = null; }
      }
      return { extracted_text: text, parsed: rest };
    }
  }

  // 3 — plain text masquerading as the answer
  const looksJson = /^[[{]/.test(cleaned.trim());
  if (!looksJson && cleaned.trim().length >= 40) {
    return { extracted_text: cleaned.trim(), parsed: null };
  }
  return null;
}

function fallbackClassification(fileName: string): DocClassification {
  return {
    doc_type: 'note', doc_subtype: null, importance: 'standard',
    title: fileName.replace(/\.[a-z0-9]+$/i, ''), title_lo: null, title_fr: null,
    language: 'en', summary: 'OCR salvage — classification pending (text recovered from malformed vision response).',
    keywords: [], tags: ['ocr:vision', 'ocr:salvaged'],
    external_party: null, parties: {},
    valid_from: null, valid_until: null, signed: false,
    reference_number: null, amount: null, amount_currency: null,
    period_year: null, sensitivity: 'confidential',
  } as unknown as DocClassification;
}

async function callAnthropic(body: Record<string, unknown>): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY not set');
  const resp = await fetch(ANTHROPIC_URL, {
    method: 'POST',
    headers: { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!resp.ok) {
    const err = await resp.text();
    throw new Error(`Vision OCR Anthropic ${resp.status}: ${err.slice(0, 300)}`);
  }
  const data = await resp.json() as { content: { type: string; text: string }[] };
  return data.content.find(c => c.type === 'text')?.text ?? '';
}

export async function classifyPdfWithVision(opts: {
  pdfBuffer: Buffer;
  fileName: string;
}): Promise<DocClassification & { extracted_text: string }> {
  // Anthropic limit: 32 MB total request + 100 pages per PDF.
  if (opts.pdfBuffer.byteLength > 30 * 1024 * 1024) {
    throw new Error(`pdf_too_large: ${opts.pdfBuffer.byteLength} bytes (max 30MB for Vision)`);
  }
  const base64 = opts.pdfBuffer.toString('base64');
  const raw = await callAnthropic({
    model: MODEL,
    max_tokens: 32000, // was 8000 — truncated JSON was the #1 stranding cause (D1)
    temperature: 0.1,
    system: SYSTEM_PROMPT,
    messages: [{
      role: 'user',
      content: [
        { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: base64 } },
        { type: 'text', text: `FILENAME: ${opts.fileName}\n\nExtract full text via OCR + classify per schema.` },
      ],
    }],
  });
  const cleaned = raw.trim().replace(/^```(?:json)?\s*/, '').replace(/```$/, '').trim();

  const salvaged = salvageVisionPayload(cleaned);
  if (!salvaged) throw new Error(`Vision OCR returned non-JSON: ${cleaned.slice(0, 200)}`);

  const base = (salvaged.parsed ?? fallbackClassification(opts.fileName)) as DocClassification & { extracted_text: string };
  const parsed: DocClassification & { extracted_text: string } = { ...base } as DocClassification & { extracted_text: string };
  parsed.keywords = Array.isArray(parsed.keywords) ? parsed.keywords.slice(0, 20) : [];
  parsed.tags = Array.isArray(parsed.tags) ? parsed.tags.slice(0, 8) : [];
  parsed.parties = parsed.parties && typeof parsed.parties === 'object' ? parsed.parties : {};
  parsed.extracted_text = (salvaged.extracted_text || '').slice(0, 100_000);
  const salvageTag = salvaged.parsed === null ? ['ocr:salvaged'] : [];
  parsed.tags = [...new Set([...(parsed.tags || []), 'ocr:vision', ...salvageTag])].slice(0, 8);
  return parsed;
}

export type OcrMediaKind =
  | { kind: 'pdf' }
  | { kind: 'image'; mediaType: 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp' };

/**
 * Plain-text OCR (D1/D6) — used by the brain-extract OCR worker for scanned
 * PDFs (whole or page-range segments) and document photos/images.
 */
export async function ocrPlainText(opts: {
  buffer: Buffer;
  fileName: string;
  media: OcrMediaKind;
}): Promise<string> {
  if (opts.buffer.byteLength > 30 * 1024 * 1024) {
    throw new Error(`ocr_too_large: ${opts.buffer.byteLength} bytes (max 30MB)`);
  }
  const base64 = opts.buffer.toString('base64');
  const source = opts.media.kind === 'pdf'
    ? { type: 'document' as const, source: { type: 'base64' as const, media_type: 'application/pdf', data: base64 } }
    : { type: 'image' as const, source: { type: 'base64' as const, media_type: opts.media.mediaType, data: base64 } };
  const raw = await callAnthropic({
    model: MODEL,
    max_tokens: 32000,
    temperature: 0,
    system: PLAIN_TEXT_PROMPT,
    messages: [{
      role: 'user',
      content: [
        source,
        { type: 'text', text: `FILENAME: ${opts.fileName}\n\nReturn the full plain-text content only.` },
      ],
    }],
  });
  const text = raw.trim().replace(/^```[a-z]*\s*/i, '').replace(/```$/, '').trim();
  if (text === '[illegible]') return '';
  return text.slice(0, 400_000);
}