// lib/brain/normalize.ts
// BRAIN v1 · text → clean markdown normalizer + heading-aware chunker.
// Used by /api/cron/brain-extract (normalize) and /api/cron/brain-classify (chunk).
// Pure functions, no IO. NEW file — owned by the brain module.

/** Heuristic: does this line look like a heading? */
function looksLikeHeading(line: string): boolean {
  const t = line.trim();
  if (t.length === 0 || t.length > 90) return false;
  if (/^#{1,6}\s/.test(t)) return true;                          // already md
  if (/^(\d+[\.\)]){1,3}\s+\S/.test(t) && t.length < 70) return true; // 1. / 2.1)
  if (/^[A-Z][A-Z0-9 \-&\/,\.]{6,80}$/.test(t) && !/[a-z]/.test(t)) return true; // ALL CAPS
  if (/^(article|section|clause|schedule|annex|appendix|chapter|part)\s+[\dIVX]+/i.test(t)) return true;
  return false;
}

/**
 * Normalize raw extracted text into readable markdown.
 * - collapses 3+ blank lines, strips trailing spaces
 * - promotes heading-looking lines to `##`
 * - joins hard-wrapped lines inside paragraphs (PDF line breaks)
 */
export function normalizeToMarkdown(raw: string): string {
  if (!raw) return '';
  const cleaned = raw
    .replace(/\r\n?/g, '\n')
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '')
    .replace(/[ \t]+$/gm, '');

  const out: string[] = [];
  const paragraphs = cleaned.split(/\n\s*\n+/);
  for (const para of paragraphs) {
    const lines = para.split('\n').map(l => l.trim()).filter(Boolean);
    if (lines.length === 0) continue;
    // single short heading-ish paragraph → heading
    if (lines.length === 1 && looksLikeHeading(lines[0])) {
      out.push(lines[0].startsWith('#') ? lines[0] : `## ${lines[0]}`);
      continue;
    }
    const buf: string[] = [];
    for (const line of lines) {
      if (looksLikeHeading(line)) {
        if (buf.length) { out.push(buf.join(' ')); buf.length = 0; }
        out.push(line.startsWith('#') ? line : `## ${line}`);
      } else if (/^[-*•●]\s+/.test(line) || /^\d+[\.\)]\s+/.test(line)) {
        if (buf.length) { out.push(buf.join(' ')); buf.length = 0; }
        out.push(line.replace(/^[•●]\s+/, '- '));
      } else {
        buf.push(line);
      }
    }
    if (buf.length) out.push(buf.join(' '));
  }
  return out.join('\n\n').replace(/\n{3,}/g, '\n\n').trim();
}

export type BrainChunk = { chunk_no: number; heading: string | null; text: string };

const TARGET = 1200;
const MAX = 2200;
const MIN = 150;

/**
 * Chunk markdown by headings first, then by size (~1200 chars).
 * Every chunk carries the nearest preceding heading for retrieval context.
 */
export function chunkMarkdown(md: string): BrainChunk[] {
  if (!md || md.trim().length === 0) return [];
  const blocks = md.split(/\n\s*\n/);
  const chunks: BrainChunk[] = [];
  let heading: string | null = null;
  let buf: string[] = [];
  let bufLen = 0;

  const flush = () => {
    const text = buf.join('\n\n').trim();
    if (text.length >= MIN || (text.length > 0 && chunks.length === 0)) {
      chunks.push({ chunk_no: chunks.length, heading, text });
    } else if (text.length > 0 && chunks.length > 0) {
      // too tiny — append to previous chunk
      chunks[chunks.length - 1].text += '\n\n' + text;
    }
    buf = []; bufLen = 0;
  };

  for (const block of blocks) {
    const b = block.trim();
    if (!b) continue;
    const isHeading = /^#{1,6}\s/.test(b);
    if (isHeading) {
      flush();
      heading = b.replace(/^#{1,6}\s*/, '').slice(0, 200);
      continue;
    }
    if (b.length > MAX) {
      // split an overlong block at sentence boundaries
      flush();
      let rest = b;
      while (rest.length > MAX) {
        let cut = rest.lastIndexOf('. ', TARGET);
        if (cut < TARGET * 0.4) cut = TARGET;
        chunks.push({ chunk_no: chunks.length, heading, text: rest.slice(0, cut + 1).trim() });
        rest = rest.slice(cut + 1).trim();
      }
      if (rest) { buf.push(rest); bufLen = rest.length; }
      continue;
    }
    if (bufLen + b.length > TARGET && bufLen > 0) flush();
    buf.push(b);
    bufLen += b.length;
  }
  flush();
  return chunks.filter(c => c.text.length > 0);
}
