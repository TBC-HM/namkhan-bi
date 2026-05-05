// lib/docs/visionOcr.ts
// Sends a PDF directly to Claude Haiku 4.5 for OCR + classification in one call.
// Used as fallback when pdf-parse returns < 200 chars (scanned/image-only PDFs).
//
// Claude Haiku 4.5 supports PDF input natively via {type:'document'} content blocks
// — no image conversion, no Tesseract, just send the bytes.

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

export async function classifyPdfWithVision(opts: {
  pdfBuffer: Buffer;
  fileName: string;
}): Promise<DocClassification & { extracted_text: string }> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY not set');

  // Anthropic limit: 32 MB total request + 100 pages per PDF.
  // Reject files that won't fit (caller should fall back to filename-only classify).
  if (opts.pdfBuffer.byteLength > 30 * 1024 * 1024) {
    throw new Error(`pdf_too_large: ${opts.pdfBuffer.byteLength} bytes (max 30MB for Vision)`);
  }

  const base64 = opts.pdfBuffer.toString('base64');

  const resp = await fetch(ANTHROPIC_URL, {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 8000,
      temperature: 0.1,
      system: SYSTEM_PROMPT,
      messages: [{
        role: 'user',
        content: [
          {
            type: 'document',
            source: { type: 'base64', media_type: 'application/pdf', data: base64 },
          },
          {
            type: 'text',
            text: `FILENAME: ${opts.fileName}\n\nExtract full text via OCR + classify per schema.`,
          },
        ],
      }],
    }),
  });

  if (!resp.ok) {
    const err = await resp.text();
    throw new Error(`Vision OCR Anthropic ${resp.status}: ${err.slice(0, 300)}`);
  }

  const data = await resp.json() as { content: { type: string; text: string }[] };
  const raw = data.content.find(c => c.type === 'text')?.text ?? '';
  const cleaned = raw.trim().replace(/^```(?:json)?\s*/, '').replace(/```$/, '').trim();

  let parsed: DocClassification & { extracted_text: string };
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    throw new Error(`Vision OCR returned non-JSON: ${cleaned.slice(0, 200)}`);
  }

  parsed.keywords = Array.isArray(parsed.keywords) ? parsed.keywords.slice(0, 20) : [];
  parsed.tags = Array.isArray(parsed.tags) ? parsed.tags.slice(0, 8) : [];
  parsed.parties = parsed.parties && typeof parsed.parties === 'object' ? parsed.parties : {};
  parsed.extracted_text = (parsed.extracted_text || '').slice(0, 100_000);
  // Tag so we can spot OCR-derived rows later
  parsed.tags = [...new Set([...(parsed.tags || []), 'ocr:vision'])].slice(0, 8);

  return parsed;
}
