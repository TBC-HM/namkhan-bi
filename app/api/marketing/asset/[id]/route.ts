// GET /api/marketing/asset/[id]
// Single-asset detail for the right-drawer view.
// 2026-05-09 (cockpit_bugs id=4): augmented to also return:
//   • full marketing.media_assets row (raw_path, master_path, file_size_bytes,
//     do_not_modify, license_expiry, photographer, etc. — everything the
//     drawer's metadata + edit form needs)
//   • usage_log: marketing.media_usage_log rows referencing this asset, so
//     the drawer can render "where this asset has been used"
//   • campaign_assets: rows tying this asset to specific campaigns

import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const id = params.id;
  if (!id || !/^[0-9a-f-]{36}$/i.test(id)) {
    return NextResponse.json({ error: 'invalid asset_id' }, { status: 400 });
  }

  const [readyRes, fullRes, usageRes, campaignRes] = await Promise.all([
    supabase
      .schema('marketing')
      .from('v_media_ready')
      .select('*')
      .eq('asset_id', id)
      .maybeSingle(),
    supabase
      .schema('marketing')
      .from('media_assets')
      .select('asset_id, raw_path, master_path, file_size_bytes, photographer, license_expiry, license_type, do_not_modify, has_identifiable_people, property_area, qc_score, qc_flags, ai_confidence, status, captured_at, created_at, updated_at, usage_rights, secondary_tiers')
      .eq('asset_id', id)
      .maybeSingle(),
    supabase
      .schema('marketing')
      .from('media_usage_log')
      .select('log_id, used_in, channel, campaign_name, external_ref, placement_url, used_at, used_by_agent, first_used_at, removed_at')
      .eq('asset_id', id)
      .order('used_at', { ascending: false })
      .limit(50),
    supabase
      .schema('marketing')
      .from('campaign_assets')
      .select('campaign_id, slot_order, caption_per_slot, alt_text_per_slot, created_at')
      .eq('asset_id', id)
      .order('created_at', { ascending: false })
      .limit(50),
  ]);

  if (readyRes.error) {
    return NextResponse.json({ error: readyRes.error.message }, { status: 500 });
  }

  // Merge: v_media_ready gives the renders + summary fields, media_assets
  // gives the raw / master paths and license details. Drawer reads both.
  const ready = readyRes.data ?? { asset_id: id };
  const full = fullRes.data ?? null;
  const merged = { ...ready, ...(full ?? {}) };

  return NextResponse.json({
    ...merged,
    usage_log: usageRes.data ?? [],
    campaign_assets: campaignRes.data ?? [],
  });
}
