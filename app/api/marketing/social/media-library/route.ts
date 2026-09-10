// app/api/marketing/social/media-library/route.ts
// PBS 2026-09-03 — serve media library assets approved for social_organic use.
// Source: public.mkt_v_media_ready (bridge over media.media_assets, already
// REVOKE'd from anon). Render URLs are constructed from the public `media-renders`
// Supabase Storage bucket.

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { requirePropertyAccess } from '@/lib/tenancy';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Renders live in 'media-renders' (media_renders.file_path paths like {asset_id}/{purpose}.jpg).
// VERIFIED 2026-09-10: bucket 'media' holds 0 objects; 'media-renders' holds 11,087.
// A stale comment here claimed the opposite and built every media_url against the empty
// bucket, so social posts 404'd on their image and silently published as text-only.
const STORAGE_RENDERS = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/media-renders`;
const STORAGE_RAW     = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/media-raw`;

// Quality gate. Two INDEPENDENT questions decide whether an asset may be offered:
//   usage_rights  — MAY we publish it here? (licensing: web / ota / social_organic)
//   qc_score      — SHOULD we? (is it good enough to represent the property)
// Both must pass. Rights alone let low-scoring junk through; score alone would let a
// web-only or expired-licence photo reach social. Neither substitutes for the other.
//
// Matches app/api/marketing/social/accept-slot/route.ts, which already gates its
// AI-picked photos at qc_score > 75 — so the manual picker and the AI picker now agree.
// Previously they did not, and the AI could choose a photo this library would not show.
//
// Per-channel so the bar can differ by surface. Pinterest sits at 75 today by PBS's call;
// raise it here alone when the library is deep enough to support a stricter bar.
const MIN_QC_SCORE: Record<string, number> = { pinterest: 75 };
const MIN_QC_SCORE_DEFAULT = 75;

function minScoreFor(platform: string | null): number {
  if (!platform) return MIN_QC_SCORE_DEFAULT;
  return MIN_QC_SCORE[platform.toLowerCase()] ?? MIN_QC_SCORE_DEFAULT;
}

function thumbnailUrl(renders: Record<string, string> | null, raw_path: string | null): string | null {
  if (renders?.thumbnail) return `${STORAGE_RENDERS}/${renders.thumbnail}`;
  if (renders?.web_2k)    return `${STORAGE_RENDERS}/${renders.web_2k}`;
  if (raw_path)            return `${STORAGE_RAW}/${raw_path}`;
  return null;
}

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const rawPid = sp.get('property_id');

  let propertyId: number;
  try {
    propertyId = await requirePropertyAccess(req, rawPid);
  } catch (e) {
    if (e instanceof Response) return e;
    return NextResponse.json({ ok: false, error: 'forbidden' }, { status: 403 });
  }

  const page  = Math.max(1, Number(sp.get('page')  ?? 1));
  const limit = Math.min(40, Math.max(8, Number(sp.get('limit') ?? 20)));
  const assetType = sp.get('type');   // photo | video | null
  const area      = sp.get('area');   // property_area filter | null
  const platform  = sp.get('platform'); // channel — sets the quality bar | null
  const minScore  = minScoreFor(platform);

  const sb = getSupabaseAdmin();
  let q = sb.from('mkt_v_media_ready')
    .select('asset_id,asset_type,original_filename,caption,alt_text,primary_tier,property_area,usage_rights,raw_path,width_px,height_px,renders,tags,qc_score')
    .eq('property_id', propertyId)
    .contains('usage_rights', ['social_organic'])
    // NOTE: .gt() excludes qc_score IS NULL — an unscored asset is not offered.
    // Same semantics as accept-slot. Run media-qa-score to bring an asset in.
    .gt('qc_score', minScore)
    .order('captured_at', { ascending: false, nullsFirst: false })
    .order('asset_id', { ascending: false })
    .range((page - 1) * limit, page * limit - 1);

  if (assetType) q = q.eq('asset_type', assetType as any);
  if (area)      q = q.eq('property_area', area);

  const { data, error } = await q;
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

  const assets = (data ?? []).map((a: any) => ({
    asset_id:    a.asset_id,
    asset_type:  a.asset_type,
    filename:    a.original_filename,
    caption:     a.caption,
    alt_text:    a.alt_text,
    property_area: a.property_area,
    width_px:    a.width_px,
    height_px:   a.height_px,
    tags:        a.tags,
    qc_score:    a.qc_score,
    thumbnail_url: thumbnailUrl(a.renders, a.raw_path),
    raw_path_url: a.raw_path ? `${STORAGE_RAW}/${a.raw_path}` : null,
    full_url:    a.renders?.web_2k
      ? `${STORAGE_RENDERS}/${a.renders.web_2k}`
      : (a.raw_path ? `${STORAGE_RAW}/${a.raw_path}` : null),
  }));

  // min_score is returned so the picker can say WHY the grid is thin
  // ("below the quality bar") instead of rendering an unexplained empty state.
  return NextResponse.json({
    ok: true, assets, page, limit, total_on_page: assets.length,
    min_score: minScore, platform: platform ?? null,
  });
}
