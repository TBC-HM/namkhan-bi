// app/api/marketing/media/preview/route.ts
// PBS 2026-07-13 — Signed-URL proxy for media-raw preview.
// v3 (2026-07-14): switch to Storage TRANSFORM (width=800, contain, quality=80,
//   format=origin). Fixes:
//   - blank tiles for 4 HEIC/HEIF files (browsers can't decode raw HEIC).
//   - slow / dropped renders for 110+ files > 5MB (up to 30MB phone JPEGs) — the
//     transform normalises everything to <100KB WebP/JPEG at the CDN edge.
//   Adds ?debug=1 → returns JSON with resolved bucket/path/error-stage so future
//   preview issues can be diagnosed without new deploys.
// 2026-07-13 v2: PostgREST-public-only burn. Read via public bridge view
//   v_marketing_media_page, not sb.schema('media').from('media_assets').
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const assetId = req.nextUrl.searchParams.get('asset_id') ?? '';
  const debug = req.nextUrl.searchParams.get('debug') === '1';
  const width = Math.min(Math.max(Number(req.nextUrl.searchParams.get('w') ?? 800), 200), 1568);
  if (!assetId) return NextResponse.json({ error: 'asset_id_required' }, { status: 400 });

  let sb;
  try { sb = getSupabaseAdmin(); }
  catch (e: any) {
    if (debug) return NextResponse.json({ stage: 'admin_init', error: e?.message ?? 'admin_init_failed' }, { status: 500 });
    return NextResponse.json({ error: 'admin_init_failed' }, { status: 500 });
  }

  const { data: row, error } = await sb
    .from('v_marketing_media_page')
    .select('raw_path,master_path,mime_type,asset_type,is_ai_generated')
    .eq('asset_id', assetId)
    .maybeSingle();

  if (error) {
    if (debug) return NextResponse.json({ stage: 'lookup', error: error.message }, { status: 500 });
    return NextResponse.json({ error: 'lookup_failed', detail: error.message }, { status: 500 });
  }
  if (!row) {
    if (debug) return NextResponse.json({ stage: 'lookup', error: 'not_found', asset_id: assetId }, { status: 404 });
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }
  if (!row.raw_path && !row.master_path) {
    if (debug) return NextResponse.json({ stage: 'resolve', error: 'no_raw_or_master_path' }, { status: 404 });
    return NextResponse.json({ error: 'no_raw_path' }, { status: 404 });
  }

  // Prefer a master render when available; fall back to raw.
  let bucket: string;
  let path: string;
  if (row.master_path) {
    bucket = row.is_ai_generated ? 'media-ai' : 'media-renders';
    path = row.master_path;
  } else if (row.raw_path!.startsWith('branding/')) {
    bucket = 'branding';
    path = row.raw_path!.replace(/^branding\//, '');
  } else {
    bucket = 'media-raw';
    path = row.raw_path!;
  }

  const { data: signed, error: signErr } = await sb.storage
    .from(bucket)
    .createSignedUrl(path, 3600, {
      transform: { width, height: width, resize: 'contain', quality: 80 },
    });

  if (signErr || !signed?.signedUrl) {
    if (debug) return NextResponse.json({ stage: 'sign', bucket, path, error: signErr?.message ?? 'sign_failed' }, { status: 500 });
    return NextResponse.json({ error: 'sign_failed', detail: signErr?.message ?? null }, { status: 500 });
  }

  if (debug) {
    return NextResponse.json({
      ok: true, bucket, path, width, signedUrl: signed.signedUrl,
      mime_type: row.mime_type, asset_type: row.asset_type,
    });
  }

  return NextResponse.redirect(signed.signedUrl, 302);
}
