// app/api/live/airquality/route.ts
// GET /api/live/airquality?property_id=NNN — current air quality.
// Coords from property.location; falls back to Luang Prabang.

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const NAMKHAN_PROPERTY_ID = 260955;
const FALLBACK_LAT = 19.867528;
const FALLBACK_LNG = 102.213611;
const FALLBACK_CITY = 'Luang Prabang';
const FALLBACK_TZ = 'Asia/Vientiane';

export async function GET(req: NextRequest) {
  let admin;
  try { admin = getSupabaseAdmin(); }
  catch (e: any) { return NextResponse.json({ ok: false, error: e.message }, { status: 500 }); }

  const propertyId = Number(req.nextUrl.searchParams.get('property_id')) || NAMKHAN_PROPERTY_ID;

  let lat = FALLBACK_LAT, lng = FALLBACK_LNG;
  let locationName = FALLBACK_CITY;
  let tz = FALLBACK_TZ;
  try {
    const { data } = await admin.schema('property').from('location')
      .select('latitude, longitude, city, country, timezone')
      .eq('property_id', propertyId).maybeSingle();
    if (data?.latitude && data?.longitude) {
      lat = Number(data.latitude);
      lng = Number(data.longitude);
      locationName = data.city ? (data.country ? `${data.city}, ${data.country}` : data.city) : locationName;
      if (data.timezone) tz = data.timezone;
    }
  } catch { /* fall back */ }

  const url =
    `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${lat}&longitude=${lng}` +
    `&current=us_aqi,european_aqi,pm10,pm2_5,carbon_monoxide,ozone,nitrogen_dioxide,sulphur_dioxide` +
    `&hourly=pm2_5,pm10,us_aqi&timezone=${encodeURIComponent(tz)}&forecast_days=2`;
  const resp = await fetch(url, { cache: 'no-store' });
  if (!resp.ok) {
    return NextResponse.json({ ok: false, error: `open-meteo-air ${resp.status}` }, { status: 502 });
  }
  const data = await resp.json();

  const aqi = data.current?.us_aqi as number | undefined;
  let band = 'unknown';
  if (typeof aqi === 'number') {
    if (aqi <= 50) band = 'good';
    else if (aqi <= 100) band = 'moderate';
    else if (aqi <= 150) band = 'unhealthy_sensitive';
    else if (aqi <= 200) band = 'unhealthy';
    else if (aqi <= 300) band = 'very_unhealthy';
    else band = 'hazardous';
  }

  return NextResponse.json({
    ok: true,
    location: { name: locationName, lat, lng, timezone: tz, property_id: propertyId },
    current: data.current,
    band,
    hourly: data.hourly,
    source: 'open-meteo.com (Air Quality)',
    fetched_at: new Date().toISOString(),
  });
}
