// app/api/legal/docs/file/[doc_id]/route.ts
// Bridges the private dms-docs bucket to the browser via short-lived signed
// URLs. Two modes:
//   ?mode=preview  (default) → show it in the browser
//   ?mode=download           → force "Save as…" with the original file_name
//
// All auth happens server-side via getSupabaseAdmin() so the service-role key
// never reaches the client.
//
// PBS 2026-09-15: "a big part of the documents the preview does not work". Measured on the
// marketing library (306 files) the cause was NOT missing storage — 305 of 306 objects exist.
// It was two things:
//
//   1. 103 files (34%) are .docx/.xlsx/.pptx/.ai/.eps. No browser renders those inline; a signed
//      URL can only download them. 95 of those have extracted text, so preview now renders the
//      TEXT instead of handing over a binary that does nothing.
//   2. 15 PDFs are stored with mimetype application/octet-stream, so the browser downloads them
//      instead of displaying them. dms.documents.mime does NOT mirror the storage object's
//      content-type, so the route cannot detect this — it therefore SERVES renderable types
//      itself with a Content-Type derived from the extension, rather than redirecting and hoping
//      the stored metadata is right. The body is streamed, so a 48 MB PDF costs no extra memory.
import { NextResponse, type NextRequest } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

const SIGNED_TTL = 300; // 5 minutes — enough to click + download once

/** Types a browser renders inline. Everything else can only be downloaded. */
const CONTENT_TYPE: Record<string, string> = {
  pdf: 'application/pdf',
  png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg',
  gif: 'image/gif', webp: 'image/webp', svg: 'image/svg+xml',
  txt: 'text/plain; charset=utf-8', csv: 'text/csv; charset=utf-8',
  md: 'text/plain; charset=utf-8', html: 'text/html; charset=utf-8',
};

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** Readable text view — used for markdown-native docs AND for Office files a browser cannot show. */
function textPage(opts: {
  title: string; meta: string; body: string; note?: string; downloadHref?: string;
}) {
  const html = `<!doctype html><meta charset="utf-8"><title>${esc(opts.title)}</title>`
    + `<meta name="viewport" content="width=device-width,initial-scale=1">`
    + `<style>body{margin:0;background:#FAF8F2;color:#1a1a1a;font:15px/1.6 ui-sans-serif,system-ui,-apple-system,sans-serif}`
    + `main{max-width:820px;margin:0 auto;padding:32px 24px 64px}`
    + `h1{font-size:22px;margin:0 0 4px}`
    + `.meta{font:11px ui-monospace,monospace;color:#6b6b6b;letter-spacing:.06em;margin-bottom:16px}`
    + `.note{background:#F3EFE2;border:1px solid #E6DFCC;border-radius:6px;padding:10px 12px;`
    + `font-size:13px;margin-bottom:20px}`
    + `.note a{color:#1F3A2E;font-weight:600}`
    + `pre{white-space:pre-wrap;word-wrap:break-word;font:14px/1.7 ui-sans-serif,system-ui,sans-serif;margin:0}`
    + `</style>`
    + `<main><h1>${esc(opts.title)}</h1>`
    + `<div class="meta">${esc(opts.meta)}</div>`
    + (opts.note
        ? `<div class="note">${esc(opts.note)}`
          + (opts.downloadHref ? ` <a href="${esc(opts.downloadHref)}">Download the original</a>.` : '')
          + `</div>`
        : '')
    + `<pre>${esc(opts.body)}</pre></main>`;
  return new NextResponse(html, {
    status: 200,
    headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' },
  });
}

export async function GET(req: NextRequest, { params }: { params: { doc_id: string } }) {
  const docId = params.doc_id;
  if (!docId) return NextResponse.json({ error: 'doc_id required' }, { status: 400 });

  const mode = req.nextUrl.searchParams.get('mode') === 'download' ? 'download' : 'preview';

  const supabase = getSupabaseAdmin();
  // dms.documents isn't in the PostgREST-exposed public schema (§0.5), so the
  // four file fields are resolved through this thin SECURITY DEFINER RPC.
  const { data: rows, error: rpcErr } = await supabase
    .rpc('fn_doc_file_info', { p_doc_id: docId });

  if (rpcErr) {
    return NextResponse.json({ error: 'lookup failed', detail: rpcErr.message }, { status: 500 });
  }
  const row = (Array.isArray(rows) ? rows[0] : rows) as {
    storage_bucket: string | null; storage_path: string | null; file_name: string | null; mime: string | null;
  } | null;
  if (!row) {
    return NextResponse.json({ error: 'doc not found' }, { status: 404 });
  }

  const ext = (row.file_name ?? '').toLowerCase().replace(/^.*\./, '');
  const renderable = Object.prototype.hasOwnProperty.call(CONTENT_TYPE, ext);

  async function readText() {
    const { data: mdRows } = await supabase.rpc('fn_doc_markdown', { p_doc_id: docId });
    return (Array.isArray(mdRows) ? mdRows[0] : mdRows) as {
      title: string | null; doc_type: string | null; body_md: string | null; body_source: string | null;
    } | null;
  }

  if (!row.storage_bucket || !row.storage_path) {
    // Markdown-native documents (SOP registry backfill, distilled/extracted docs) have no storage
    // object. 2,080 of 22,031 docs are in this state and 241 of them are cited by the brain, so a
    // 404 here breaks every one of those citations. Fall back to rendering the markdown body.
    const md = await readText();
    if (!md?.body_md) {
      return NextResponse.json({ error: 'doc has no stored file and no markdown body' }, { status: 404 });
    }
    return textPage({
      title: md.title ?? 'Document',
      meta: `${md.doc_type ?? 'doc'} · rendered from ${md.body_source ?? 'markdown'} · no stored file`,
      body: md.body_md,
    });
  }

  // A browser cannot display .docx/.xlsx/.pptx/.ai/.eps. Show the extracted text instead of
  // redirecting to a binary that silently downloads or opens blank.
  if (mode === 'preview' && !renderable) {
    const md = await readText();
    if (md?.body_md) {
      return textPage({
        title: md.title ?? row.file_name ?? 'Document',
        meta: `${row.file_name ?? ''} · text extract`,
        body: md.body_md,
        note: `This is a .${ext || 'binary'} file — browsers cannot display it, so the extracted text is shown.`,
        downloadHref: `/api/legal/docs/file/${docId}?mode=download`,
      });
    }
    // No text either: fall through and let the browser download it.
  }

  // Supabase Storage signed URL — `download` option flips Content-Disposition
  // from inline → attachment with the given filename.
  const opts: { download?: string | boolean } = mode === 'download'
    ? { download: row.file_name ?? 'document' }
    : {};

  const { data: signed, error: signErr } = await supabase.storage
    .from(row.storage_bucket)
    .createSignedUrl(row.storage_path, SIGNED_TTL, opts);

  if (signErr || !signed?.signedUrl) {
    return NextResponse.json({ error: 'sign failed', detail: signErr?.message }, { status: 500 });
  }

  // Serve renderable types ourselves so the Content-Type is right. 15 library PDFs are stored as
  // application/octet-stream and a redirect would download them. Streamed, never buffered.
  if (mode === 'preview' && renderable) {
    try {
      const upstream = await fetch(signed.signedUrl);
      if (upstream.ok && upstream.body) {
        return new NextResponse(upstream.body, {
          status: 200,
          headers: {
            'Content-Type': CONTENT_TYPE[ext],
            'Content-Disposition': `inline; filename="${(row.file_name ?? 'document').replace(/"/g, '')}"`,
            'Cache-Control': 'private, max-age=60',
          },
        });
      }
    } catch {
      // fall through to the redirect below
    }
  }

  // 302 so the browser navigates to the signed URL. Cache-busting headers so
  // a refresh re-mints (signed URL is short-lived but we don't want any proxy
  // pinning a stale one).
  const res = NextResponse.redirect(signed.signedUrl, 302);
  res.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate');
  return res;
}
