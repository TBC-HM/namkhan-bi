// app/api/operations/flights-today/route.ts
// PBS 2026-07-06: On-demand fetch of today+tomorrow flights for Operations HoD.
// Iterates 4 origin markets (BKK/CNX/HAN/VTE) via the existing /revenue/flights ingest RPC.
// Returns rows relevant to the Ops container (today & tomorrow only).
import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

const ORIGINS = ['BKK', 'CNX', 'HAN', 'VTE'];
const ACTOR_SLUG = 'johnvc~Google-Flights-Data-Scraper-Flight-and-Price-Search';

export async function POST() {
  const started = Date.now();
  const sb = getSupabaseAdmin();

  const { data: tokenData, error: tokenErr } = await sb.rpc('fn_read_vault_secret', { p_name: 'apify_api_token' });
  if (tokenErr || !tokenData) return NextResponse.json({ ok: false, error: 'vault_read_failed' }, { status: 500 });
  const token = String(tokenData);

  const today = new Date().toISOString().slice(0, 10);
  const tomorrow = new Date(Date.now() + 86400_000).toISOString().slice(0, 10);

  let total_items = 0;
  let total_inserted = 0;
  const origins_fetched: string[] = [];

  for (const origin of ORIGINS) {
    const url = `https://api.apify.com/v2/acts/${ACTOR_SLUG}/run-sync-get-dataset-items?token=${encodeURIComponent(token)}&timeout=180&format=json&clean=1`;
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          origins: [origin],
          destinations: ['LPQ'],
          dateFrom: today,
          dateTo: tomorrow,
          currency: 'USD',
          adults: 1,
          typeOfTrip: 'oneway',
        }),
      });
      if (!res.ok) continue;
      const parsed = await res.json();
      const items: Array<Record<string, unknown>> = Array.isArray(parsed) ? parsed : [];
      total_items += items.length;
      origins_fetched.push(origin);

      const rows = items.map(it => {
        const price = it.price as Record<string, unknown> | undefined;
        const dep = (it.departureTime as string) || (it.departureAt as string) || '';
        const arr = (it.arrivalTime as string) || (it.arrivalAt as string) || '';
        const m = dep.match(/^(\d{4}-\d{2}-\d{2})/);
        return {
          flight_date: m ? m[1] : today,
          origin,
          destination: 'LPQ',
          airline: (it.airline as string) || (it.carrier as string) || null,
          flight_number: (it.flightNumber as string) || null,
          dep_time_local: dep ? dep.slice(11, 16) : null,
          arr_time_local: arr ? arr.slice(11, 16) : null,
          duration_min: (it.durationInMinutes as number) || (it.duration as number) || null,
          stops: (it.stops as number) ?? null,
          price_lowest: (price?.amount as number) ?? (it.price_amount as number) ?? null,
          currency: (price?.currency as string) || 'USD',
          booking_url: (it.bookingLink as string) || (it.deepLink as string) || null,
          raw: it,
        };
      });

      const { data: ingestData } = await sb.rpc('fn_flights_ingest', { p_rows: rows as unknown as object });
      total_inserted += (ingestData as { inserted?: number } | null)?.inserted ?? 0;
    } catch { /* continue with next origin */ }
  }

  // Return today+tomorrow rows from DB (may include earlier-fetched entries)
  const { data: rowsData } = await sb
    .from('v_flights_to_lpq')
    .select('flight_date, origin, destination, airline, flight_number, dep_time_local, arr_time_local, price_lowest, currency')
    .gte('flight_date', today)
    .lte('flight_date', tomorrow)
    .order('flight_date', { ascending: true })
    .order('dep_time_local', { ascending: true })
    .limit(200);

  return NextResponse.json({
    ok: true,
    items_returned: total_items,
    inserted: total_inserted,
    origins_fetched: origins_fetched.length,
    rows: rowsData ?? [],
    duration_ms: Date.now() - started,
  });
}