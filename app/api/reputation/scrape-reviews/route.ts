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
  // Placeholder — swap in tri_angle~hotel-review-aggregator or similar when tested
  expedia: {
    slug: 'tri_angle~hotel-review-aggregator',
    buildInput: (url, max) => ({ startUrls: [{ url }], maxReviews: max }),
  },
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
  return {
    source_review_id: rid,
    reviewer_name:  (it.userName    as string) || null,
    reviewer_country: (it.userCountry as string) || null,
    rating_raw:     (it.rating      as number) ?? null,
    rating_scale:   10,
    title:          (it.reviewTitle as string) || null,
    body,
    language:       (it.language    as string) || null,
    reviewed_at:    (it.reviewedAt  as string) || (it.reviewDate as string) || null,
    raw:            it,
  };
}

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
  // Fallback: hardcode Namkhan Booking URL if the view lookup fails.
  const url = body.url
    ?? 'https://www.booking.com/hotel/la/namkhan-ecolodge.html';
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

  const mapped = items.map(mapBookingReview).filter(Boolean) as Record<string, unknown>[];

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