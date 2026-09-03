// app/api/marketing/social/media-library/route.ts
// PBS 2026-09-03 — serve media library assets approved for social_organic use.
// Source: public.mkt_v_media_ready (bridge over media.media_assets, already
// REVOKE'd from anon). Render URLs are constructed from the public `media`
// Supabase Storage bucket.

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { requirePropertyAccess } from '@/lib/tenancy';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const STORAGE_BASE = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/media`;

function thumbnailUrl(renders: Record<string, string> | null, raw_path: string | null): string | null {
  if (renders?.thumbnail) return `${STORAGE_BASE}/${renders.thumbnail}`;
  if (renders?.web_2k)    return `${STORAGE_BASE}/${renders.web_2k}`;
  if (raw_path)            return `${STORAGE_BASE}/${raw_path}`;
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

  const sb = getSupabaseAdmin();
  let q = sb.from('mkt_v_media_ready')
    .select('asset_id,asset_type,original_filename,caption,alt_text,primary_tier,property_area,usage_rights,raw_path,width_px,height_px,renders,tags')
    .eq('property_id', propertyId)
    .contains('usage_rights', ['social_organic'])
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
    thumbnail_url: thumbnailUrl(a.renders, a.raw_path),
    full_url:    a.renders?.web_2k
      ? `${STORAGE_BASE}/${a.renders.web_2k}`
      : (a.raw_path ? `${STORAGE_BASE}/${a.raw_path}` : null),
  }));

  return NextResponse.json({ ok: true, assets, page, limit, total_on_page: assets.length });
}
