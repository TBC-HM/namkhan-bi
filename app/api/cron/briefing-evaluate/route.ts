// app/api/cron/briefing-evaluate/route.ts
// PBS 2026-07-17 — dynamic briefing ingest.
// GET  /api/cron/briefing-evaluate            → all properties (Namkhan + Donna)
// GET  /api/cron/briefing-evaluate?pid=260955 → single property
// POST is accepted with same behaviour (used by Refresh button on /revenue/briefing).
//
// Fires from Vercel cron @ 23:00 UTC daily = 06:00 Vientiane (Namkhan tz).
// Also callable manually so the rev manager can hit "Refresh" for intra-day
// evaluation without waiting 24h.
//
// Pipeline: for each property → load live context → evaluate all rules
// (parity + rateplans + revenue forward-window) → upsert every fired Insight
// into briefing.items via fn_briefing_upsert. Idempotent on (property_id,
// source_area, source_key) so re-runs update existing rows in-place.

import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { evaluateForBriefings, insightToUpsertArgs } from '@/lib/rules/evaluateForBriefings';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 120;

const NAMKHAN_ID = 260955;
const DONNA_ID   = 1000001;

async function handle(req: Request) {
  const url = new URL(req.url);
  const pidParam = url.searchParams.get('pid') ?? url.searchParams.get('propertyId');
  const properties: number[] = pidParam
    ? [Number(pidParam)].filter((n) => Number.isFinite(n) && n > 0)
    : [NAMKHAN_ID, DONNA_ID];

  const sb = getSupabaseAdmin();
  const started_at = new Date().toISOString();
  const results: Array<{ property_id: number; insights: number; upserted: number; errors: number; errorSample?: string }> = [];

  for (const propertyId of properties) {
    let insightCount = 0;
    let upserted = 0;
    let errors = 0;
    let errorSample: string | undefined;
    try {
      const insights = await evaluateForBriefings(propertyId);
      insightCount = insights.length;
      for (const insight of insights) {
        const args = insightToUpsertArgs(propertyId, insight);
        const { error } = await sb.rpc('fn_briefing_upsert', args);
        if (error) {
          errors += 1;
          if (!errorSample) errorSample = error.message;
        } else {
          upserted += 1;
        }
      }
    } catch (e) {
      errors += 1;
      errorSample = e instanceof Error ? e.message : String(e);
    }
    results.push({ property_id: propertyId, insights: insightCount, upserted, errors, errorSample });
  }

  return NextResponse.json({ ok: true, started_at, finished_at: new Date().toISOString(), results });
}

export async function GET(req: Request)  { return handle(req); }
export async function POST(req: Request) { return handle(req); }
