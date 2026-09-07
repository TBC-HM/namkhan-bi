// app/api/cron/gbp-reviews-dataforseo/route.ts
// Weekly cron: pulls Google Business Profile reviews via DataForSEO Business Data API,
// ingests them into mkt_reviews (source='google'), and fixes response_status on existing rows.
//
// This bypasses the GBP Management API allowlist entirely — DataForSEO scrapes
// Google Maps reviews directly via keyword + location search.
// For posting replies, the google-sync edge function is still needed (and is now
// non-blocking: reply/route.ts saves to DB first, syncs to Google when API is active).
//
// No DB migrations required — uses existing fn_reviews_ingest_apify + mkt_reviews.
//
// DataForSEO endpoint: business_data/google/reviews/live
// Keyword: 'Namkhan Boutique Hotel' · Location: 'Luang Prabang,Luang Prabang,Laos'
// Depth 100 · up to 10 pages = 1,000 reviews max.
//
// pg_cron: SELECT cron.schedule('gbp-reviews-dataforseo', '0 3 * * 1',
//   $$SELECT net.http_post(url => 'https://app.beyondcircle.ai/api/cron/gbp-reviews-dataforseo',
//      headers => '{"x-cron-secret":"<CRON_SHARED_SECRET>"}'::jsonb)$$);

import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

const PROPERTY_ID = 260955;
const SEARCH_KEYWORD = 'Namkhan Boutique Hotel';
const SEARCH_LOCATION = 'Luang Prabang,Luang Prabang,Laos';
const DEPTH = 100;
const MAX_PAGES = 10; // Google reviews typically < 1,000 total

function authGate(req: Request): NextResponse | null {
  const required = process.env.CRON_SHARED_SECRET ?? process.env.CRON_SECRET;
  if (!required) return NextResponse.json({ ok: false, error: 'cron_secret_not_configured' }, { status: 503 });
  const provided = req.headers.get('x-cron-secret') ?? '';
  if (provided !== required) return NextResponse.json({ ok: false, error: 'cron_secret_invalid' }, { status: 401 });
  return null;
}

// DataForSEO Google reviews item shape
interface GbpReviewItem {
  review_id?: string | number;
  author_title?: string;
  author_url?: string;
  rating?: { value?: number } | number;
  timestamp?: string;
  review_text?: string;
  owner_answer?: { text?: string; timestamp?: string } | null;
}

function num(v: unknown): number | null {
  return typeof v === 'number' && Number.isFinite(v) ? v : null;
}

function mapGbpReview(it: GbpReviewItem): Record<string, unknown> | null {
  const rid = String(it.review_id ?? '').trim();
  if (!rid) return null;

  const ratingVal = typeof it.rating === 'object'
    ? num((it.rating as { value?: number })?.value)
    : num(it.rating as number);

  const replyText = typeof it.owner_answer?.text === 'string' && it.owner_answer.text.length > 5
    ? it.owner_answer.text
    : null;

  return {
    source_review_id: `google:${rid}`,
    reviewer_name:    it.author_title ?? null,
    reviewer_country: null,
    rating_raw:       ratingVal,
    rating_scale:     5,
    rating_norm:      ratingVal,
    title:            null,
    body:             it.review_text ?? null,
    language:         null,
    reviewed_at:      it.timestamp ? new Date(it.timestamp).toISOString() : null,
    response_status:  replyText ? 'responded' : 'unanswered',
    response_text:    replyText,
    responded_by:     replyText ? 'the_namkhan' : null,
    raw:              it,
  };
}

export async function POST(req: Request) {
  const gate = authGate(req);
  if (gate) return gate;

  const sb = getSupabaseAdmin();
  const { data: creds } = await sb.rpc('fn_dataforseo_credentials');
  if (!creds) return NextResponse.json({ ok: false, error: 'dataforseo_creds_missing' }, { status: 500 });

  const started = Date.now();
  let totalFetched = 0;
  let totalInserted = 0;
  const respondedSourceIds: string[] = [];

  for (let page = 0; page < MAX_PAGES; page++) {
    const res = await fetch('https://api.dataforseo.com/v3/business_data/google/reviews/live', {
      method: 'POST',
      headers: { 'Authorization': `Basic ${creds}`, 'Content-Type': 'application/json' },
      body: JSON.stringify([{
        keyword:       SEARCH_KEYWORD,
        location_name: SEARCH_LOCATION,
        language_code: 'en',
        depth:         DEPTH,
        offset:        page * DEPTH,
        sort_by:       'most_relevant',
      }]),
    });

    if (!res.ok) break;

    const json = await res.json();
    const items: GbpReviewItem[] = json?.tasks?.[0]?.result?.[0]?.items ?? [];
    if (items.length === 0) break;

    totalFetched += items.length;

    const rows = items.map(mapGbpReview).filter(Boolean);
    if (rows.length > 0) {
      const { data: ingestData } = await sb.rpc('fn_reviews_ingest_apify', {
        p_source:      'google',
        p_property_id: PROPERTY_ID,
        p_rows:        rows as unknown as object,
      });
      totalInserted += Number((ingestData as Record<string, unknown>)?.inserted ?? rows.length);
    }

    // Collect IDs of reviews that have hotel replies
    for (const row of rows as Array<Record<string, unknown>>) {
      if (row.response_status === 'responded' && typeof row.source_review_id === 'string') {
        respondedSourceIds.push(row.source_review_id);
      }
    }

    if (items.length < DEPTH) break;
  }

  // Fix response_status on rows that existed before this cron ran (ON CONFLICT DO NOTHING
  // in fn_reviews_ingest_apify skips existing rows; this pass corrects stale 'unanswered').
  let respondedUpdated = 0;
  if (respondedSourceIds.length > 0) {
    const { data: updatedRows } = await sb.from('mkt_reviews')
      .update({ response_status: 'responded', responded_by: 'the_namkhan' })
      .eq('source', 'google')
      .eq('property_id', PROPERTY_ID)
      .in('source_review_id', respondedSourceIds)
      .neq('response_status', 'responded')
      .select('id');
    respondedUpdated = updatedRows?.length ?? 0;
  }

  return NextResponse.json({
    ok: true,
    keyword: SEARCH_KEYWORD,
    total_fetched: totalFetched,
    total_inserted: totalInserted,
    responded_status_updated: respondedUpdated,
    duration_ms: Date.now() - started,
  });
}

// GET not exported — POST only, so secrets stay out of URLs and logs.
