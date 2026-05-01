// POST /api/marketing/upload-sign
// Signed-URL upload flow — bypasses Vercel's 4.5 MB function body cap.
//
// Browser sends ONLY the file metadata (filename + mime + size + sha256).
// Server validates, dedup-checks, pre-creates the marketing.media_assets row,
// mints a signed upload URL for media-raw bucket, returns { upload_url, asset_id, raw_path }.
// The browser then PUTs the actual bytes directly to Supabase Storage.
//
// Body: { filename, content_type, size, sha256, photographer?, license?, campaign_tag? }

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const ALLOWED_MIME = new Set([
  'image/jpeg', 'image/png', 'image/heic', 'image/heif', 'image/webp',
  'image/x-canon-cr2', 'image/x-nikon-nef', 'image/x-sony-arw', 'image/x-adobe-dng',
]);

const MAX_BYTES = 500 * 1024 * 1024; // 500 MB — bucket-level cap

function inferAssetType(mime: string): 'photo' | 'raw_dng' {
  if (mime === 'image/x-adobe-dng') return 'raw_dng';
  if (mime.startsWith('image/x-')) return 'raw_dng';
  return 'photo';
}

function safeName(name: string): string {
  return name
    .normalize('NFKD')
    .replace(/[^\w.\-]+/g, '_')
    .replace(/_{2,}/g, '_')
    .slice(0, 200);
}

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

  // Dedupe — if we already have this exact file, return existing asset_id
  const { data: existing } = await admin
    .schema('marketing')
    .from('media_assets')
    .select('asset_id, status, raw_path')
    .eq('sha256', sha256)
    .maybeSingle();

  if (existing) {
    return NextResponse.json({
      duplicate: true,
      asset_id: existing.asset_id,
      raw_path: existing.raw_path,
      status: existing.status,
    });
  }

  // Pre-insert row to claim asset_id
  const { data: inserted, error: insertErr } = await admin
    .schema('marketing')
    .from('media_assets')
    .insert({
      sha256,
      original_filename: filename,
      asset_type: inferAssetType(content_type),
      mime_type: content_type,
      file_size_bytes: size,
      photographer: body.photographer || null,
      license_type: body.license || 'owned',
      status: 'ingested',
    })
    .select('asset_id')
    .single();

  if (insertErr || !inserted) {
    return NextResponse.json({ error: 'db_insert_failed', detail: insertErr?.message }, { status: 500 });
  }

  // Path: yyyy/mm/<sha8>__<safe>
  const now = new Date();
  const yyyy = String(now.getUTCFullYear());
  const mm = String(now.getUTCMonth() + 1).padStart(2, '0');
  const raw_path = `${yyyy}/${mm}/${sha256.slice(0, 8)}__${safeName(filename)}`;

  // Update row with raw_path
  await admin
    .schema('marketing')
    .from('media_assets')
    .update({ raw_path })
    .eq('asset_id', inserted.asset_id);

  // Mint signed upload URL (10 min)
  const { data: signed, error: signErr } = await admin.storage
    .from('media-raw')
    .createSignedUploadUrl(raw_path);

  if (signErr || !signed) {
    return NextResponse.json({ error: 'sign_failed', detail: signErr?.message }, { status: 500 });
  }

  return NextResponse.json({
    asset_id: inserted.asset_id,
    raw_path,
    upload_url: signed.signedUrl,
    token: signed.token,
  });
}
