// app/api/cron/ta-reviews-dataforseo/route.ts
// Weekly cron: pulls TripAdvisor reviews via DataForSEO Business Data API,
// ingests them into mkt_reviews, and aggregates subcategory ratings.
//
// Requires migrations:
//   db/proposed/ta-dataforseo-enrichment-v1/001_mkt_ta_subcategory_ratings.sql
//   db/proposed/ta-dataforseo-enrichment-v1/002_ta_property_config.sql
//
// Run ta-urlpath-discover first to cache the url_path. This route reads it
// from marketing.ta_property_config and fails clearly if not found.
//
// DataForSEO endpoint: business_data/tripadvisor/reviews/live
// Pulls up to 4,490 reviews across 45 pages (depth=100 per page).
// Each item carries reviews_rating with 6 subcategory scores (1-5 scale).
//
// pg_cron: SELECT cron.schedule('ta-reviews-dataforseo', '0 4 * * 1',
//   $$SELECT net.http_post(url => 'https://app.beyondcircle.ai/api/cron/ta-reviews-dataforseo',
//      headers => '{"x-cron-secret":"<CRON_SHARED_SECRET>"}'::jsonb)$$);

import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 295;

const PROPERTY_ID = 260955;
// Pull 100 reviews per page; up to 45 pages = 4,500 reviews (DataForSEO cap)
const DEPTH = 100;
const MAX_PAGES = 45;

function authGate(req: Request): NextResponse | null {
  const required = process.env.CRON_SHARED_SECRET ?? process.env.CRON_SECRET;
  if (!required) return NextResponse.json({ ok: false, error: 'cron_secret_not_configured' }, { status: 503 });
  const provided = req.headers.get('x-cron-secret') ?? '';
  if (provided !== required) return NextResponse.json({ ok: false, error: 'cron_secret_invalid' }, { status: 401 });
  return null;
}

interface TaSubRating {
  value: number | null;
  rooms: number | null;
  location: number | null;
  cleanliness: number | null;
  service: number | null;
  sleep_quality: number | null;
}

interface TaReviewHighlight {
  feature: string;
  assessment: string | number;
}

interface TaReviewItem {
  id?: string | number;
  date?: string;
  rating?: { value?: number } | number;
  title?: string;
  text?: string;
  user_profile?: { name?: string; location?: string };
  review_highlights?: TaReviewHighlight[];
  owner_answer?: { text?: string };
}

// DataForSEO returns subcategories in review_highlights array, not a flat object.
// feature names: "Value", "Rooms", "Location", "Cleanliness", "Service", "Sleep Quality"
function extractSubRating(highlights: TaReviewHighlight[] | undefined): TaSubRating | null {
  if (!highlights || highlights.length === 0) return null;
  const find = (name: string) => {
    const h = highlights.find((h) => h.feature.toLowerCase() === name.toLowerCase());
    if (!h) return null;
    const v = typeof h.assessment === 'number' ? h.assessment : parseFloat(String(h.assessment));
    return Number.isFinite(v) ? v : null;
  };
  return {
    value:         find('value'),
    rooms:         find('rooms'),
    location:      find('location'),
    cleanliness:   find('cleanliness'),
    service:       find('service'),
    sleep_quality: find('sleep quality'),
  };
}

function num(v: unknown): number | null {
  return typeof v === 'number' && Number.isFinite(v) ? v : null;
}

function mapTaReview(it: TaReviewItem, urlPath: string): Record<string, unknown> | null {
  const rid = String(it.id ?? '');
  if (!rid) return null;

  const ratingVal = typeof it.rating === 'object' ? num(it.rating?.value) : num(it.rating as number);
  const hasReply = typeof it.owner_answer?.text === 'string' && it.owner_answer.text.length > 5;

  // Build a unique source_review_id scoped to the url_path to avoid conflicts
  const source_review_id = `ta:${urlPath.slice(0, 60)}:${rid}`;

  return {
    source_review_id,
    reviewer_name:    it.user_profile?.name ?? null,
    reviewer_country: it.user_profile?.location ?? null,
    rating_raw:       ratingVal,
    rating_scale:     5,
    title:            it.title ?? null,
    body:             it.text ?? null,
    language:         null,
    reviewed_at:      it.date ? new Date(it.date).toISOString() : null,
    response_status:  hasReply ? 'responded' : 'unanswered',
    response_text:    hasReply ? (it.owner_answer?.text ?? null) : null,
    responded_by:     hasReply ? 'the_namkhan' : null,
    raw:              it,
  };
}

function avg(nums: (number | null)[]): number | null {
  const valid = nums.filter((n): n is number => n !== null && Number.isFinite(n));
  if (valid.length === 0) return null;
  return Math.round((valid.reduce((s, n) => s + n, 0) / valid.length) * 100) / 100;
}

export async function POST(req: Request) {
  const gate = authGate(req);
  if (gate) return gate;

  const sb = getSupabaseAdmin();

  // Read cached url_path via public bridge view (table lives in marketing schema)
  const { data: config } = await sb
    .from('v_ta_property_config')
    .select('url_path')
    .eq('property_id', PROPERTY_ID)
    .maybeSingle();

  if (!config?.url_path) {
    return NextResponse.json({
      ok: false,
      error: 'ta_url_path_not_cached',
      hint: 'Run /api/cron/ta-urlpath-discover first',
    }, { status: 400 });
  }

  const url_path = config.url_path as string;

  // Get DataForSEO credentials
  const { data: creds } = await sb.rpc('fn_dataforseo_credentials');
  if (!creds) return NextResponse.json({ ok: false, error: 'dataforseo_creds_missing' }, { status: 500 });

  const started = Date.now();
  let totalInserted = 0;
  let totalFetched = 0;
  const subcatAccum: TaSubRating[] = [];
  // Collect reviews with owner replies so we can backfill response_status + response_text
  // on rows that already existed in DB (ON CONFLICT DO NOTHING skipped them during ingest).
  const respondedSourceIds: string[] = [];
  const respondedTextMap = new Map<string, string>(); // source_review_id → response_text

  for (let page = 0; page < MAX_PAGES; page++) {
    const res = await fetch('https://api.dataforseo.com/v3/business_data/tripadvisor/reviews/live', {
      method: 'POST',
      headers: { 'Authorization': `Basic ${creds}`, 'Content-Type': 'application/json' },
      body: JSON.stringify([{
        url_path,
        depth: DEPTH,
        offset: page * DEPTH,
        language_code: 'en',
      }]),
    });

    if (!res.ok) break;

    const json = await res.json();
    const items: TaReviewItem[] = json?.tasks?.[0]?.result?.[0]?.items ?? [];
    if (items.length === 0) break; // no more pages

    totalFetched += items.length;

    // Collect subcategory scores from this page (DataForSEO returns review_highlights array)
    for (const it of items) {
      const sub = extractSubRating(it.review_highlights);
      if (sub) subcatAccum.push(sub);
    }

    // Map and ingest into mkt_reviews
    const rows = items.map((it) => mapTaReview(it, url_path)).filter(Boolean);
    if (rows.length > 0) {
      const { data: ingestData } = await sb.rpc('fn_reviews_ingest_apify', {
        p_source: 'tripadvisor',
        p_property_id: PROPERTY_ID,
        p_rows: rows as unknown as object,
      });
      totalInserted += Number((ingestData as Record<string, unknown>)?.inserted ?? rows.length);
    }

    // Collect reviews that have owner replies on this page
    for (const row of rows as Array<Record<string, unknown>>) {
      if (row.response_status === 'responded' && typeof row.source_review_id === 'string') {
        respondedSourceIds.push(row.source_review_id);
        respondedTextMap.set(row.source_review_id, String(row.response_text ?? ''));
      }
    }

    // Stop early if fewer items than DEPTH (last page)
    if (items.length < DEPTH) break;
  }

  // Fix response_status on existing rows that already existed in DB (ON CONFLICT DO NOTHING
  // skipped them during ingest, but they may have been imported without owner_answer data).
  let respondedUpdated = 0;
  if (respondedSourceIds.length > 0) {
    const { data: updatedRows } = await sb.from('mkt_reviews')
      .update({ response_status: 'responded', responded_by: 'the_namkhan' })
      .eq('source', 'tripadvisor')
      .eq('property_id', PROPERTY_ID)
      .in('source_review_id', respondedSourceIds)
      .neq('response_status', 'responded')
      .select('id');
    respondedUpdated = updatedRows?.length ?? 0;
    // Backfill response_text per row (batch update can't set different values per row)
    for (const [sid, text] of respondedTextMap) {
      if (!text) continue;
      await sb.from('mkt_reviews')
        .update({ response_text: text })
        .eq('source', 'tripadvisor')
        .eq('property_id', PROPERTY_ID)
        .eq('source_review_id', sid)
        .is('response_text', null);
    }
  }

  // Aggregate subcategory scores and store
  if (subcatAccum.length > 0) {
    const subcatRow = {
      property_id:           PROPERTY_ID,
      scraped_at:            new Date().toISOString(),
      total_reviews_pulled:  totalFetched,
      avg_rating:            avg([
        ...subcatAccum.map((s) => s.value),
        ...subcatAccum.map((s) => s.rooms),
        ...subcatAccum.map((s) => s.location),
        ...subcatAccum.map((s) => s.cleanliness),
        ...subcatAccum.map((s) => s.service),
        ...subcatAccum.map((s) => s.sleep_quality),
      ]),
      value_rating:          avg(subcatAccum.map((s) => s.value)),
      rooms_rating:          avg(subcatAccum.map((s) => s.rooms)),
      location_rating:       avg(subcatAccum.map((s) => s.location)),
      cleanliness_rating:    avg(subcatAccum.map((s) => s.cleanliness)),
      service_rating:        avg(subcatAccum.map((s) => s.service)),
      sleep_quality_rating:  avg(subcatAccum.map((s) => s.sleep_quality)),
      raw: {
        url_path,
        total_reviews_with_subcats: subcatAccum.length,
      },
    };

    await sb.rpc('fn_ta_subcategory_insert', { p_row: subcatRow });
  }

  return NextResponse.json({
    ok: true,
    url_path,
    total_fetched: totalFetched,
    total_inserted: totalInserted,
    responded_status_updated: respondedUpdated,
    subcategory_reviews_counted: subcatAccum.length,
    duration_ms: Date.now() - started,
  });
}

// GET not exported — POST only, so secrets stay out of URLs and logs.
