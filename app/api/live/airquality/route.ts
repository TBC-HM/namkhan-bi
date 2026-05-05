// app/api/live/airquality/route.ts
// GET /api/live/airquality  — current air quality for The Namkhan via Open-Meteo (free, no key).

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(_req: NextRequest) {
  let admin;
  try { admin = getSupabaseAdmin(); }
  catch (e: any) { return NextResponse.json({ ok: false, error: e.message }, { status: 500 }); }

  let lat = 19.867528, lng = 102.213611, locationName = 'Luang Prabang';
  try {
    const { data } = await admin.schema('marketing').from('property_profile')
      .select('latitude, longitude, city').eq('property_id', 260955).maybeSingle();
    if (data?.latitude && data?.longitude) {
      lat = Number(data.latitude); lng = Number(data.longitude);
      locationName = data.city || locationName;
    }
  } catch {}

  const url =
    `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${lat}&longitude=${lng}` +
    `&current=us_aqi,european_aqi,pm10,pm2_5,carbon_monoxide,ozone,nitrogen_dioxide,sulphur_dioxide` +
    `&hourly=pm2_5,pm10,us_aqi&timezone=Asia%2FBangkok&forecast_days=2`;
  const resp = await fetch(url, { cache: 'no-store' });
  if (!resp.ok) {
    return NextResponse.json({ ok: false, error: `open-meteo-air ${resp.status}` }, { status: 502 });
  }
  const data = await resp.json();

  // Tag the AQI band so UI can color-code
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
    location: { name: locationName, lat, lng },
    current: data.current,
    band,
    hourly: data.hourly,
    source: 'open-meteo.com (Air Quality)',
    fetched_at: new Date().toISOString(),
  });
}
