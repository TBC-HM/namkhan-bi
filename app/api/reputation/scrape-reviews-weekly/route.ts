// app/api/reputation/scrape-reviews-weekly/route.ts
// PBS 2026-07-06: Weekly runner. Runs every active source through its Apify actor.
// `ON CONFLICT DO NOTHING` in fn_reviews_ingest_apify dedups on
// (source, source_review_id) so only NEW reviews are inserted → money saved.
//
// 2026-07-29 (GBP completion brief §5.8): the inner per-source call is now a DIRECT
// IMPORT of the scrape route handler instead of an HTTP self-fetch. The old self-fetch
// hit the auth middleware unauthenticated and silently 401'd (second defect of the
// job-126 stall). pg_cron no longer targets this route — it fires the secret-gated
// shim at /api/cron/reviews-scrape-weekly. This route remains for authenticated
// manual/browser use, behavior otherwise unchanged.
import { NextResponse } from 'next/server';
import { POST as scrapePOST } from '@/app/api/reputation/scrape-reviews/route';

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

  const results: Array<Record<string, unknown>> = [];
  for (const source of SOURCES) {
    try {
      const inner = new Request('http://internal.local/api/reputation/scrape-reviews', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ source, max: 100 }),  // last 100 per source per week
      });
      const res = await scrapePOST(inner);
      const j = await res.json();
      results.push({ source, http_status: res.status, ...j });
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
