// app/api/cron/flights/route.ts
// GET /api/cron/flights — refreshes news.cached_flights from OpenSky Network.
// Triggered by Vercel Cron every 4h.

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const ICAO = 'VLLB';

export async function GET(_req: NextRequest) {
  let admin;
  try { admin = getSupabaseAdmin(); }
  catch (e: any) { return NextResponse.json({ ok: false, error: e.message }, { status: 500 }); }

  const now = Math.floor(Date.now() / 1000);
  const begin = now - 24 * 3600; // last 24h

  const fetchOne = async (kind: 'arrival' | 'departure') => {
    try {
      const url = `https://opensky-network.org/api/flights/${kind}?airport=${ICAO}&begin=${begin}&end=${now}`;
      const r = await fetch(url, {
        headers: { 'user-agent': 'NamkhanBI/1.0 cron' },
        signal: AbortSignal.timeout(15000),
      });
      if (!r.ok) return [];
      const rows = await r.json();
      return Array.isArray(rows) ? rows : [];
    } catch { return []; }
  };

  const [arrivals, departures] = await Promise.all([fetchOne('arrival'), fetchOne('departure')]);

  // Wipe old entries for this airport, then insert fresh
  await admin.schema('news').from('cached_flights')
    .delete().eq('airport_icao', ICAO);

  const rows = [
    ...arrivals.map((r: any) => ({
      airport_icao: ICAO, direction: 'arrival',
      callsign: r.callsign?.trim() || null, icao24: r.icao24 || null,
      origin_airport: r.estDepartureAirport || null, dest_airport: r.estArrivalAirport || null,
      first_seen: r.firstSeen ? new Date(r.firstSeen * 1000).toISOString() : null,
      last_seen: r.lastSeen ? new Date(r.lastSeen * 1000).toISOString() : null,
    })),
    ...departures.map((r: any) => ({
      airport_icao: ICAO, direction: 'departure',
      callsign: r.callsign?.trim() || null, icao24: r.icao24 || null,
      origin_airport: r.estDepartureAirport || null, dest_airport: r.estArrivalAirport || null,
      first_seen: r.firstSeen ? new Date(r.firstSeen * 1000).toISOString() : null,
      last_seen: r.lastSeen ? new Date(r.lastSeen * 1000).toISOString() : null,
    })),
  ];

  if (rows.length > 0) {
    const { error } = await admin.schema('news').from('cached_flights').insert(rows);
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    arrivals: arrivals.length,
    departures: departures.length,
    fetched_at: new Date().toISOString(),
  });
}
