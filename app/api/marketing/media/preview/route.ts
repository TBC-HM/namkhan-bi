// app/api/marketing/media/preview/route.ts
// PBS 2026-07-13 — Signed-URL proxy for media-raw preview.
// GET /api/marketing/media/preview?asset_id=<uuid> → 302 to a 1h signed URL of the raw asset.
// Used by v_marketing_media_page.public_url fallback when master_path is null but raw_path exists.
// 2026-07-13 v2: PostgREST-public-only burn. Read via public bridge view v_marketing_media_page,
// not sb.schema('media').from('media_assets') (which silently returns nothing).
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const assetId = req.nextUrl.searchParams.get('asset_id') ?? '';
  if (!assetId) return NextResponse.json({ error: 'asset_id_required' }, { status: 400 });

  let sb;
  try { sb = getSupabaseAdmin(); }
  catch (e) { return NextResponse.json({ error: 'admin_init_failed' }, { status: 500 }); }

  const { data: row, error } = await sb
    .from('v_marketing_media_page')
    .select('raw_path,mime_type,asset_type')
    .eq('asset_id', assetId)
    .maybeSingle();

  if (error) return NextResponse.json({ error: 'lookup_failed', detail: error.message }, { status: 500 });
  if (!row) return NextResponse.json({ error: 'not_found' }, { status: 404 });
  if (!row.raw_path) return NextResponse.json({ error: 'no_raw_path' }, { status: 404 });

  const bucket = row.raw_path.startsWith('branding/') ? 'branding' : 'media-raw';
  const path = row.raw_path.startsWith('branding/') ? row.raw_path.replace(/^branding\//, '') : row.raw_path;

  const { data: signed, error: signErr } = await sb.storage
    .from(bucket)
    .createSignedUrl(path, 3600);

  if (signErr || !signed?.signedUrl) {
    return NextResponse.json({ error: 'sign_failed', detail: signErr?.message ?? null }, { status: 500 });
  }

  return NextResponse.redirect(signed.signedUrl, 302);
}
