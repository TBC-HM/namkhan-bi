// app/api/live/weather/route.ts
// GET /api/live/weather  — current weather + 7-day forecast for The Namkhan via Open-Meteo (free, no key).
//
// Lat/lng pulled from marketing.property_profile when available, falls back to
// hardcoded Don Keo Village (Luang Prabang) coords.

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const FALLBACK_LAT = 19.867528;
const FALLBACK_LNG = 102.213611;

export async function GET(_req: NextRequest) {
  let admin;
  try { admin = getSupabaseAdmin(); }
  catch (e: any) { return NextResponse.json({ ok: false, error: e.message }, { status: 500 }); }

  // Resolve coords from property_profile
  let lat = FALLBACK_LAT, lng = FALLBACK_LNG, locationName = 'Luang Prabang, Laos';
  try {
    const { data } = await admin.schema('marketing').from('property_profile')
      .select('latitude, longitude, trading_name, city')
      .eq('property_id', 260955).maybeSingle();
    if (data?.latitude && data?.longitude) {
      lat = Number(data.latitude); lng = Number(data.longitude);
      locationName = data.trading_name || data.city || locationName;
    }
  } catch {}

  // Open-Meteo: current + 7d forecast in one call
  const url =
    `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}` +
    `&current=temperature_2m,relative_humidity_2m,apparent_temperature,is_day,precipitation,weather_code,wind_speed_10m` +
    `&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max,wind_speed_10m_max` +
    `&timezone=Asia%2FBangkok&forecast_days=7`;
  const resp = await fetch(url, { cache: 'no-store' });
  if (!resp.ok) {
    return NextResponse.json({ ok: false, error: `open-meteo ${resp.status}` }, { status: 502 });
  }
  const data = await resp.json();
  return NextResponse.json({
    ok: true,
    location: { name: locationName, lat, lng },
    current: data.current,
    daily: data.daily,
    units: { temp: '°C', wind: 'km/h', precip: 'mm' },
    source: 'open-meteo.com',
    fetched_at: new Date().toISOString(),
  });
}
