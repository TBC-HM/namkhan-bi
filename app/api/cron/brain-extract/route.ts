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
import { ocrPlainText, type OcrMediaKind } from '@/lib/docs/visionOcr';
import { splitPdfForOcr, getPdfPageCount, OCR_MAX_PAGES, OCR_MAX_BYTES } from '@/lib/docs/pdfSplit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

const MAX_PER_RUN = 5;
const MAX_OCR_PER_RUN = 2; // BRAIN v4: vision OCR for scanned PDFs (fn_brain_claim_ocr orders by priority)
const MAX_BYTES = 50 * 1024 * 1024; // 50MB hard cap (raised from 20MB — PBS 2026-07-24, Vigeo 44MB monthly report was invisible)
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

// BRAIN v5 (D6): images Claude vision can read natively. heic/bmp/tiff/svg are
// NOT supported — they stay skipped with a truthful reason.
const OCR_IMAGE_MEDIA: Record<string, OcrMediaKind & { kind: 'image' }> = {
  jpg: { kind: 'image', mediaType: 'image/jpeg' },
  jpeg: { kind: 'image', mediaType: 'image/jpeg' },
  png: { kind: 'image', mediaType: 'image/png' },
  gif: { kind: 'image', mediaType: 'image/gif' },
  webp: { kind: 'image', mediaType: 'image/webp' },
};

function imageMediaOf(fileName: string | null, mime: string | null): (OcrMediaKind & { kind: 'image' }) | null {
  const m = (mime ?? '').toLowerCase();
  if (m === 'image/jpeg' || m === 'image/png' || m === 'image/gif' || m === 'image/webp') {
    return { kind: 'image', mediaType: m as 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp' };
  }
  const ext = (fileName ?? '').toLowerCase().match(/\.([a-z0-9]+)$/)?.[1] ?? '';
  return OCR_IMAGE_MEDIA[ext] ?? null;
}

function kindOf(mime: string | null, fileName: string | null): string {
  const m = (mime ?? '').toLowerCase();
  const f = (fileName ?? '').toLowerCase();
  if (m.includes('pdf') || f.endsWith('.pdf')) return 'pdf';
  if (m.includes('wordprocessingml') || f.endsWith('.docx')) return 'docx';
  if (f.endsWith('.doc')) return 'doc_legacy';
  if (m.includes('spreadsheetml') || f.endsWith('.xlsx') || f.endsWith('.xls')) return 'xlsx';
  if (m.startsWith('image/') || /\.(jpe?g|png|gif|webp|svg|heic)$/.test(f)) return 'image';
  if (m.includes('message/rfc822') || f.endsWith('.eml')) return 'email';
  if (m === 'application/vnd.ms-outlook' || f.endsWith('.msg')) return 'email_msg';
  if (m.includes('html') || f.endsWith('.html') || f.endsWith('.htm')) return 'html';
  if (m.startsWith('text/') || /\.(md|txt|csv|json)$/.test(f)) return 'text';
  return 'unknown';
}

// BRAIN v4 · minimal .eml → text: keep key headers, prefer text/plain MIME part,
// decode quoted-printable, drop base64 attachment blobs.
function emlToText(raw: string): string {
  const headerEnd = raw.search(/\r?\n\r?\n/);
  const headerBlock = headerEnd > 0 ? raw.slice(0, headerEnd) : '';
  const body = headerEnd > 0 ? raw.slice(headerEnd) : raw;
  const keepHeaders = headerBlock.split(/\r?\n(?![ \t])/)
    .filter(h => /^(from|to|cc|subject|date):/i.test(h))
    .map(h => h.replace(/\r?\n[ \t]+/g, ' '));
  // multipart: prefer the text/plain part
  let text = body;
  const boundaryMatch = headerBlock.match(/boundary="?([^";\r\n]+)"?/i);
  if (boundaryMatch) {
    const parts = body.split('--' + boundaryMatch[1]);
    const plain = parts.find(p => /content-type:\s*text\/plain/i.test(p));
    const htmlPart = parts.find(p => /content-type:\s*text\/html/i.test(p));
    const chosen = plain ?? htmlPart;
    if (chosen) {
      const pEnd = chosen.search(/\r?\n\r?\n/);
      let pBody = pEnd > 0 ? chosen.slice(pEnd) : chosen;
      if (/content-transfer-encoding:\s*base64/i.test(chosen.slice(0, Math.max(pEnd, 0)))) {
        try { pBody = Buffer.from(pBody.replace(/\s+/g, ''), 'base64').toString('utf8'); } catch { /* keep raw */ }
      }
      text = !plain && htmlPart ? stripHtml(pBody) : pBody;
    }
  }
  text = text
    .replace(/=\r?\n/g, '')                                   // quoted-printable soft breaks
    .replace(/=([0-9A-F]{2})/g, (_, h) => {
      try { return String.fromCharCode(parseInt(h, 16)); } catch { return ''; }
    })
    .replace(/^[A-Za-z0-9+/=]{200,}$/gm, '[attachment omitted]'); // stray base64 blobs
  return keepHeaders.join('\n') + '\n\n' + text;
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
        await set('skipped', null, { reason: 'too_large_gt_50mb', bytes: row.file_size_bytes });
        continue;
      }
      const kind = kindOf(row.mime, row.file_name ?? row.storage_path);
      if (kind === 'image') {
        // BRAIN v5 (D6): supported images enter the vision-OCR queue instead of
        // being dropped. Unsupported formats stay skipped, truthfully labeled.
        const media = imageMediaOf(row.file_name ?? row.storage_path, row.mime);
        if (media) { await set('ocr_needed', null, { reason: 'image_ocr_queued', media: media.mediaType }); }
        else { await set('skipped', null, { reason: 'unsupported_format', mime: row.mime }); }
        continue;
      }
      if (kind === 'xlsx') { await set('skipped', null, { reason: 'xlsx_unsupported_v1' }); continue; }
      if (kind === 'doc_legacy') { await set('skipped', null, { reason: 'legacy_doc_unsupported' }); continue; }

      const { data: blob, error: dlErr } = await sb.storage.from(row.storage_bucket).download(row.storage_path);
      if (dlErr || !blob) { await set('failed', null, { reason: 'download_failed', detail: dlErr?.message }); continue; }
      const buffer = Buffer.from(await blob.arrayBuffer());
      if (buffer.length === 0) { await set('skipped', null, { reason: 'empty_file', bytes: 0 }); continue; } // D3
      if (buffer.length > MAX_BYTES) { await set('skipped', null, { reason: 'too_large_gt_50mb', bytes: buffer.length }); continue; }

      if (kind === 'email_msg') { await set('skipped', null, { reason: 'outlook_msg_unsupported_v1' }); continue; }

      let text = '';
      if (kind === 'html') {
        text = stripHtml(buffer.toString('utf8'));
      } else if (kind === 'email') {
        text = emlToText(buffer.toString('utf8'));
      } else if (kind === 'text') {
        text = buffer.toString('utf8');
      } else if (kind === 'unknown') {
        // octet-stream etc: try utf8 if mostly printable
        const probe = buffer.subarray(0, 4096).toString('utf8');
        const printable = probe.replace(/[^\x20-\x7E -￿\n\r\t]/g, '').length / Math.max(1, probe.length);
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

  // ── BRAIN v4 · OCR stage — scanned PDFs → Claude vision → extracted_md ──
  // fn_brain_claim_ocr orders by brain_ocr_priority (teach-flagged = 20,
  // menus = 10) then age; guards attempts < 3 and re-claims after 20 min.
  const ocrResults: Array<Record<string, unknown>> = [];
  const { data: ocrClaims, error: ocrErr } = await sb.rpc('fn_brain_claim_ocr', { p_limit: MAX_OCR_PER_RUN });
  if (!ocrErr) {
    for (const row of (ocrClaims ?? []) as Array<{ doc_id: string; storage_bucket: string; storage_path: string; file_name: string | null; attempts: number }>) {
      const t0 = Date.now();
      const setOcr = async (status: string, md: string | null, meta: Record<string, unknown>) => {
        await sb.rpc('fn_brain_set_extraction', {
          p_doc_id: row.doc_id, p_status: status, p_md: md,
          p_meta: { ...meta, worker: 'brain-extract-ocr', duration_ms: Date.now() - t0, at: new Date().toISOString() },
        });
        ocrResults.push({ doc_id: row.doc_id, status, ...meta });
      };
      try {
        const { data: blob, error: dlErr } = await sb.storage.from(row.storage_bucket).download(row.storage_path);
        if (dlErr || !blob) { await setOcr('ocr_needed', null, { ocr_attempts: row.attempts + 1, ocr_error: 'download_failed' }); continue; }
        const buffer = Buffer.from(await blob.arrayBuffer());
        if (buffer.length === 0) { await setOcr('skipped', null, { reason: 'empty_file', bytes: 0 }); continue; } // D3
        const fileName = row.file_name ?? row.storage_path;
        const media = imageMediaOf(fileName, null);

        let text = '';
        let segMeta: Record<string, unknown> = {};
        if (media) {
          // BRAIN v5 (D6): document photos / scans as images. Downscale via
          // sharp (existing dep) when over the ~5MB image cap.
          let img = buffer;
          let mediaType = media.mediaType;
          if (img.length > 4_500_000) {
            const sharp = (await import('sharp')).default;
            img = Buffer.from(await sharp(img).rotate().resize({ width: 3000, height: 3000, fit: 'inside', withoutEnlargement: true }).jpeg({ quality: 82 }).toBuffer());
            mediaType = 'image/jpeg';
            segMeta.downscaled = true;
          }
          text = await ocrPlainText({ buffer: img, fileName, media: { kind: 'image', mediaType } });
        } else {
          // PDF path — split when over the Anthropic page/byte limits (D2).
          let pageCount: number | null = null;
          try { pageCount = await getPdfPageCount(buffer); } catch { pageCount = null; }
          if (pageCount !== null && (pageCount > OCR_MAX_PAGES || buffer.length > OCR_MAX_BYTES)) {
            const segments = await splitPdfForOcr(buffer);
            const parts: string[] = [];
            for (const seg of segments) {
              const t = await ocrPlainText({ buffer: seg.buffer, fileName: `${fileName} (pages ${seg.pageFrom}-${seg.pageTo})`, media: { kind: 'pdf' } });
              if (t.trim().length > 0) parts.push(t.trim());
            }
            text = parts.join('\n\n');
            segMeta = { segments: segments.length, pages: pageCount };
          } else {
            text = await ocrPlainText({ buffer, fileName, media: { kind: 'pdf' } });
            if (pageCount !== null) segMeta = { pages: pageCount };
          }
        }

        const md = normalizeToMarkdown(text.trim()).slice(0, 400_000);
        if (md.length < 40) {
          const attempts = row.attempts + 1;
          await setOcr(attempts >= 3 ? 'failed' : 'ocr_needed', null, { ocr_attempts: attempts, ocr_error: 'vision_empty' });
          continue;
        }
        await setOcr('extracted', md, { source: 'vision_ocr', chars: md.length, ocr_attempts: row.attempts + 1, ...segMeta });
      } catch (e) {
        const attempts = row.attempts + 1;
        await setOcr(attempts >= 3 ? 'failed' : 'ocr_needed', null, {
          ocr_attempts: attempts, ocr_error: e instanceof Error ? e.message.slice(0, 250) : 'err',
        });
      }
    }
  }

  return NextResponse.json({ ok: true, claimed: (claims ?? []).length, results, ocr: ocrResults, ocr_error: ocrErr?.message });
}

export async function POST(req: NextRequest) { return run(req); }
export async function GET(req: NextRequest) { return run(req); }