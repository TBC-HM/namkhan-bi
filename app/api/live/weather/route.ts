// app/api/live/weather/route.ts
// GET /api/live/weather?property_id=NNN — current weather + 7-day forecast.
//
// Coords pulled from property.location (latitude, longitude, city, timezone).
// Falls back to Don Keo Village (Luang Prabang) coords if the property has
// no row, no lat/lng, or no property_id query param.

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

  // Resolve coords from property.location
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
  } catch { /* fall back to Namkhan defaults */ }

  // Open-Meteo: current + 7d forecast in one call
  const url =
    `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}` +
    `&current=temperature_2m,relative_humidity_2m,apparent_temperature,is_day,precipitation,weather_code,wind_speed_10m` +
    `&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max,wind_speed_10m_max` +
    `&timezone=${encodeURIComponent(tz)}&forecast_days=7`;
  const resp = await fetch(url, { cache: 'no-store' });
  if (!resp.ok) {
    return NextResponse.json({ ok: false, error: `open-meteo ${resp.status}` }, { status: 502 });
  }
  const data = await resp.json();
  return NextResponse.json({
    ok: true,
    location: { name: locationName, lat, lng, timezone: tz, property_id: propertyId },
    current: data.current,
    daily: data.daily,
    units: { temp: '°C', wind: 'km/h', precip: 'mm' },
    source: 'open-meteo.com',
    fetched_at: new Date().toISOString(),
  });
}
