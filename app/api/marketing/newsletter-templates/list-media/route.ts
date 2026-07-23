// app/api/marketing/newsletter-templates/list-media/route.ts
// PBS 2026-07-23 · Owner: "shows me only some pics — I need the media OTA folder".
// Returns the CURATED bucket by default: primary_tier IN ('tier_ota_profile',
// 'tier_website_hero') — the same tiers the composer's media ladder uses.
// ?tier=social switches to the social pool for explicit fallback browsing.
// Never archive / internal / logos / untiered.
//
// Each row carries its AREA (folder) label, resolved exactly like the Coverage
// drill does: media_assets FK → v_media_area_taxonomy name (room:/facility:/
// activity:/retreat:/transport:/cert:/boat:/cruise: keys), falling back to the
// free-text property_area, then 'Unassigned'.
// Feeds MediaPicker (CampaignEditor) + MediaPickerModal (EmailChromePanel).

import { NextResponse, type NextRequest } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const NAMKHAN_ID = 260955;
const CURATED = ['tier_ota_profile', 'tier_website_hero'];
const SOCIAL = ['tier_social_pool'];

type AssetRow = {
  asset_id: string; original_filename: string | null; primary_tier: string | null;
  quality_index: number | null; property_area: string | null; sub_category: string | null;
  room_type_id: number | null; facility_id: number | null; activity_id: number | null;
  retreat_id: number | null; transport_id: number | null; certification_id: number | null;
  boat_id: number | null; boat_cruise_id: number | null;
};

function areaKeyFor(r: AssetRow): string | null {
  // Same precedence the Coverage drill uses to route a photo to its folder.
  if (r.room_type_id != null) return `room:${r.room_type_id}`;
  if (r.facility_id != null) return r.sub_category ? `facility:${r.facility_id}:${r.sub_category}` : `facility:${r.facility_id}`;
  if (r.activity_id != null) return `activity:${r.activity_id}`;
  if (r.retreat_id != null) return `retreat:${r.retreat_id}`;
  if (r.transport_id != null) return `transport:${r.transport_id}`;
  if (r.certification_id != null) return `cert:${r.certification_id}`;
  if (r.boat_cruise_id != null) return `cruise:${r.boat_cruise_id}`;
  if (r.boat_id != null) return `boat:${r.boat_id}`;
  return null;
}

export async function GET(req: NextRequest) {
  const sb = getSupabaseAdmin();
  const tierParam = new URL(req.url).searchParams.get('tier') ?? 'ota';
  const tiers = tierParam === 'social' ? SOCIAL : CURATED;

  const [assetsR, taxR] = await Promise.all([
    sb.schema('media').from('media_assets')
      .select('asset_id, original_filename, primary_tier, quality_index, property_area, sub_category, room_type_id, facility_id, activity_id, retreat_id, transport_id, certification_id, boat_id, boat_cruise_id, asset_type, status')
      .eq('property_id', NAMKHAN_ID)
      .eq('asset_type', 'photo')
      .in('primary_tier', tiers)
      .not('status', 'in', '(removed,archived,qc_failed)')
      .order('quality_index', { ascending: false, nullsFirst: false })
      .limit(800),
    sb.from('v_media_area_taxonomy')
      .select('area_key, name, kind')
      .eq('property_id', NAMKHAN_ID),
  ]);

  if (assetsR.error) return NextResponse.json({ ok: false, error: assetsR.error.message }, { status: 500 });

  const nameByKey = new Map<string, string>();
  for (const t of (taxR.data ?? []) as Array<{ area_key: string; name: string }>) {
    if (t.area_key) nameByKey.set(String(t.area_key), t.name);
  }

  // public_url + caption live on the view (computed), hydrate by asset_id.
  const assets = (assetsR.data ?? []) as unknown as AssetRow[];
  const ids = assets.map(a => a.asset_id);
  const urlById = new Map<string, { public_url: string | null; caption: string | null; width_px: number | null; height_px: number | null }>();
  for (let i = 0; i < ids.length; i += 200) {
    const chunk = ids.slice(i, i + 200);
    const { data } = await sb.from('v_marketing_media_page')
      .select('asset_id, public_url, caption, width_px, height_px')
      .in('asset_id', chunk);
    for (const r of (data ?? []) as Array<{ asset_id: string; public_url: string | null; caption: string | null; width_px: number | null; height_px: number | null }>) {
      urlById.set(String(r.asset_id), r);
    }
  }

  const rows = assets
    .map(a => {
      const hyd = urlById.get(String(a.asset_id));
      if (!hyd?.public_url) return null;
      const key = areaKeyFor(a);
      // facility:X:sub falls back to facility:X when the virtual sub-folder has no taxonomy row
      const area = (key && (nameByKey.get(key) ?? (key.startsWith('facility:') ? nameByKey.get(key.split(':').slice(0, 2).join(':')) : undefined)))
        || a.property_area
        || 'Unassigned';
      return {
        id: a.asset_id,
        asset_id: a.asset_id,
        original_filename: a.original_filename,
        caption: hyd.caption,
        quality_index: a.quality_index,
        public_url: hyd.public_url,
        primary_tier: a.primary_tier,
        area,
        area_key: key,
        property_area: a.property_area,
        category: area, // back-compat for EmailChromePanel's MediaAsset shape
        width_px: hyd.width_px,
        height_px: hyd.height_px,
      };
    })
    .filter((r): r is NonNullable<typeof r> => r !== null);

  return NextResponse.json({ ok: true, tier: tierParam === 'social' ? 'social' : 'ota', rows });
}
