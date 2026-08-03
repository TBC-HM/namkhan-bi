// app/api/reputation/scrape-reviews/route.ts
// PBS 2026-07-06: Booking reviews via Apify (voyager/booking-reviews-scraper).
// Replaces the Nimble scraper that's been failing on Booking. Ships reviews into marketing.reviews.
import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

const ACTORS: Record<string, { slug: string; buildInput: (url: string, max: number) => Record<string, unknown> }> = {
  booking: {
    slug: 'voyager~booking-reviews-scraper',
    buildInput: (url, max) => ({
      startUrls: [{ url }],
      maxReviewsPerHotel: max,
      sortReviewsBy: 'f_recent_desc',
    }),
  },
  expedia: {
    // 2026-08-03 (GBP brief §0.B expedia round 2): tri_angle~hotel-review-aggregator
    // is a proven dead end for this property — its provider "Get Urls" matcher finds
    // no Booking/Expedia pages for The Namkhan even from a valid Google place id
    // (run Q3e0HHPqSbbdGH3Qd log: "[booking] Failed to get any URLs"), and its input
    // schema accepts no direct provider URLs. tri_angle~expedia-hotels-com-reviews-
    // scraper is blocked by its ghost-fetch gateway (403 insufficient-permissions for
    // this token); shahidirfan~expedia-reviews-scraper 402s on the plan's remaining
    // usage. mof1re~expedia-reviews-scraper runs on the existing token/plan and
    // returned real Namkhan reviews on the 2026-08-03 dry-run (net resp 1061110).
    slug: 'mof1re~expedia-reviews-scraper',
    buildInput: (url, max) => ({ listingUrls: [url], maxResults: max, sortBy: 'most_recent' }),
  },
};

// Per-source canonical target URLs (GBP brief §0.V.7 objection fix, 2026-08-03).
// ROOT CAUSE of expedia=0-rows-ever: the single fallback in POST was the
// BOOKING.COM url for every source, so the expedia actor scraped the wrong
// site and returned an empty dataset with HTTP 200 (items_returned:0 on the
// 07-29 dry-run and the 08-02 live fire — actor-input bug, not transport).
// The expedia URL is the canonical row from property.social
// (property_id 260955, platform='expedia') — looked up, never invented.
const SOURCE_URLS: Record<string, string> = {
  booking: 'https://www.booking.com/hotel/la/namkhan-ecolodge.html',
  expedia: 'https://www.expedia.com/Luang-Prabang-Hotels-NamKhan-Ecolodge.h39493734.Hotel-Information',
};

interface Req {
  source: 'booking' | 'expedia';
  url?: string;
  max?: number;
  property_id?: number;
}

// Map a booking-reviews-scraper item onto our marketing.reviews shape.
// Actor typical keys (voyager): userName, userCountry, rating (0-10), reviewTitle,
// likedText, dislikedText, stayDate (yyyy-mm), reviewedAt (ISO), reviewId
function mapBookingReview(it: Record<string, unknown>): Record<string, unknown> | null {
  const rid = String(it.reviewId ?? it.id ?? '');
  if (!rid) return null;
  const liked   = (it.likedText   as string) || '';
  const disliked= (it.dislikedText as string) || '';
  const body = [liked && `+ ${liked}`, disliked && `- ${disliked}`].filter(Boolean).join('\n\n') || null;
  // Parse userLocation ("New York, USA") → country segment (last comma-separated piece).
  const userLoc = (it.userLocation as string) || (it.userCountry as string) || '';
  const country = userLoc.includes(',')
    ? userLoc.split(',').pop()?.trim().slice(0, 2).toUpperCase() || null
    : userLoc.slice(0, 2).toUpperCase() || null;
  // Detect property reply → mark responded.
  const propertyResponse = (it.propertyResponse as string) || null;
  const hasResponse = typeof propertyResponse === 'string' && propertyResponse.length > 5;
  return {
    source_review_id: rid,
    reviewer_name:  (it.userName    as string) || null,
    reviewer_country: country,
    rating_raw:     (it.rating      as number) ?? null,
    rating_scale:   10,
    title:          (it.reviewTitle as string) || null,
    body,
    language:       (it.reviewLanguage as string) || (it.language as string) || null,
    reviewed_at:    (it.reviewedAt  as string) || (it.reviewDate as string) || null,
    response_status: hasResponse ? 'responded' : 'unanswered',
    response_text:   hasResponse ? propertyResponse : null,
    responded_by:    hasResponse ? 'the_namkhan' : null,
    raw:            it,
  };
}

// Map a mof1re~expedia-reviews-scraper item onto marketing.reviews.
// Verified item shape from the 2026-08-03 dry-run (net resp 1061110):
// review_id, rating_number (10-scale), rating_value "10/10", rating_text,
// review_locale ("ja_JP"|null), review_title, review_text, what_liked,
// what_disliked, review_date "Jun 30, 2026", review_reply_title,
// review_reply_text, reviewer_name, review_is_verified, travel_type.
// Old aggregator key spellings are kept as fallbacks; unmapped keys survive in `raw`.
function mapExpediaReview(it: Record<string, unknown>): Record<string, unknown> | null {
  const rid = String(it.review_id ?? it.reviewId ?? it.id ?? '');
  if (!rid) return null;
  const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);
  const str = (v: unknown): string | null => (typeof v === 'string' && v.length > 0 ? v : null);
  const ratingRaw = num(it.rating_number) ?? num(it.rating) ?? num(it.score) ?? num(it.overallRating) ?? null;
  const ratingScale = ratingRaw != null && ratingRaw <= 5 ? 5 : 10;
  // Body: review text plus the structured liked/disliked lines Expedia appends.
  const text = str(it.review_text) ?? str(it.text) ?? str(it.reviewText) ?? str(it.body) ?? null;
  const liked = str(it.what_liked);
  const disliked = str(it.what_disliked);
  const body = [text, liked && `+ ${liked}`, disliked && `- ${disliked}`].filter(Boolean).join('\n\n') || null;
  const responseText =
    str(it.review_reply_text) ?? str(it.propertyResponse) ?? str(it.managementResponse) ?? null;
  const hasResponse = responseText != null && responseText.length > 5;
  // review_date arrives as "Jun 30, 2026" — normalize to ISO for reviewed_at.
  const rawDate = str(it.review_date) ?? str(it.reviewedAt) ?? str(it.reviewDate) ?? str(it.publishedDate) ?? null;
  let reviewedAt: string | null = null;
  if (rawDate) {
    const parsed = new Date(rawDate);
    reviewedAt = Number.isNaN(parsed.getTime()) ? rawDate : parsed.toISOString();
  }
  // review_locale "ja_JP" → language "ja".
  const locale = str(it.review_locale) ?? str(it.reviewLanguage) ?? str(it.language) ?? null;
  const language = locale ? locale.split(/[_-]/)[0] : null;
  return {
    source_review_id: rid,
    reviewer_name: str(it.reviewer_name) ?? str(it.userName) ?? str(it.author) ?? str(it.reviewerName) ?? null,
    reviewer_country: str(it.userCountry) ?? str(it.country) ?? null,
    rating_raw: ratingRaw,
    rating_scale: ratingScale,
    title: str(it.review_title) ?? str(it.reviewTitle) ?? str(it.title) ?? null,
    body,
    language,
    reviewed_at: reviewedAt,
    response_status: hasResponse ? 'responded' : 'unanswered',
    response_text: hasResponse ? responseText : null,
    responded_by: hasResponse ? 'the_namkhan' : null,
    raw: it,
  };
}

const MAPPERS: Record<string, (it: Record<string, unknown>) => Record<string, unknown> | null> = {
  booking: mapBookingReview,
  expedia: mapExpediaReview,
};

export async function POST(req: Request) {
  const started = Date.now();
  let body: Req;
  try { body = await req.json(); }
  catch { return NextResponse.json({ ok: false, error: 'invalid_json' }, { status: 400 }); }

  const source = body.source;
  if (!source || !ACTORS[source]) return NextResponse.json({ ok: false, error: 'unknown_source' }, { status: 400 });

  const sb = getSupabaseAdmin();
  const { data: cfg } = await sb
    .from('review_scrape_targets_v')  // fallback if we don't have a public view
    .select('url, property_id')
    .maybeSingle();
  // Per-source canonical fallback — the old single booking.com fallback sent
  // the expedia actor to the wrong site (0 items forever, GBP §0.V.7).
  const url = body.url ?? SOURCE_URLS[source];
  const property_id = body.property_id ?? cfg?.property_id ?? 260955;
  const max = Math.max(1, Math.min(500, body.max ?? 10));

  const { data: tokenData, error: tokenErr } = await sb.rpc('fn_read_vault_secret', { p_name: 'apify_api_token' });
  if (tokenErr || !tokenData) return NextResponse.json({ ok: false, error: 'vault_read_failed' }, { status: 500 });
  const token = String(tokenData);

  const actorCfg = ACTORS[source];
  const apifyUrl = `https://api.apify.com/v2/acts/${actorCfg.slug}/run-sync-get-dataset-items?token=${encodeURIComponent(token)}&timeout=240&format=json&clean=1`;
  let items: Array<Record<string, unknown>> = [];
  let apifyStatus = 0;
  try {
    const res = await fetch(apifyUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(actorCfg.buildInput(url, max)),
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

  const mapped = items.map(MAPPERS[source] ?? mapBookingReview).filter(Boolean) as Record<string, unknown>[];

  const { data: ingestData, error: ingestErr } = await sb.rpc('fn_reviews_ingest_apify', {
    p_source: source,
    p_property_id: property_id,
    p_rows: mapped as unknown as object,
  });
  if (ingestErr) {
    return NextResponse.json({ ok: false, error: 'ingest_failed', detail: ingestErr.message, apify_status: apifyStatus }, { status: 500 });
  }

  const stats = (ingestData ?? {}) as { inserted?: number };
  return NextResponse.json({
    ok: true,
    source,
    items_returned: items.length,
    mapped_rows: mapped.length,
    inserted: stats.inserted ?? 0,
    duration_ms: Date.now() - started,
    debug: {
      sample_keys: items.length > 0 ? Object.keys(items[0]).sort() : [],
      first_review_id: items[0]?.reviewId ?? items[0]?.id ?? null,
    },
  });
}