// app/api/marketing/media/preview/route.ts
// PBS 2026-07-13 — Signed-URL proxy for media-raw preview.
// GET /api/marketing/media/preview?asset_id=<uuid> → 302 to a 1h signed URL of the raw asset.
// Used by v_marketing_media_page.public_url fallback when master_path is null but raw_path exists.
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
    .schema('media')
    .from('media_assets')
    .select('raw_path,mime_type')
    .eq('asset_id', assetId)
    .maybeSingle();

  if (error || !row) return NextResponse.json({ error: 'not_found' }, { status: 404 });
  if (!row.raw_path) return NextResponse.json({ error: 'no_raw_path' }, { status: 404 });

  const { data: signed, error: signErr } = await sb.storage
    .from('media-raw')
    .createSignedUrl(row.raw_path, 3600);

  if (signErr || !signed?.signedUrl) {
    return NextResponse.json({ error: 'sign_failed', detail: signErr?.message ?? null }, { status: 500 });
  }

  return NextResponse.redirect(signed.signedUrl, 302);
}
