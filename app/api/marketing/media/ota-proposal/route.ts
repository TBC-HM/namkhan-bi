// app/api/marketing/media/ota-proposal/route.ts
// GET ?property_id=X → curator eligibility summary per OTA channel.
// Backed by public.v_media_ota_proposal. PBS 2026-07-14 · #197 v1a.
import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const OTA_CHANNELS = ['booking_com','expedia','ctrip','slh','traveloka','airbnb','agoda','tripadvisor'];

export async function GET(req: Request) {
  const url = new URL(req.url);
  const propertyId = Number(url.searchParams.get('property_id') ?? 260955);
  const sb = getSupabaseAdmin();
  const { data, error } = await sb
    .from('v_media_ota_proposal')
    .select('*')
    .eq('property_id', propertyId)
    .in('channel', OTA_CHANNELS);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ rows: data ?? [] }, { headers: { 'Cache-Control': 'no-store' } });
}
