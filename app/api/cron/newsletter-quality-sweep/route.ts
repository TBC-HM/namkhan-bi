// app/api/cron/newsletter-quality-sweep/route.ts
// QUALITY GATE v1 sweep — reviews every non-archived scheduled/sending
// campaign and persists verdicts. The enqueue fns block on verdict='fail'.
// Called nightly by pg_cron (whitelisted /api/cron/*) and on demand.
// GET ?campaign_id=<uuid> reviews one; GET without params sweeps all.

import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { reviewCampaign } from '@/lib/content/reviewEngine';
import { automationGuard } from '@/lib/cron/guard';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

export async function GET(req: Request) {
  const blocked = await automationGuard('/api/cron/newsletter-quality-sweep');
  if (blocked) return blocked;
  const url = new URL(req.url);
  const one = url.searchParams.get('campaign_id');
  const sb = getSupabaseAdmin();

  let ids: string[] = [];
  if (one) ids = [one];
  else {
    const { data } = await sb.schema('guest').from('campaigns')
      .select('campaign_id')
      .in('status', ['scheduled', 'sending'])
      .is('archived_at', null)
      .limit(60);
    ids = (data ?? []).map((r: { campaign_id: string }) => r.campaign_id);
  }

  const results: Array<{ campaign_id: string; verdict?: string; score?: number; error?: string }> = [];
  for (const id of ids) {
    try {
      const r = await reviewCampaign(id, one ? 'manual' : 'nightly-sweep');
      results.push({ campaign_id: id, verdict: r.verdict, score: r.score });
    } catch (e) {
      results.push({ campaign_id: id, error: e instanceof Error ? e.message : String(e) });
    }
  }
  const fails = results.filter((r) => r.verdict === 'fail');
  return NextResponse.json({ ok: true, reviewed: results.length, blocked: fails.length, results });
}
