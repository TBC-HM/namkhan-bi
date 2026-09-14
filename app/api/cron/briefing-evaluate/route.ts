// app/api/cron/briefing-evaluate/route.ts
// PBS 2026-07-17 — dynamic briefing ingest.
// GET  /api/cron/briefing-evaluate              → all properties, revenue + marketing
// GET  /api/cron/briefing-evaluate?pid=260955   → single property
// GET  /api/cron/briefing-evaluate?domain=mkt   → marketing only (for fast refresh)
// POST is accepted with same behaviour (used by Refresh buttons).
//
// Fires from Vercel cron @ 23:00 UTC daily = 06:00 Vientiane (Namkhan tz).
// PBS 2026-09-14: Added marketing domain evaluation.

import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { automationGuard } from '@/lib/cron/guard';
import { evaluateForBriefings, insightToUpsertArgs } from '@/lib/rules/evaluateForBriefings';
import { evaluateForMarketingBriefings, mktInsightToUpsertArgs } from '@/lib/rules/evaluateForMarketingBriefings';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 120;

const NAMKHAN_ID = 260955;
const DONNA_ID   = 1000001;

async function handle(req: Request) {
  // GLOBAL KILL SWITCH (brief ops-scheduler-console-v1 A3): exit early when automation is OFF.
  const blocked = await automationGuard('/api/cron/briefing-evaluate');
  if (blocked) return blocked;

  const url = new URL(req.url);
  const pidParam = url.searchParams.get('pid') ?? url.searchParams.get('propertyId');
  const domainParam = url.searchParams.get('domain'); // 'mkt' | 'rev' | null (= both)
  const properties: number[] = pidParam
    ? [Number(pidParam)].filter((n) => Number.isFinite(n) && n > 0)
    : [NAMKHAN_ID, DONNA_ID];

  const runRevenue   = !domainParam || domainParam === 'rev';
  const runMarketing = !domainParam || domainParam === 'mkt';

  const sb = getSupabaseAdmin();
  const started_at = new Date().toISOString();
  const results: Array<{ property_id: number; domain: string; insights: number; upserted: number; errors: number; errorSample?: string }> = [];

  async function upsertInsights(
    propertyId: number,
    domain: string,
    insights: Awaited<ReturnType<typeof evaluateForBriefings>>,
    toArgs: typeof insightToUpsertArgs | typeof mktInsightToUpsertArgs,
  ) {
    let upserted = 0; let errors = 0; let errorSample: string | undefined;
    for (const insight of insights) {
      const args = toArgs(propertyId, insight);
      const { error } = await sb.rpc('fn_briefing_upsert', args);
      if (error) { errors++; if (!errorSample) errorSample = error.message; }
      else upserted++;
    }
    results.push({ property_id: propertyId, domain, insights: insights.length, upserted, errors, errorSample });
  }

  for (const propertyId of properties) {
    if (runRevenue) {
      try {
        const insights = await evaluateForBriefings(propertyId);
        await upsertInsights(propertyId, 'revenue', insights, insightToUpsertArgs);
      } catch (e) {
        results.push({ property_id: propertyId, domain: 'revenue', insights: 0, upserted: 0, errors: 1,
          errorSample: e instanceof Error ? e.message : String(e) });
      }
    }
    if (runMarketing) {
      try {
        const insights = await evaluateForMarketingBriefings(propertyId);
        await upsertInsights(propertyId, 'marketing', insights, mktInsightToUpsertArgs);
      } catch (e) {
        results.push({ property_id: propertyId, domain: 'marketing', insights: 0, upserted: 0, errors: 1,
          errorSample: e instanceof Error ? e.message : String(e) });
      }
    }
  }

  return NextResponse.json({ ok: true, started_at, finished_at: new Date().toISOString(), results });
}

export async function GET(req: Request)  { return handle(req); }
export async function POST(req: Request) { return handle(req); }
