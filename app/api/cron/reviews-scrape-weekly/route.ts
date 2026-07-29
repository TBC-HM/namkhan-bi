// app/api/cron/reviews-scrape-weekly/route.ts
// GBP completion brief (autospec-gbp_module-20260725) §5.8 · 2026-07-29.
// Middleware-bypassed, secret-gated cron shim for the weekly Apify review scrape.
// Root cause fixed here: pg_cron job 126 posted to /api/reputation/scrape-reviews-weekly
// with no x-cron-secret → middleware 401'd every Sunday fire since 07-06 while
// cron.job_run_details showed "succeeded" (the silent-401 signature, third occurrence).
// This shim (a) lives under /api/cron (middleware-exempt), (b) enforces
// CRON_SHARED_SECRET, and (c) calls the Apify scrape logic via direct import —
// no HTTP self-fetch, so no second auth hop to 401.
import { NextResponse } from 'next/server';
import { POST as scrapePOST } from '@/app/api/reputation/scrape-reviews/route';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 800; // Vercel Pro — both sources, worst case

const SOURCES: Array<'booking' | 'expedia'> = ['booking', 'expedia'];

function authGate(req: Request): NextResponse | null {
  // Same pattern as /api/cron/yt_* shims: CRON_SHARED_SECRET is what pg_cron sends.
  const required = process.env.CRON_SHARED_SECRET ?? process.env.CRON_SECRET;
  if (!required) return null;
  const url = new URL(req.url);
  const provided = url.searchParams.get('secret') ?? req.headers.get('x-cron-secret') ?? '';
  if (provided !== required) return NextResponse.json({ ok: false, error: 'cron_secret_invalid' }, { status: 401 });
  return null;
}

export async function POST(req: Request) {
  const gate = authGate(req);
  if (gate) return gate;

  const started = Date.now();
  const results: Array<Record<string, unknown>> = [];
  for (const source of SOURCES) {
    try {
      const inner = new Request('http://cron.local/api/reputation/scrape-reviews', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ source, max: 100 }), // last 100 per source per week
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
export const GET = POST;
