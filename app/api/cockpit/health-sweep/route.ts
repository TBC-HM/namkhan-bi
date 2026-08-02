// app/api/cockpit/health-sweep/route.ts
// Post-deploy + 6h cron URL health crawler.
// Auth: Authorization: Bearer {CRON_SHARED_SECRET}
// Fetches ~17 key routes concurrently via HEAD, stores results in
// public.health_check_runs. Returns JSON summary with any failures.

import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

const BASE = 'https://namkhan-bi.vercel.app';

const URLS = [
  // IT2 core nav
  '/holding/it2',
  '/holding/it2/fleet/tasks',
  '/holding/it2/knowledge/docs',
  '/holding/it2/knowledge/goals',
  '/holding/it2/fleet/skills',
  '/holding/it2/fleet/memory',
  '/holding/it2/fleet/team',
  // IT2 system
  '/holding/it2/system/deploys',
  '/holding/it2/system/health',
  '/holding/it2/system/activity',
  '/holding/it2/modules/status',
  // Holding
  '/holding/finance/costs',
  '/holding/sales/onboarding',
  // Property (Namkhan 260955)
  '/h/260955',
  '/h/260955/finance/costs',
  '/h/260955/settings/knowledge',
  // API sentinel
  '/api/health',
];

export async function GET(req: Request) {
  const auth = req.headers.get('authorization') ?? '';
  const secret = process.env.CRON_SHARED_SECRET;
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const trigger = new URL(req.url).searchParams.get('trigger') ?? 'cron';
  const runId = crypto.randomUUID();
  const runAt = new Date().toISOString();

  const results = await Promise.all(
    URLS.map(async (path) => {
      const t0 = Date.now();
      try {
        const res = await fetch(`${BASE}${path}`, {
          method: 'HEAD',
          cache: 'no-store',
          signal: AbortSignal.timeout(8000),
          headers: { 'x-health-sweep': '1' },
        });
        return {
          run_id: runId, run_at: runAt, trigger,
          url: path, status_code: res.status,
          ok: res.status < 400, latency_ms: Date.now() - t0, error_msg: null,
        };
      } catch (e: unknown) {
        return {
          run_id: runId, run_at: runAt, trigger,
          url: path, status_code: null, ok: false,
          latency_ms: Date.now() - t0,
          error_msg: e instanceof Error ? e.message.slice(0, 120) : 'fetch failed',
        };
      }
    })
  );

  const sb = getSupabaseAdmin();
  const { error } = await sb.from('health_check_runs').insert(results);
  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  const failed = results.filter((r) => !r.ok);
  return NextResponse.json({
    ok: failed.length === 0,
    run_id: runId,
    trigger,
    checked: results.length,
    failed: failed.length,
    failures: failed.map((r) => ({ url: r.url, status: r.status_code, error: r.error_msg })),
    run_at: runAt,
  });
}
