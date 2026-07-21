// app/api/marketing/media/coverage-drill/route.ts
// GET ?kind=X&area_key=Y&tier=Z&property_id=N
// Returns the photos matching a Coverage-matrix cell (kind × area_key × tier).
// Restores the "click cell → modal with pics" UX that the 2026-07-18 CoverageTab
// rewrite dropped (was inline mediaPage-filtered; new coverage view uses
// (kind, area_key) so we filter media_assets by the mapped FK.
//
// 2026-07-21 fix:
//  - Bug 1 (hard error): `public_url` does NOT exist on media.media_assets
//    (it's a computed column on public.v_marketing_media_page). Removed from
//    the media_assets SELECT and batch-hydrated by asset_id from the view.
//  - Bug 2 (soft "no photos" warning on non-zero cells):
//      * `v_media_coverage_matrix` emits area_key='room:<id>' for rooms, but
//        the drill required a numeric-only area_key → every rooms cell click
//        returned 0. Now accept both 'room:<id>' and bare numeric.
//      * Matrix emits kind='retreats' with 'retreat:<id>' and kind='transport'
//        with 'transport:<id>'. Neither had a drill branch → 0 items. Added
//        both, backed by media_assets.retreat_id / .transport_id FKs which
//        the matrix already aggregates on.
//      * kind values 'fnb' and 'jungle_spa' — both route through the shared
//        `facility:` prefix branch, which was already correct.
import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const NUMERIC_RE = /^\d+$/;

export async function GET(req: Request) {
  const url = new URL(req.url);
  const kind = (url.searchParams.get('kind') ?? '').toLowerCase();
  const areaKey = (url.searchParams.get('area_key') ?? '').trim();
  const tier = url.searchParams.get('tier') ?? '';
  const propertyId = Number(url.searchParams.get('property_id') ?? 260955);

  if (!kind || !areaKey || !tier) {
    return NextResponse.json({ error: 'kind, area_key, tier required' }, { status: 400 });
  }

  const sb = getSupabaseAdmin();

  // Base query: photos with the requested tier, not removed/deleted, for the property.
  // NOTE: `public_url` is intentionally omitted — it does not exist on media_assets;
  // it's computed on public.v_marketing_media_page and hydrated below.
  let q = sb.schema('media').from('media_assets')
    .select('asset_id, original_filename, seo_target_filename, primary_tier, room_type_id, facility_id, activity_id, certification_id, contact_id, destination_id, boat_id, boat_cruise_id, retreat_id, transport_id, sub_category, quality_index')
    .eq('property_id', propertyId)
    .eq('asset_type', 'photo')
    .eq('primary_tier', tier)
    .not('status', 'in', '(removed,archived,qc_failed)')
    .order('quality_index', { ascending: false, nullsFirst: false })
    .limit(200);

  // Route each kind → the right FK filter, matching how the taxonomy view emits area_key.
  // Order matters: check prefixed forms before bare-numeric fallbacks.
  if (areaKey.startsWith('room:')) {
    const id = Number(areaKey.split(':')[1]);
    if (!Number.isFinite(id)) return NextResponse.json({ items: [], note: 'bad room id', debug: { areaKey } });
    q = q.eq('room_type_id', id);
  } else if (kind === 'rooms') {
    if (!NUMERIC_RE.test(areaKey)) return NextResponse.json({ items: [], note: 'rooms area_key not numeric', debug: { kind, areaKey } });
    q = q.eq('room_type_id', Number(areaKey));
  } else if (areaKey.startsWith('facility:')) {
    // facility:X or facility:X:Y (virtual sub-folder — filter by sub_category too)
    const parts = areaKey.split(':');
    const facilityId = Number(parts[1]);
    if (!Number.isFinite(facilityId)) return NextResponse.json({ items: [], note: 'bad facility id', debug: { areaKey } });
    q = q.eq('facility_id', facilityId);
    if (parts[2]) q = q.eq('sub_category', parts[2]);
  } else if (areaKey.startsWith('activity:') || kind === 'activities') {
    const id = areaKey.startsWith('activity:') ? Number(areaKey.split(':')[1]) : Number(areaKey);
    if (!Number.isFinite(id)) return NextResponse.json({ items: [], note: 'bad activity id', debug: { areaKey } });
    q = q.eq('activity_id', id);
  } else if (areaKey.startsWith('retreat:') || kind === 'retreats') {
    const id = areaKey.startsWith('retreat:') ? Number(areaKey.split(':')[1]) : Number(areaKey);
    if (!Number.isFinite(id)) return NextResponse.json({ items: [], note: 'bad retreat id', debug: { areaKey } });
    q = q.eq('retreat_id', id);
  } else if (areaKey.startsWith('transport:') || kind === 'transport') {
    const id = areaKey.startsWith('transport:') ? Number(areaKey.split(':')[1]) : Number(areaKey);
    if (!Number.isFinite(id)) return NextResponse.json({ items: [], note: 'bad transport id', debug: { areaKey } });
    q = q.eq('transport_id', id);
  } else if (areaKey.startsWith('cert:') || kind === 'certifications') {
    const id = areaKey.startsWith('cert:') ? Number(areaKey.split(':')[1]) : Number(areaKey);
    if (!Number.isFinite(id)) return NextResponse.json({ items: [], note: 'bad cert id', debug: { areaKey } });
    q = q.eq('certification_id', id);
  } else if (areaKey.startsWith('boat:')) {
    q = q.eq('boat_id', Number(areaKey.split(':')[1]));
  } else if (areaKey.startsWith('cruise:')) {
    q = q.eq('boat_cruise_id', Number(areaKey.split(':')[1]));
  } else if (areaKey.startsWith('destination:') || kind === 'destination') {
    const slug = areaKey.startsWith('destination:') ? areaKey.split(':')[1] : areaKey;
    // Join through destination_areas.slug → dest_id
    const { data: destRow } = await sb.schema('property' as any).from('destination_areas')
      .select('dest_id').eq('property_id', propertyId).eq('slug', slug).maybeSingle();
    const destId = (destRow as any)?.dest_id;
    if (!destId) return NextResponse.json({ items: [], note: 'unknown destination slug', debug: { slug } });
    q = q.eq('destination_id', destId);
  } else {
    return NextResponse.json({ items: [], note: 'unrecognised kind/area_key shape', debug: { kind, areaKey } });
  }

  const { data, error } = await q;
  if (error) return NextResponse.json({ error: error.message, debug: { kind, areaKey, tier } }, { status: 500 });

  const rows = data ?? [];

  // Batch-hydrate public_url from v_marketing_media_page (view has the computed column).
  const ids = rows.map((r: any) => r.asset_id);
  const urlMap = new Map<string, string | null>();
  if (ids.length) {
    const { data: urlRows } = await sb.from('v_marketing_media_page')
      .select('asset_id, public_url').in('asset_id', ids);
    for (const u of (urlRows ?? []) as Array<{ asset_id: string; public_url: string | null }>) {
      urlMap.set(u.asset_id, u.public_url);
    }
  }

  // Attach a preview URL that goes through our signed-URL proxy (used elsewhere on Library).
  const items = rows.map((r: any) => ({
    asset_id: r.asset_id,
    original_filename: r.original_filename,
    seo_target_filename: r.seo_target_filename,
    primary_tier: r.primary_tier,
    quality_index: r.quality_index,
    preview_url: `/api/marketing/media/preview?asset_id=${r.asset_id}`,
    public_url: urlMap.get(r.asset_id) ?? null,
  }));

  return NextResponse.json({ items, count: items.length });
}