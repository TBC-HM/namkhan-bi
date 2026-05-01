// POST /api/marketing/upload-finalize
// Confirms a signed-URL upload completed successfully. Optionally tags the asset
// with campaign metadata that wasn't passed at sign time.
//
// Body: { asset_id, campaign_tag? }
// Returns: { ok, asset_id, status }

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  let admin;
  try { admin = getSupabaseAdmin(); }
  catch (e: any) { return NextResponse.json({ error: e.message }, { status: 500 }); }

  let body: { asset_id?: string; campaign_tag?: string };
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: 'invalid_json' }, { status: 400 }); }

  const { asset_id, campaign_tag } = body;
  if (!asset_id) return NextResponse.json({ error: 'missing_asset_id' }, { status: 400 });

  // Verify the file actually landed in storage
  const { data: asset } = await admin
    .schema('marketing')
    .from('media_assets')
    .select('asset_id, raw_path, status, sha256')
    .eq('asset_id', asset_id)
    .maybeSingle();

  if (!asset) return NextResponse.json({ error: 'asset_not_found' }, { status: 404 });
  if (!asset.raw_path) return NextResponse.json({ error: 'no_raw_path' }, { status: 400 });

  // Confirm storage object exists (defensive — the signed URL may have failed silently)
  const { data: list } = await admin.storage
    .from('media-raw')
    .list(asset.raw_path.split('/').slice(0, -1).join('/'), {
      search: asset.raw_path.split('/').pop(),
    });
  const found = list?.some(o => o.name === asset.raw_path.split('/').pop());

  if (!found) {
    // Mark as qc_failed so we don't leak orphan rows
    await admin
      .schema('marketing')
      .from('media_assets')
      .update({ status: 'qc_failed', qc_flags: ['storage_object_missing'] })
      .eq('asset_id', asset_id);
    return NextResponse.json({ error: 'storage_object_missing' }, { status: 422 });
  }

  // Optional campaign tagging via free-keyword
  if (campaign_tag && campaign_tag.length <= 64) {
    await admin
      .schema('marketing')
      .from('media_keywords_free')
      .insert({ asset_id, keyword: campaign_tag.toLowerCase().trim(), source: 'human' });
  }

  return NextResponse.json({ ok: true, asset_id, status: asset.status });
}
