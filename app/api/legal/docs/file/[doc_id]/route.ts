// app/api/legal/docs/file/[doc_id]/route.ts
// Bridges the private dms-docs bucket to the browser via short-lived signed
// URLs. Two modes:
//   ?mode=preview  (default) → open inline in a new tab (PDFs / images render)
//   ?mode=download           → force "Save as…" with the original file_name
//
// All auth happens server-side via getSupabaseAdmin() so the service-role key
// never reaches the client. The route returns a 302 redirect to the signed URL.

import { NextResponse, type NextRequest } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

const SIGNED_TTL = 300; // 5 minutes — enough to click + download once

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
  if (!row.storage_bucket || !row.storage_path) {
    // Markdown-native documents (SOP registry backfill, distilled/extracted docs) have no storage
    // object. 2,080 of 22,031 docs are in this state and 241 of them are cited by the brain, so a
    // 404 here breaks every one of those citations. Fall back to rendering the markdown body.
    const { data: mdRows, error: mdErr } = await supabase.rpc('fn_doc_markdown', { p_doc_id: docId });
    const md = (Array.isArray(mdRows) ? mdRows[0] : mdRows) as {
      title: string | null; doc_type: string | null; body_md: string | null; body_source: string | null;
    } | null;
    if (mdErr || !md?.body_md) {
      return NextResponse.json({ error: 'doc has no stored file and no markdown body' }, { status: 404 });
    }
    const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const html = `<!doctype html><meta charset="utf-8"><title>${esc(md.title ?? 'Document')}</title>`
      + `<meta name="viewport" content="width=device-width,initial-scale=1">`
      + `<style>body{margin:0;background:#FAF8F2;color:#1a1a1a;font:15px/1.6 ui-sans-serif,system-ui,-apple-system,sans-serif}`
      + `main{max-width:820px;margin:0 auto;padding:32px 24px 64px}`
      + `h1{font-size:22px;margin:0 0 4px}`
      + `.meta{font:11px ui-monospace,monospace;color:#6b6b6b;letter-spacing:.06em;margin-bottom:24px}`
      + `pre{white-space:pre-wrap;word-wrap:break-word;font:14px/1.7 ui-sans-serif,system-ui,sans-serif;margin:0}`
      + `</style>`
      + `<main><h1>${esc(md.title ?? 'Document')}</h1>`
      + `<div class="meta">${esc(md.doc_type ?? 'doc')} · rendered from ${esc(md.body_source ?? 'markdown')} · no stored file</div>`
      + `<pre>${esc(md.body_md)}</pre></main>`;
    return new NextResponse(html, {
      status: 200,
      headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' },
    });
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

  // 302 so the browser navigates to the signed URL. Cache-busting headers so
  // a refresh re-mints (signed URL is short-lived but we don't want any proxy
  // pinning a stale one).
  const res = NextResponse.redirect(signed.signedUrl, 302);
  res.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate');
  return res;
}
