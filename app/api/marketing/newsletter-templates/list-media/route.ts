// app/api/marketing/newsletter-templates/list-media/route.ts
// PBS 2026-07-22 · Fix 404 on Email Chrome → Pick from media library.
// Feeds MediaPickerModal in EmailChromePanel. Returns approved image assets
// (excludes tier_archive and status=removed/qc_failed) so marketers can only
// pick from the vetted library. Shape: { ok, rows: MediaAsset[] } matching
// the picker's expected fields (id, original_filename, quality_index, public_url).

import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const sb = getSupabaseAdmin();

  const q = await sb
    .from('v_marketing_media_page')
    .select('asset_id, original_filename, primary_tier, property_area, qc_score, status, public_url, asset_type, width_px, height_px')
    .neq('primary_tier', 'tier_archive')
    .not('status', 'in', '(removed,qc_failed)')
    .order('qc_score', { ascending: false, nullsFirst: false })
    .limit(500);

  if (q.error) return NextResponse.json({ ok: false, error: q.error.message }, { status: 500 });

  const rows = (q.data ?? [])
    .filter((r: any) => r.asset_type !== 'video')
    .map((r: any) => ({
      id: r.asset_id,
      original_filename: r.original_filename,
      quality_index: r.qc_score,
      public_url: r.public_url,
      property_area: r.property_area,
      primary_tier: r.primary_tier,
      width_px: r.width_px,
      height_px: r.height_px,
    }));

  return NextResponse.json({ ok: true, rows });
}
