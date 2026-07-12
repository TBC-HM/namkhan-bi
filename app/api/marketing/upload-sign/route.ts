// POST /api/marketing/upload-sign
// Signed-URL upload flow — bypasses Vercel's 4.5 MB function body cap.
//
// Browser sends ONLY the file metadata (filename + mime + size + sha256).
// Server validates, then calls SECURITY DEFINER RPC public.fn_media_asset_upload_signup
// (dedup check + row insert in media.media_assets) and mints a signed upload URL for
// media-raw bucket. Browser then PUTs the actual bytes direct to Storage.
//
// 2026-07-12 pm: previous fix used `sb.schema('media' as any)` — this fails because
// PostgREST exposes only `public` (plus a couple of exceptions). Third time we've been
// burned on this. Now routing all media_assets writes through a public.fn_* RPC.
// See memory: feedback_postgrest_schema_writes_repeat_burn.

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Must stay in sync with storage.buckets['media-raw'].allowed_mime_types.
const ALLOWED_MIME = new Set([
  // Photos
  'image/jpeg', 'image/png', 'image/heic', 'image/heif', 'image/webp', 'image/gif', 'image/tiff',
  // RAW
  'image/x-canon-cr2', 'image/x-canon-cr3', 'image/x-nikon-nef', 'image/x-sony-arw',
  'image/x-adobe-dng', 'image/x-fuji-raf', 'image/x-panasonic-rw2',
  // Video
  'video/mp4', 'video/quicktime', 'video/webm', 'video/x-msvideo', 'video/x-matroska',
  'video/mpeg', 'video/3gpp', 'video/mp2t', 'video/x-m4v', 'application/mxf',
  // Documents
  'application/pdf',
]);

const MAX_BYTES = 5 * 1024 * 1024 * 1024; // 5 GB — matches media-raw bucket cap

export async function POST(req: NextRequest) {
  let admin;
  try { admin = getSupabaseAdmin(); }
  catch (e: any) { return NextResponse.json({ error: e.message }, { status: 500 }); }

  let body: {
    filename?: string; content_type?: string; size?: number; sha256?: string;
    photographer?: string; license?: string; campaign_tag?: string;
  };
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: 'invalid_json' }, { status: 400 }); }

  const { filename, content_type, size, sha256 } = body;
  if (!filename || !content_type || !size || !sha256) {
    return NextResponse.json({ error: 'missing_fields' }, { status: 400 });
  }
  if (!ALLOWED_MIME.has(content_type)) {
    return NextResponse.json({ error: 'mime_not_allowed', content_type }, { status: 415 });
  }
  if (size > MAX_BYTES) {
    return NextResponse.json({ error: 'too_large', max_bytes: MAX_BYTES }, { status: 413 });
  }
  if (!/^[a-f0-9]{64}$/.test(sha256)) {
    return NextResponse.json({ error: 'invalid_sha256' }, { status: 400 });
  }

  // Dedup + insert via SECURITY DEFINER RPC. Returns 1 row.
  const { data: rows, error: rpcErr } = await admin.rpc('fn_media_asset_upload_signup', {
    p_sha256: sha256,
    p_filename: filename,
    p_content_type: content_type,
    p_size: size,
    p_photographer: body.photographer ?? null,
    p_license: body.license ?? 'owned',
  });

  if (rpcErr) {
    return NextResponse.json({
      error: 'db_signup_failed',
      detail: rpcErr.message,
      code: rpcErr.code,
      hint: rpcErr.hint,
    }, { status: 500 });
  }
  const row = Array.isArray(rows) ? rows[0] : rows;
  if (!row?.asset_id || !row.raw_path) {
    return NextResponse.json({ error: 'db_signup_no_row', row }, { status: 500 });
  }

  if (row.duplicate) {
    return NextResponse.json({
      duplicate: true,
      asset_id: row.asset_id,
      raw_path: row.raw_path,
      status: row.status,
    });
  }

  // Mint signed upload URL (10 min).
  const { data: signed, error: signErr } = await admin.storage
    .from('media-raw')
    .createSignedUploadUrl(row.raw_path);

  if (signErr || !signed) {
    return NextResponse.json({ error: 'sign_failed', detail: signErr?.message }, { status: 500 });
  }

  return NextResponse.json({
    asset_id: row.asset_id,
    raw_path: row.raw_path,
    upload_url: signed.signedUrl,
    token: signed.token,
  });
}
