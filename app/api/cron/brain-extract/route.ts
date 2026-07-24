// app/api/cron/brain-extract/route.ts
// BRAIN v1 · overnight extraction worker (the "MD shadow doc" agent).
// Claims up to 5 dms docs with extraction_status='pending', downloads the file
// from storage, extracts text (pdf-parse / mammoth / plain), normalizes to
// markdown and writes dms.documents.extracted_md via the public.fn_brain_*
// bridges (rule §0.5 — no .schema('dms') access). NEVER touches any
// pre-existing dms column.
//
// Auth: x-cron-secret (CRON_SHARED_SECRET) — same pattern as
// /api/cron/write-pending-drafts. Fired by pg_cron 'brain-extract-5min'.

import { NextResponse, type NextRequest } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { extractText } from '@/lib/docs/extract';
import { normalizeToMarkdown } from '@/lib/brain/normalize';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

const MAX_PER_RUN = 5;
const MAX_BYTES = 20 * 1024 * 1024; // 20MB hard cap
const MIN_PDF_TEXT = 120;           // below this a PDF is treated as scanned → ocr_needed

function checkCronSecret(req: NextRequest): boolean {
  const provided = req.headers.get('x-cron-secret') ?? '';
  if (!provided) return false;
  const envSecret = process.env.CRON_SHARED_SECRET ?? process.env.CRON_SECRET ?? '';
  if (!envSecret) return false;
  return provided === envSecret;
}

type ClaimRow = {
  doc_id: string; storage_bucket: string | null; storage_path: string | null;
  mime: string | null; file_name: string | null; file_size_bytes: number | null;
  title: string | null; body_markdown: string | null;
};

function kindOf(mime: string | null, fileName: string | null): string {
  const m = (mime ?? '').toLowerCase();
  const f = (fileName ?? '').toLowerCase();
  if (m.includes('pdf') || f.endsWith('.pdf')) return 'pdf';
  if (m.includes('wordprocessingml') || f.endsWith('.docx')) return 'docx';
  if (f.endsWith('.doc')) return 'doc_legacy';
  if (m.includes('spreadsheetml') || f.endsWith('.xlsx') || f.endsWith('.xls')) return 'xlsx';
  if (m.startsWith('image/') || /\.(jpe?g|png|gif|webp|svg|heic)$/.test(f)) return 'image';
  if (m.includes('html') || f.endsWith('.html') || f.endsWith('.htm')) return 'html';
  if (m.startsWith('text/') || /\.(md|txt|csv|json)$/.test(f)) return 'text';
  return 'unknown';
}

function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<\/(p|div|h[1-6]|li|tr|br)>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>');
}

async function run(req: NextRequest): Promise<NextResponse> {
  if (!checkCronSecret(req)) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
  }
  const sb = getSupabaseAdmin();
  const { data: claims, error } = await sb.rpc('fn_brain_claim_extract', { p_limit: MAX_PER_RUN });
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

  const results: Array<Record<string, unknown>> = [];
  for (const row of (claims ?? []) as ClaimRow[]) {
    const t0 = Date.now();
    const set = async (status: string, md: string | null, meta: Record<string, unknown>) => {
      await sb.rpc('fn_brain_set_extraction', {
        p_doc_id: row.doc_id, p_status: status, p_md: md,
        p_meta: { ...meta, worker: 'brain-extract', duration_ms: Date.now() - t0, at: new Date().toISOString() },
      });
      results.push({ doc_id: row.doc_id, status, ...meta });
    };

    try {
      // body_markdown fallback (fast-path normally handles this in SQL)
      if (!row.storage_path || !row.storage_bucket) {
        if (row.body_markdown && row.body_markdown.length > 50) {
          await set('extracted', row.body_markdown, { source: 'body_markdown' });
        } else {
          await set('skipped', null, { reason: 'no_source' });
        }
        continue;
      }
      if ((row.file_size_bytes ?? 0) > MAX_BYTES) {
        await set('skipped', null, { reason: 'too_large_gt_20mb', bytes: row.file_size_bytes });
        continue;
      }
      const kind = kindOf(row.mime, row.file_name ?? row.storage_path);
      if (kind === 'image') { await set('skipped', null, { reason: 'image_no_text' }); continue; }
      if (kind === 'xlsx') { await set('skipped', null, { reason: 'xlsx_unsupported_v1' }); continue; }
      if (kind === 'doc_legacy') { await set('skipped', null, { reason: 'legacy_doc_unsupported' }); continue; }

      const { data: blob, error: dlErr } = await sb.storage.from(row.storage_bucket).download(row.storage_path);
      if (dlErr || !blob) { await set('failed', null, { reason: 'download_failed', detail: dlErr?.message }); continue; }
      const buffer = Buffer.from(await blob.arrayBuffer());
      if (buffer.length > MAX_BYTES) { await set('skipped', null, { reason: 'too_large_gt_20mb', bytes: buffer.length }); continue; }

      let text = '';
      if (kind === 'html') {
        text = stripHtml(buffer.toString('utf8'));
      } else if (kind === 'text') {
        text = buffer.toString('utf8');
      } else if (kind === 'unknown') {
        // octet-stream etc: try utf8 if mostly printable
        const probe = buffer.subarray(0, 4096).toString('utf8');
        const printable = probe.replace(/[^\x20-\x7E\u00A0-\uFFFF\n\r\t]/g, '').length / Math.max(1, probe.length);
        if (printable > 0.9) text = buffer.toString('utf8');
        else { await set('skipped', null, { reason: 'unknown_binary_format', mime: row.mime }); continue; }
      } else {
        text = await extractText({ buffer, mimeType: row.mime ?? '', fileName: row.file_name ?? row.storage_path });
      }

      const trimmed = (text ?? '').trim();
      if (kind === 'pdf' && trimmed.length < MIN_PDF_TEXT) {
        await set('ocr_needed', null, { reason: 'pdf_no_text_layer', chars: trimmed.length, bytes: buffer.length });
        continue;
      }
      if (trimmed.length === 0) {
        await set('failed', null, { reason: 'empty_extraction', kind, bytes: buffer.length });
        continue;
      }
      const md = normalizeToMarkdown(trimmed).slice(0, 800_000);
      await set('extracted', md, { source: kind, chars: md.length, bytes: buffer.length });
    } catch (e) {
      await set('failed', null, { reason: 'exception', detail: e instanceof Error ? e.message.slice(0, 300) : String(e).slice(0, 300) });
    }
  }

  return NextResponse.json({ ok: true, claimed: (claims ?? []).length, results });
}

export async function POST(req: NextRequest) { return run(req); }
export async function GET(req: NextRequest) { return run(req); }
