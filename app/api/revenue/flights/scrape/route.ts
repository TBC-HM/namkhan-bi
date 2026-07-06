// app/api/revenue/flights/scrape/route.ts
// PBS 2026-07-06: Google Flights → revenue.flights_to_lpq via Apify actor
// johnvc/Google-Flights-Data-Scraper-Flight-and-Price-Search (~$0.01/1k results).
// Input: origin (IATA), dateFrom, dateTo, currency. Runs actor, maps output, inserts.

import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

const ACTOR_SLUG = 'johnvc~Google-Flights-Data-Scraper-Flight-and-Price-Search';

interface Req {
  origin: string;       // 'BKK', 'CNX', 'HAN', etc.
  destination?: string; // default 'LPQ'
  date_from: string;    // ISO date
  date_to: string;      // ISO date
  currency?: string;    // default 'USD'
  adults?: number;      // default 1
}

interface FlightRow {
  flight_date: string;
  origin: string;
  destination: string;
  airline?: string | null;
  flight_number?: string | null;
  dep_time_local?: string | null;
  arr_time_local?: string | null;
  duration_min?: number | null;
  stops?: number | null;
  price_lowest?: number | null;
  currency?: string;
  booking_url?: string | null;
  raw?: unknown;
}

function toDate(s: unknown): string | null {
  if (typeof s !== 'string') return null;
  const m = s.match(/^(\d{4}-\d{2}-\d{2})/);
  return m ? m[1] : null;
}

export async function POST(req: Request) {
  const started = Date.now();
  let body: Req;
  try { body = await req.json(); }
  catch { return NextResponse.json({ ok: false, error: 'invalid_json' }, { status: 400 }); }

  const origin = (body.origin || '').toUpperCase();
  const destination = (body.destination || 'LPQ').toUpperCase();
  if (!/^[A-Z]{3}$/.test(origin))       return NextResponse.json({ ok: false, error: 'invalid_origin_iata' },       { status: 400 });
  if (!/^[A-Z]{3}$/.test(destination))  return NextResponse.json({ ok: false, error: 'invalid_destination_iata' },  { status: 400 });

  const sb = getSupabaseAdmin();
  const { data: tokenData, error: tokenErr } = await sb.rpc('fn_read_vault_secret', { p_name: 'apify_api_token' });
  if (tokenErr || !tokenData) return NextResponse.json({ ok: false, error: 'vault_read_failed' }, { status: 500 });
  const token = String(tokenData);

  const input = {
    origins: [origin],
    destinations: [destination],
    dateFrom: body.date_from,
    dateTo: body.date_to,
    currency: body.currency || 'USD',
    adults: body.adults ?? 1,
    typeOfTrip: 'oneway',
  };

  const url = `https://api.apify.com/v2/acts/${ACTOR_SLUG}/run-sync-get-dataset-items?token=${encodeURIComponent(token)}&timeout=240&format=json&clean=1`;
  let items: Array<Record<string, unknown>> = [];
  let apifyStatus = 0;
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    });
    apifyStatus = res.status;
    if (!res.ok) {
      const errText = await res.text();
      return NextResponse.json({ ok: false, error: 'apify_error', status: res.status, detail: errText.slice(0, 500) }, { status: 502 });
    }
    const parsed = await res.json();
    items = Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    return NextResponse.json({ ok: false, error: 'apify_fetch_failed', detail: e instanceof Error ? e.message : String(e) }, { status: 502 });
  }

  // Map each flight-result item to our schema.
  // Google Flights actor typical keys: { departureAirport, arrivalAirport, departureTime, arrivalTime,
  //   airline, flightNumber, price{amount, currency}, stops, durationInMinutes, bookingLink, date }
  const rows: FlightRow[] = [];
  for (const it of items) {
    const price = it.price as Record<string, unknown> | undefined;
    const dep = (it.departureTime as string) || (it.departureAt as string) || '';
    const arr = (it.arrivalTime as string) || (it.arrivalAt as string) || '';
    rows.push({
      flight_date: toDate(dep) || toDate(it.date as string) || '',
      origin,
      destination,
      airline: (it.airline as string) || (it.carrier as string) || null,
      flight_number: (it.flightNumber as string) || (it.flight_number as string) || null,
      dep_time_local: dep ? dep.slice(11, 16) : null,
      arr_time_local: arr ? arr.slice(11, 16) : null,
      duration_min: (it.durationInMinutes as number) || (it.duration as number) || null,
      stops: (it.stops as number) ?? (it.numberOfStops as number) ?? null,
      price_lowest: (price?.amount as number) ?? (it.price_amount as number) ?? (it.priceLowest as number) ?? null,
      currency: (price?.currency as string) || (it.currency as string) || 'USD',
      booking_url: (it.bookingLink as string) || (it.deepLink as string) || null,
      raw: it,
    });
  }
  const filtered = rows.filter((r) => r.flight_date);

  const { data: ingestData, error: ingestErr } = await sb.rpc('fn_flights_ingest', {
    p_rows: filtered as unknown as object,
  });
  if (ingestErr) {
    return NextResponse.json({ ok: false, error: 'ingest_failed', detail: ingestErr.message, apify_status: apifyStatus }, { status: 500 });
  }

  const stats = (ingestData ?? {}) as { inserted?: number };
  return NextResponse.json({
    ok: true,
    origin, destination,
    items_returned: items.length,
    inserted: stats.inserted ?? 0,
    duration_ms: Date.now() - started,
    debug: {
      sample_keys: items.length > 0 ? Object.keys(items[0]).sort() : [],
    },
  });
}