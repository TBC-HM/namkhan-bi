// app/api/marketing/media/thumbnail-sign/route.ts
// POST — mint a signed PUT URL for a poster.jpg upload in `media-thumbnails`.
// Body: { asset_id }
// Returns: { upload_url, poster_path }
// PBS 2026-07-13 · Task D — used by UploadDropzone client-side poster extraction.
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(req: NextRequest) {
  let sb;
  try { sb = getSupabaseAdmin(); }
  catch (e: any) { return NextResponse.json({ error: e.message }, { status: 500 }); }

  let body: any;
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: 'invalid_json' }, { status: 400 }); }

  const asset_id = body?.asset_id;
  if (!asset_id || typeof asset_id !== 'string' || !UUID_RE.test(asset_id)) {
    return NextResponse.json({ error: 'asset_id must be a UUID' }, { status: 400 });
  }

  const poster_path = `${asset_id}/poster.jpg`;

  const { data: signed, error: signErr } = await sb.storage
    .from('media-thumbnails')
    .createSignedUploadUrl(poster_path);

  if (signErr || !signed) {
    return NextResponse.json({ error: 'sign_failed', detail: signErr?.message }, { status: 500 });
  }

  return NextResponse.json({
    upload_url: signed.signedUrl,
    token: signed.token,
    poster_path,
  });
}
