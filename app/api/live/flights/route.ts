// app/api/live/flights/route.ts
// GET /api/live/flights?direction=both|arrival|departure&hours=24
// Live LPQ (Luang Prabang) flights via OpenSky Network (free, no API key).
// LPQ ICAO = VLLB. Anonymous limit ~100 calls/day per IP — plenty for portal use.

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const ICAO = 'VLLB';

type Flight = {
  callsign: string | null;
  icao24: string | null;
  origin_airport: string | null;
  dest_airport: string | null;
  first_seen: string | null;
  last_seen: string | null;
  scheduled: string | null;
};

function shape(rows: any[]): Flight[] {
  return rows.map(r => ({
    callsign: r.callsign?.trim() || null,
    icao24: r.icao24 || null,
    origin_airport: r.estDepartureAirport || null,
    dest_airport: r.estArrivalAirport || null,
    first_seen: r.firstSeen ? new Date(r.firstSeen * 1000).toISOString() : null,
    last_seen: r.lastSeen ? new Date(r.lastSeen * 1000).toISOString() : null,
    scheduled: null,
  }));
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const direction = (searchParams.get('direction') || 'both').toLowerCase();
  const hours = Math.min(168, Math.max(1, parseInt(searchParams.get('hours') || '24')));
  const skipCache = searchParams.get('fresh') === '1';

  // 1. Cache first (populated by /api/cron/flights every 4h)
  if (!skipCache) {
    try {
      const admin = getSupabaseAdmin();
      const { data: cached } = await admin.schema('news').from('cached_flights')
        .select('direction, callsign, icao24, origin_airport, dest_airport, first_seen, last_seen, fetched_at')
        .eq('airport_icao', ICAO);
      if (cached && cached.length > 0) {
        const arrivals = direction !== 'departure'
          ? cached.filter((r: any) => r.direction === 'arrival').map(({direction, ...r}: any) => r)
          : undefined;
        const departures = direction !== 'arrival'
          ? cached.filter((r: any) => r.direction === 'departure').map(({direction, ...r}: any) => r)
          : undefined;
        return NextResponse.json({
          ok: true,
          airport: { icao: ICAO, iata: 'LPQ', name: 'Luang Prabang International' },
          window_hours: hours,
          arrivals, departures,
          summary: { arrivals: arrivals?.length ?? 0, departures: departures?.length ?? 0 },
          source: 'opensky-network.org (cached)',
          fetched_at: cached[0].fetched_at,
          source_mode: 'cache',
        });
      }
    } catch {}
  }

  // OpenSky requires unix timestamps (seconds)
  const now = Math.floor(Date.now() / 1000);
  const begin = now - hours * 3600;
  const end = now;

  const fetchOne = async (kind: 'arrival' | 'departure'): Promise<Flight[]> => {
    const url = `https://opensky-network.org/api/flights/${kind}?airport=${ICAO}&begin=${begin}&end=${end}`;
    try {
      const r = await fetch(url, {
        signal: AbortSignal.timeout(12000),
        headers: { 'user-agent': 'NamkhanBI/1.0 (+https://namkhan-bi.vercel.app)' },
      });
      if (!r.ok) {
        // OpenSky returns 404 when no data in window — that's fine, treat as empty
        if (r.status === 404) return [];
        throw new Error(`opensky ${kind} ${r.status}`);
      }
      const rows = await r.json();
      return shape(Array.isArray(rows) ? rows : []);
    } catch (e: any) {
      console.error('[live/flights]', kind, e?.message);
      return [];
    }
  };

  const results: { arrivals?: Flight[]; departures?: Flight[] } = {};
  if (direction === 'both' || direction === 'arrival') {
    results.arrivals = await fetchOne('arrival');
  }
  if (direction === 'both' || direction === 'departure') {
    results.departures = await fetchOne('departure');
  }

  const totalArr = results.arrivals?.length ?? 0;
  const totalDep = results.departures?.length ?? 0;

  return NextResponse.json({
    ok: true,
    airport: { icao: ICAO, iata: 'LPQ', name: 'Luang Prabang International' },
    window_hours: hours,
    arrivals: results.arrivals,
    departures: results.departures,
    summary: { arrivals: totalArr, departures: totalDep },
    source: 'opensky-network.org',
    fetched_at: new Date().toISOString(),
  });
}
