// app/api/docs/reindex/route.ts
// POST /api/docs/reindex
// ----------------------------------------------------------------------------
// Re-runs extraction + Vision OCR + chunking on an existing doc row.
// Used to backfill body_markdown for docs uploaded BEFORE Vision OCR shipped,
// or that landed with empty text for any reason.
//
// Body: { doc_id: uuid }  OR  { doc_ids: uuid[] }  (max 5 per call)
// Returns: per-doc result with new body_chars + chunk_count, or an error stage.
// ----------------------------------------------------------------------------

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { extractText } from '@/lib/docs/extract';
import { classifyPdfWithVision } from '@/lib/docs/visionOcr';
import { chunkBody } from '@/lib/docs/chunker';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 90;

async function reindexOne(admin: any, doc_id: string) {
  // 1. Load the row
  const { data: row, error: selErr } = await admin
    .schema('docs')
    .from('documents')
    .select('doc_id, storage_bucket, storage_path, mime, file_name, file_size_bytes')
    .eq('doc_id', doc_id)
    .single();
  if (selErr || !row) return { ok: false, doc_id, error: selErr?.message ?? 'not found' };
  if (!row.storage_bucket || !row.storage_path) {
    return { ok: false, doc_id, error: 'no storage_bucket / storage_path on row' };
  }

  // 2. Download from storage
  const { data: blob, error: dlErr } = await admin.storage
    .from(row.storage_bucket)
    .download(row.storage_path);
  if (dlErr || !blob) {
    return { ok: false, doc_id, stage: 'download', error: dlErr?.message ?? 'download failed' };
  }
  const buffer = Buffer.from(await blob.arrayBuffer());

  // 3. Try text-layer extraction first
  let extractedText = await extractText({
    buffer,
    mimeType: row.mime || 'application/pdf',
    fileName: row.file_name || 'untitled.pdf',
  });
  let usedVisionOcr = false;

  // 4. Vision OCR fallback for PDFs ≤30 MB
  const isPdf = (row.mime === 'application/pdf') ||
                (row.file_name || '').toLowerCase().endsWith('.pdf') ||
                (row.mime === 'application/octet-stream');
  const fitsVision = (row.file_size_bytes ?? buffer.byteLength) <= 30 * 1024 * 1024;
  if (isPdf && fitsVision && extractedText.length < 200) {
    try {
      const v = await classifyPdfWithVision({
        pdfBuffer: buffer,
        fileName: row.file_name || 'untitled.pdf',
      });
      extractedText = v.extracted_text || '';
      usedVisionOcr = true;
    } catch (e: any) {
      // Vision failed — keep whatever text-layer gave us
      console.error('[docs/reindex] vision ocr failed:', doc_id, e?.message);
    }
  }

  if (extractedText.length < 200) {
    return {
      ok: false, doc_id, stage: 'extraction',
      error: `still empty after extract+vision (${extractedText.length} chars)`,
      vision_ocr: usedVisionOcr,
    };
  }

  // 5. UPDATE body_markdown
  const { error: upErr } = await admin
    .schema('docs')
    .from('documents')
    .update({
      body_markdown: extractedText.slice(0, 200_000),
      raw: { reindexed_at: new Date().toISOString(), vision_ocr: usedVisionOcr },
    })
    .eq('doc_id', doc_id);
  if (upErr) return { ok: false, doc_id, stage: 'update', error: upErr.message };

  // 6. DELETE old chunks then INSERT fresh
  await admin.schema('docs').from('chunks').delete().eq('doc_id', doc_id);
  const chunks = chunkBody(extractedText.slice(0, 200_000));
  if (chunks.length > 0) {
    const rows = chunks.map(c => ({
      doc_id,
      chunk_idx: c.chunk_idx,
      page_num: c.page_num,
      content: c.content,
      char_start: c.char_start,
      char_end: c.char_end,
    }));
    const { error: chErr } = await admin.schema('docs').from('chunks').insert(rows);
    if (chErr) return { ok: false, doc_id, stage: 'chunks', error: chErr.message };
  }

  return {
    ok: true, doc_id,
    body_chars: extractedText.length,
    chunks: chunks.length,
    vision_ocr: usedVisionOcr,
  };
}

export async function POST(req: NextRequest) {
  let admin;
  try { admin = getSupabaseAdmin(); }
  catch (e: any) { return NextResponse.json({ ok: false, error: e.message }, { status: 500 }); }

  let body: { doc_id?: string; doc_ids?: string[] };
  try { body = await req.json(); }
  catch { return NextResponse.json({ ok: false, error: 'invalid_json' }, { status: 400 }); }

  const ids = body.doc_ids ?? (body.doc_id ? [body.doc_id] : []);
  if (ids.length === 0) return NextResponse.json({ ok: false, error: 'missing doc_id(s)' }, { status: 400 });
  if (ids.length > 5) return NextResponse.json({ ok: false, error: 'max 5 per call' }, { status: 400 });

  // Process serially to avoid hammering Anthropic
  const results = [];
  for (const id of ids) {
    results.push(await reindexOne(admin, id));
  }

  return NextResponse.json({
    ok: true,
    processed: results.length,
    succeeded: results.filter(r => r.ok).length,
    results,
  });
}
