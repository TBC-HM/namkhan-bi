// app/api/cron/ta-urlpath-discover/route.ts
// One-shot cron: discovers the property's TripAdvisor url_path via DataForSEO
// Business Data Search endpoint and caches it in marketing.ta_property_config.
// Run once per property. After that, ta-reviews-dataforseo reads from the cache.
//
// Requires migration: db/proposed/ta-dataforseo-enrichment-v1/002_ta_property_config.sql
//
// pg_cron: SELECT cron.schedule('ta-urlpath-discover', '0 3 * * 1',
//   $$SELECT net.http_post(url => 'https://app.beyondcircle.ai/api/cron/ta-urlpath-discover',
//      headers => '{"x-cron-secret":"<CRON_SHARED_SECRET>"}'::jsonb)$$);

import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

function authGate(req: Request): NextResponse | null {
  const required = process.env.CRON_SHARED_SECRET ?? process.env.CRON_SECRET;
  if (!required) return NextResponse.json({ ok: false, error: 'cron_secret_not_configured' }, { status: 503 });
  const provided = req.headers.get('x-cron-secret') ?? '';
  if (provided !== required) return NextResponse.json({ ok: false, error: 'cron_secret_invalid' }, { status: 401 });
  return null;
}

// Namkhan property — DataForSEO search keyword + location
const PROPERTY_ID = 260955;
const SEARCH_KEYWORD = 'Namkhan Boutique Hotel';
const SEARCH_LOCATION = 'Luang Prabang,Luang Prabang,Laos';

export async function POST(req: Request) {
  const gate = authGate(req);
  if (gate) return gate;

  const sb = getSupabaseAdmin();

  // Check if already cached
  const { data: existing } = await sb
    .from('ta_property_config')
    .select('url_path, discovered_at')
    .eq('property_id', PROPERTY_ID)
    .maybeSingle();

  if (existing?.url_path) {
    return NextResponse.json({ ok: true, cached: true, url_path: existing.url_path, discovered_at: existing.discovered_at });
  }

  // Get DataForSEO credentials
  const { data: creds } = await sb.rpc('fn_dataforseo_credentials');
  if (!creds) return NextResponse.json({ ok: false, error: 'dataforseo_creds_missing' }, { status: 500 });

  // Search for the property's TripAdvisor listing
  const res = await fetch('https://api.dataforseo.com/v3/business_data/tripadvisor/search/live', {
    method: 'POST',
    headers: { 'Authorization': `Basic ${creds}`, 'Content-Type': 'application/json' },
    body: JSON.stringify([{
      keyword: SEARCH_KEYWORD,
      location_name: SEARCH_LOCATION,
      language_code: 'en',
    }]),
  });

  if (!res.ok) {
    const text = await res.text();
    return NextResponse.json({ ok: false, error: `dataforseo_http_${res.status}`, detail: text }, { status: 502 });
  }

  const json = await res.json();
  const items: Record<string, unknown>[] = json?.tasks?.[0]?.result?.[0]?.items ?? [];

  if (items.length === 0) {
    return NextResponse.json({ ok: false, error: 'no_results', keyword: SEARCH_KEYWORD });
  }

  // Best match: first result with url_path starting with /Hotel_Review
  const match = items.find((it) =>
    typeof it.url_path === 'string' && it.url_path.startsWith('/Hotel_Review')
  ) ?? items[0];

  const url_path = match?.url_path as string | null;
  if (!url_path) {
    return NextResponse.json({ ok: false, error: 'no_url_path', items: items.slice(0, 3) });
  }

  // Cache in marketing.ta_property_config
  await sb.from('ta_property_config').upsert({
    property_id: PROPERTY_ID,
    url_path,
    discovered_at: new Date().toISOString(),
    raw: match,
  }, { onConflict: 'property_id' });

  return NextResponse.json({ ok: true, cached: false, url_path, name: match?.name, rating: match?.rating });
}

// GET not exported — POST only, so secrets stay out of URLs and logs.
