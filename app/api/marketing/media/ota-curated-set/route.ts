// app/api/marketing/media/ota-curated-set/route.ts
// GET ?property_id=X&channel=booking_com → returns the DYNAMIC curated set
// from public.v_media_ota_curated_set (auto-refreshes when new photos land).
import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const url = new URL(req.url);
  const propertyId = Number(url.searchParams.get('property_id') ?? 260955);
  const channel    = url.searchParams.get('channel');
  const onlySelected = url.searchParams.get('only_selected') !== 'false';

  if (!channel) return NextResponse.json({ error: 'channel_required' }, { status: 400 });

  const sb = getSupabaseAdmin();
  let q = sb.from('v_media_ota_curated_set').select('*').eq('property_id', propertyId).eq('channel', channel);
  if (onlySelected) q = q.eq('is_selected', true);
  const { data, error } = await q.order('bucket_key').order('rank_in_bucket');
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ rows: data ?? [] }, { headers: { 'Cache-Control': 'no-store' } });
}
