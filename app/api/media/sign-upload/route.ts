// app/api/media/sign-upload/route.ts
// Mints a signed upload URL for media-raw bucket and pre-creates the
// marketing.media_assets row in 'ingested' status.
//
// Body: { filename, content_type, size, sha256 }
// Returns: { upload_url, asset_id, raw_path } | { duplicate: true, asset_id }

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin, PROPERTY_ID } from '@/lib/supabaseAdmin';
import { getCurrentUser } from '@/lib/currentUser';

export const runtime = 'nodejs';

const ALLOWED_MIME = new Set([
  'image/jpeg', 'image/png', 'image/heic', 'image/heif', 'image/webp',
  'image/x-canon-cr2', 'image/x-nikon-nef', 'image/x-sony-arw', 'image/x-adobe-dng',
]);

const MAX_BYTES = 500 * 1024 * 1024; // 500 MB

function extFromMime(mime: string, filename: string): string {
  if (mime === 'image/jpeg') return 'jpg';
  if (mime === 'image/png') return 'png';
  if (mime === 'image/heic' || mime === 'image/heif') return 'heic';
  if (mime === 'image/webp') return 'webp';
  if (mime === 'image/x-canon-cr2') return 'cr2';
  if (mime === 'image/x-nikon-nef') return 'nef';
  if (mime === 'image/x-sony-arw') return 'arw';
  if (mime === 'image/x-adobe-dng') return 'dng';
  // fallback to extension from filename
  const m = filename.match(/\.([a-zA-Z0-9]+)$/);
  return (m?.[1] ?? 'bin').toLowerCase();
}

function assetTypeFromMime(mime: string): 'photo' | 'raw_dng' {
  if (mime === 'image/x-adobe-dng') return 'raw_dng';
  if (mime.startsWith('image/x-')) return 'raw_dng';
  return 'photo';
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (user.role !== 'owner' && user.role !== 'gm') {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  let body: { filename?: string; content_type?: string; size?: number; sha256?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }

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

  // Dedupe check
  const { data: existing } = await supabaseAdmin
    .schema('marketing')
    .from('media_assets')
    .select('asset_id, status, raw_path')
    .eq('sha256', sha256)
    .maybeSingle();

  if (existing) {
    return NextResponse.json({
      duplicate: true,
      asset_id: existing.asset_id,
      status: existing.status,
    });
  }

  // Generate path: {property_id}/incoming/{yyyy}/{mm}/{asset_id}.{ext}
  const now = new Date();
  const yyyy = now.getUTCFullYear();
  const mm = String(now.getUTCMonth() + 1).padStart(2, '0');
  const ext = extFromMime(content_type, filename);

  // Pre-insert asset row to claim asset_id
  const { data: inserted, error: insertErr } = await supabaseAdmin
    .schema('marketing')
    .from('media_assets')
    .insert({
      property_id: PROPERTY_ID,
      sha256,
      original_filename: filename,
      asset_type: assetTypeFromMime(content_type),
      mime_type: content_type,
      file_size_bytes: size,
      status: 'ingested',
      created_by: user.id,
    })
    .select('asset_id')
    .single();

  if (insertErr || !inserted) {
    return NextResponse.json({ error: 'db_insert_failed', detail: insertErr?.message }, { status: 500 });
  }

  const raw_path = `${PROPERTY_ID}/incoming/${yyyy}/${mm}/${inserted.asset_id}.${ext}`;

  // Update row with intended raw_path
  await supabaseAdmin
    .schema('marketing')
    .from('media_assets')
    .update({ raw_path })
    .eq('asset_id', inserted.asset_id);

  // Mint a signed upload URL (valid 10 min)
  const { data: signed, error: signErr } = await supabaseAdmin.storage
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
