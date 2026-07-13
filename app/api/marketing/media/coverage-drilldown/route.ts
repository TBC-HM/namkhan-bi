// app/api/marketing/media/coverage-drilldown/route.ts
// GET — Coverage matrix cell drill-down. Returns fresh photos from
// v_marketing_media_page matching one dimension of the coverage matrix.
// PBS 2026-07-14 — replaces client-side filter on a preloaded mediaPage
// window that was missing rows (mediaPage capped at 5,000, but coverage
// aggregates the full table). CAP=500 because the top matrix cell
// (restaurant × tier_ota_profile) already has 256 photos on 2026-07-14.
//
// Params:
//   dim=area|facility|room_type|activity   (required)
//   value=<label> (for area/facility/activity)
//   room_type_id=<int> (for room_type)
//   tier=<primary_tier> (optional column filter)
//
// facility_id / activity_id columns do NOT exist on v_marketing_media_page.
// The matrix aggregates loosely on property_area (case-insensitive ILIKE),
// so we mirror that here — pass the scope_label as `value`.
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

const CAP = 500;

export async function GET(req: NextRequest) {
  let sb;
  try { sb = getSupabaseAdmin(); }
  catch (e: unknown) { return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 500 }); }

  const url = new URL(req.url);
  const dim   = (url.searchParams.get('dim') ?? '').trim().toLowerCase();
  const value = (url.searchParams.get('value') ?? '').trim();
  const roomTypeIdRaw = (url.searchParams.get('room_type_id') ?? '').trim();
  const tier = (url.searchParams.get('tier') ?? '').trim();

  if (!dim) {
    return NextResponse.json({ ok: false, error: 'missing_dim' }, { status: 400 });
  }

  let q = sb
    .from('v_marketing_media_page')
    .select('asset_id, original_filename, seo_target_filename, public_url, primary_tier, property_area, quality_index, room_type_id, mime_type, master_path, asset_type')
    .eq('asset_type', 'photo')
    .not('primary_tier', 'is', null)
    .limit(CAP);

  if (tier) q = q.eq('primary_tier', tier);

  if (dim === 'room_type') {
    // Prefer exact room_type_id match when provided; fall back to property_area
    // ILIKE for rooms whose photos are tagged only by area name.
    if (roomTypeIdRaw && /^\d+$/.test(roomTypeIdRaw)) {
      if (value) {
        q = q.or(`room_type_id.eq.${roomTypeIdRaw},property_area.ilike.${value.replace(/[%_]/g, '\\$&')}`);
      } else {
        q = q.eq('room_type_id', Number(roomTypeIdRaw));
      }
    } else if (value) {
      q = q.ilike('property_area', value);
    } else {
      return NextResponse.json({ ok: false, error: 'missing_value_or_room_type_id' }, { status: 400 });
    }
  } else if (dim === 'area' || dim === 'facility' || dim === 'activity') {
    // facility_id / activity_id columns do not exist on the media view;
    // the matrix aggregates by property_area name for all three, so mirror that.
    if (!value) {
      return NextResponse.json({ ok: false, error: 'missing_value' }, { status: 400 });
    }
    q = q.ilike('property_area', value);
  } else {
    return NextResponse.json({ ok: false, error: 'unsupported_dim', dim }, { status: 400 });
  }

  const { data, error } = await q;
  if (error) {
    return NextResponse.json({ ok: false, error: 'drilldown_failed', detail: error.message }, { status: 500 });
  }

  return NextResponse.json(
    { ok: true, rows: data ?? [] },
    { headers: { 'Cache-Control': 'no-store, max-age=0' } },
  );
}
