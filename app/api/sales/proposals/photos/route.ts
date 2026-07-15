// app/api/sales/proposals/photos/route.ts
// PBS 2026-07-16 — photo picker source for the proposal composer.
// Reads public.v_proposal_photo_library with:
//   HARD: target_usage_tiers && ARRAY['tier_ota_profile','tier_website_hero']
//   scope=context:
//     block_type=room     → room_type_id = ref_id
//     block_type=activity → activity_id  = ref_id  OR property_area='activity'
//     block_type=facility → facility_id  = ref_id  OR property_area='facility'
//     block_type=fnb      → property_area IN ('restaurant','bar','dining')
//     block_type=spa      → property_area='spa'
//     block_type=transfer → property_area IN ('transport','boat','tuktuk','car')
//   scope=all: all tier-ok photos, marketing_score DESC
//
// Uses getSupabaseAdmin() so the bridge view is definitely accessible from the API layer.
// Public bridge view is also anon-readable, but service role avoids any auth mismatch.

import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const TIER_OK = ['tier_ota_profile', 'tier_website_hero'];

export async function GET(req: Request) {
  const url = new URL(req.url);
  const propertyId = Number(url.searchParams.get('property_id') ?? '260955');
  const blockType  = (url.searchParams.get('block_type') ?? '').toLowerCase();
  const refId      = url.searchParams.get('ref_id');
  const scope      = (url.searchParams.get('scope') ?? 'context').toLowerCase();

  const sb = getSupabaseAdmin();

  let q = sb
    .from('v_proposal_photo_library')
    .select('asset_id, original_filename, caption, alt_text, property_area, room_type_id, activity_id, facility_id, primary_tier, marketing_score, aesthetic_score, width_px, height_px, aspect_ratio')
    .eq('property_id', propertyId)
    .overlaps('target_usage_tiers', TIER_OK)
    .order('marketing_score', { ascending: false, nullsFirst: false })
    .limit(200);

  if (scope === 'context' && blockType) {
    switch (blockType) {
      case 'room':
        if (refId) q = q.eq('room_type_id', Number(refId));
        break;
      case 'activity':
        if (refId) q = q.or(`activity_id.eq.${Number(refId)},property_area.eq.activity`);
        else       q = q.eq('property_area', 'activity');
        break;
      case 'facility':
        if (refId) q = q.or(`facility_id.eq.${Number(refId)},property_area.eq.facility`);
        else       q = q.eq('property_area', 'facility');
        break;
      case 'fnb':
        q = q.in('property_area', ['restaurant', 'bar', 'dining', 'fnb']);
        break;
      case 'spa':
        q = q.eq('property_area', 'spa');
        break;
      case 'transfer':
        q = q.in('property_area', ['transport', 'boat', 'tuktuk', 'car']);
        break;
      // note / unknown block types → no extra filter
    }
  }

  const { data, error } = await q;
  if (error) {
    // eslint-disable-next-line no-console
    console.error('[sales.photos]', error);
    return NextResponse.json({ error: error.message, photos: [] }, { status: 500 });
  }
  return NextResponse.json({ photos: data ?? [], scope, block_type: blockType || null });
}
