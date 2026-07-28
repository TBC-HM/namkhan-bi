// app/api/cron/newsletter-quality-sweep/route.ts
// QUALITY GATE sweep — reviews scheduled/sending campaigns and persists
// verdicts; the enqueue fns block on latest verdict='fail'.
//
// v1.1 (2026-07-28): TIME-BUDGETED. 14 campaigns × (LLM + link checks)
// blew the 300s function ceiling and runs died mid-sweep (6 of 14 rows,
// then silence). Now: hard 230s budget, stalest-review-first ordering, and
// an honest partial report — the nightly cron catches whatever is left on
// its next pass. GET ?campaign_id=<uuid> reviews exactly one.

import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { reviewCampaign, VALIDATOR_VERSION } from '@/lib/content/reviewEngine';
import { automationGuard } from '@/lib/cron/guard';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

const TIME_BUDGET_MS = 230_000;

export async function GET(req: Request) {
  const blocked = await automationGuard('/api/cron/newsletter-quality-sweep');
  if (blocked) return blocked;
  const started = Date.now();
  const url = new URL(req.url);
  const one = url.searchParams.get('campaign_id');
  const sb = getSupabaseAdmin();

  let ids: string[] = [];
  if (one) ids = [one];
  else {
    // Stalest latest-review first (never reviewed = oldest of all)
    const { data } = await sb.schema('guest').from('campaigns')
      .select('campaign_id')
      .in('status', ['scheduled', 'sending'])
      .is('archived_at', null)
      .limit(60);
    const all = (data ?? []).map((r: { campaign_id: string }) => r.campaign_id);
    const { data: latest } = await (sb as any).from('v_content_reviews')
      .select('campaign_id, run_at')
      .in('campaign_id', all)
      .order('run_at', { ascending: false });
    const latestByCampaign = new Map<string, string>();
    for (const r of (latest ?? []) as Array<{ campaign_id: string; run_at: string }>) {
      if (!latestByCampaign.has(r.campaign_id)) latestByCampaign.set(r.campaign_id, r.run_at);
    }
    ids = all.sort((a, b) =>
      (latestByCampaign.get(a) ?? '1970').localeCompare(latestByCampaign.get(b) ?? '1970'));
  }

  const results: Array<{ campaign_id: string; verdict?: string; score?: number; error?: string }> = [];
  let skippedForBudget = 0;
  for (const id of ids) {
    if (Date.now() - started > TIME_BUDGET_MS) { skippedForBudget = ids.length - results.length; break; }
    try {
      const r = await reviewCampaign(id, one ? 'manual' : 'nightly-sweep');
      results.push({ campaign_id: id, verdict: r.verdict, score: r.score });
    } catch (e) {
      results.push({ campaign_id: id, error: e instanceof Error ? e.message : String(e) });
    }
  }
  const fails = results.filter((r) => r.verdict === 'fail');
  return NextResponse.json({
    ok: true, validator_version: VALIDATOR_VERSION,
    reviewed: results.length, blocked: fails.length,
    skipped_for_time_budget: skippedForBudget,
    note: skippedForBudget > 0 ? 'partial run — next pass picks up the stalest remainder first' : 'complete pass',
    results,
  });
}
