'use server';
// app/holding/it2/system/health/actions.ts
// Manual sweep — runs directly (no HTTP round-trip, bypasses middleware).
// Covers full application: IT2 + holding pages + property pages.

import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

const BASE = 'https://namkhan-bi.vercel.app';

const URLS = [
  // IT2 — Action Center
  '/holding/it2',
  '/holding/it2/fleet/tasks',
  '/holding/it2/fleet/bugs',
  '/holding/it2/system/live',
  // IT2 — Knowledge
  '/holding/it2/knowledge/docs',
  '/holding/it2/knowledge/goals',
  '/holding/it2/fleet/skills',
  '/holding/it2/fleet/memory',
  '/holding/it2/fleet/team',
  // IT2 — Build + System
  '/holding/it2/modules/status',
  '/holding/it2/system/deploys',
  '/holding/it2/system/health',
  '/holding/it2/system/activity',
  // Holding
  '/holding/finance/costs',
  '/holding/sales/onboarding',
  // Namkhan property (260955)
  '/h/260955',
  '/h/260955/revenue',
  '/h/260955/marketing',
  '/h/260955/operations',
  '/h/260955/sales',
  '/h/260955/finance/costs',
  '/h/260955/settings/knowledge',
  '/h/260955/reports',
  '/h/260955/guests',
];

export async function runHealthSweep(): Promise<{
  ok: boolean; checked?: number; failed?: number;
  failures?: Array<{ url: string; status: number | null; error: string | null }>;
  error?: string;
}> {
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
          run_id: runId, run_at: runAt, trigger: 'manual',
          url: path, status_code: res.status,
          ok: res.status < 400, latency_ms: Date.now() - t0, error_msg: null,
        };
      } catch (e: unknown) {
        return {
          run_id: runId, run_at: runAt, trigger: 'manual',
          url: path, status_code: null, ok: false,
          latency_ms: Date.now() - t0,
          error_msg: e instanceof Error ? e.message.slice(0, 120) : 'fetch failed',
        };
      }
    })
  );

  const sb = getSupabaseAdmin();
  const { error } = await sb.from('health_check_runs').insert(results);
  if (error) return { ok: false, error: error.message };

  const failed = results.filter((r) => !r.ok);
  return {
    ok: failed.length === 0,
    checked: results.length,
    failed: failed.length,
    failures: failed.map((r) => ({ url: r.url, status: r.status_code, error: r.error_msg })),
  };
}
