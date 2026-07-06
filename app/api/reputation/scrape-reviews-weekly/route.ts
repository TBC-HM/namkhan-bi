// app/api/reputation/scrape-reviews-weekly/route.ts
// PBS 2026-07-06: Weekly cron target. Runs every active source in marketing.review_scrape_targets
// through its Apify actor. `ON CONFLICT DO NOTHING` in fn_reviews_ingest_apify dedups on
// (source, source_review_id) so only NEW reviews are inserted → money saved.
//
// Wired to pg_cron: 'reviews-scrape-weekly-sunday' at `0 13 * * 0` (Sunday 13:00 UTC = 20:00 Laos).
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 900; // Vercel Pro — up to 15 min total for all sources

const SOURCES: Array<'booking' | 'expedia'> = ['booking', 'expedia'];

export async function POST() {
  return runAll();
}
export async function GET() {
  return runAll();
}

async function runAll() {
  const started = Date.now();
  const base = process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : 'https://namkhan-bi.vercel.app';

  const results: Array<Record<string, unknown>> = [];
  for (const source of SOURCES) {
    try {
      const r = await fetch(`${base}/api/reputation/scrape-reviews`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ source, max: 100 }),  // last 100 per source per week
      });
      const j = await r.json();
      results.push({ source, ...j });
    } catch (e) {
      results.push({ source, ok: false, error: e instanceof Error ? e.message : String(e) });
    }
  }

  return NextResponse.json({
    ok: true,
    ran: results.length,
    total_inserted: results.reduce((s, r) => s + Number(r.inserted ?? 0), 0),
    per_source: results,
    duration_ms: Date.now() - started,
  });
}