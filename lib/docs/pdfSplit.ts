// lib/docs/pdfSplit.ts
// BRAIN v5 (autospec-brain_module-20260725 · D2): split oversized PDFs into
// page-range segments so Vision OCR can process docs beyond the Anthropic
// hard limits (100 pages / ~30MB request). Uses pdf-lib (already a dependency
// — no new packages, Dependency Law).
//
// Pure helpers, no I/O — unit-testable without a browser or network.

import { PDFDocument } from 'pdf-lib';

/** Anthropic PDF limits with safety margin. */
export const OCR_MAX_PAGES = 90;          // hard limit 100
export const OCR_MAX_BYTES = 20 * 1024 * 1024; // hard limit ~32MB request incl. base64 overhead
export const OCR_SEGMENT_PAGES = 60;      // default pages per segment
export const OCR_MAX_SEGMENTS = 8;        // worker time budget guard (maxDuration 300s)

export type PdfSegment = { buffer: Buffer; pageFrom: number; pageTo: number };

export async function getPdfPageCount(buffer: Buffer): Promise<number> {
  const doc = await PDFDocument.load(buffer, { ignoreEncryption: true, updateMetadata: false });
  return doc.getPageCount();
}

/** Decide segment size (in pages) from page count + byte size. Pure. */
export function planSegments(pageCount: number, byteLength: number, opts?: {
  maxPages?: number; maxBytes?: number; segmentPages?: number;
}): Array<{ pageFrom: number; pageTo: number }> {
  const maxPages = opts?.maxPages ?? OCR_MAX_PAGES;
  const maxBytes = opts?.maxBytes ?? OCR_MAX_BYTES;
  const segDefault = opts?.segmentPages ?? OCR_SEGMENT_PAGES;
  if (pageCount <= maxPages && byteLength <= maxBytes) {
    return [{ pageFrom: 1, pageTo: pageCount }];
  }
  // bytes-per-page estimate: scanned PDFs are dominated by per-page images,
  // so a proportional estimate is good enough to stay under the request cap.
  const bytesPerPage = Math.max(1, Math.ceil(byteLength / Math.max(1, pageCount)));
  const pagesByBytes = Math.max(1, Math.floor((maxBytes * 0.85) / bytesPerPage));
  const pagesPerSeg = Math.max(1, Math.min(segDefault, maxPages, pagesByBytes));
  const out: Array<{ pageFrom: number; pageTo: number }> = [];
  for (let from = 1; from <= pageCount; from += pagesPerSeg) {
    out.push({ pageFrom: from, pageTo: Math.min(pageCount, from + pagesPerSeg - 1) });
  }
  return out;
}

/**
 * Split a PDF into OCR-sized segments. Returns a single whole-file segment
 * when the file already fits. Throws with a clear message when pdf-lib cannot
 * parse the file (caller records a truthful terminal reason).
 */
export async function splitPdfForOcr(buffer: Buffer, opts?: {
  maxPages?: number; maxBytes?: number; segmentPages?: number; maxSegments?: number;
}): Promise<PdfSegment[]> {
  const src = await PDFDocument.load(buffer, { ignoreEncryption: true, updateMetadata: false });
  const pageCount = src.getPageCount();
  const plan = planSegments(pageCount, buffer.byteLength, opts);
  if (plan.length === 1 && plan[0].pageFrom === 1 && plan[0].pageTo === pageCount
      && buffer.byteLength <= (opts?.maxBytes ?? OCR_MAX_BYTES)) {
    return [{ buffer, pageFrom: 1, pageTo: pageCount }];
  }
  const maxSegments = opts?.maxSegments ?? OCR_MAX_SEGMENTS;
  if (plan.length > maxSegments) {
    throw new Error(`pdf_split_too_many_segments: ${plan.length} segments for ${pageCount} pages / ${buffer.byteLength} bytes (max ${maxSegments})`);
  }
  const segments: PdfSegment[] = [];
  for (const seg of plan) {
    const out = await PDFDocument.create();
    const idx: number[] = [];
    for (let p = seg.pageFrom - 1; p <= seg.pageTo - 1; p++) idx.push(p);
    const pages = await out.copyPages(src, idx);
    for (const pg of pages) out.addPage(pg);
    const bytes = await out.save({ useObjectStreams: true });
    segments.push({ buffer: Buffer.from(bytes), pageFrom: seg.pageFrom, pageTo: seg.pageTo });
  }
  return segments;
}