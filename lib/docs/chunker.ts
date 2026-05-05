// lib/docs/chunker.ts
// Splits a doc body into paragraph-level chunks for fine-grained retrieval.
//
// Strategy: split on blank lines (paragraphs), then merge tiny paragraphs
// with their neighbors so each chunk is between MIN and MAX chars.
// No embeddings — chunks are indexed via tsv (see docs.chunks_tsv_build()).

const MIN_CHARS = 200;   // anything shorter gets merged
const MAX_CHARS = 2400;  // anything longer gets split at sentence boundary
const TARGET    = 1200;  // sweet spot

export type Chunk = {
  chunk_idx: number;
  page_num: number | null;
  content: string;
  char_start: number;
  char_end: number;
};

export function chunkBody(body: string): Chunk[] {
  if (!body || body.length < MIN_CHARS) {
    return body && body.length > 0
      ? [{ chunk_idx: 0, page_num: null, content: body, char_start: 0, char_end: body.length }]
      : [];
  }

  // Split into paragraphs (blank lines)
  const paragraphs = body.split(/\n\s*\n/);

  // Merge runs of short paragraphs + split overlong ones
  const out: Chunk[] = [];
  let bufStart = 0;
  let bufLen = 0;
  let bufLines: string[] = [];
  let cursor = 0;

  const flush = (forceEmpty = false) => {
    const txt = bufLines.join('\n\n').trim();
    if (txt.length > 0 || forceEmpty) {
      out.push({
        chunk_idx: out.length,
        page_num: null,
        content: txt,
        char_start: bufStart,
        char_end: bufStart + txt.length,
      });
    }
    bufLines = [];
    bufLen = 0;
    bufStart = cursor;
  };

  for (const para of paragraphs) {
    const p = para.trim();
    if (!p) { cursor += para.length + 2; continue; }

    if (p.length > MAX_CHARS) {
      // Flush current buffer first
      if (bufLen > 0) flush();
      // Split overlong paragraph at sentence boundaries
      const sentences = p.split(/(?<=[.!?])\s+(?=[A-ZÀ-ÿ])/);
      let acc = '';
      let accStart = cursor;
      for (const s of sentences) {
        if (acc.length + s.length + 1 > MAX_CHARS && acc.length > 0) {
          out.push({
            chunk_idx: out.length, page_num: null,
            content: acc.trim(),
            char_start: accStart, char_end: accStart + acc.length,
          });
          accStart += acc.length;
          acc = s;
        } else {
          acc += (acc ? ' ' : '') + s;
        }
      }
      if (acc.trim().length > 0) {
        out.push({
          chunk_idx: out.length, page_num: null,
          content: acc.trim(),
          char_start: accStart, char_end: accStart + acc.length,
        });
      }
      cursor += para.length + 2;
      bufStart = cursor;
      continue;
    }

    // Normal paragraph — append to buffer; flush when target hit
    bufLines.push(p);
    bufLen += p.length;
    cursor += para.length + 2;
    if (bufLen >= TARGET) flush();
  }
  if (bufLen > 0) flush();

  return out.filter(c => c.content.length >= 50); // drop noise
}
