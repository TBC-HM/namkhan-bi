// app/holding/it2/system/data-quality/page.tsx
// dq-engine-v1 — DQ Engine: freshness posture, open exceptions, rule catalog,
// weekly trend. Reads public.v_dq_* bridges (L5); actions via fn_dq_* RPCs.
// Nav: NO new System tab (7 already — law 659); reached via Health link card +
// scripts/check-it2-orphans.mjs allowlist ("linked contextually" pattern).

import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { DqClient } from './DqClient';
import type { DqPostureRow, DqExceptionRow, DqRuleRow, DqTrendRow, DqRunRow } from './DqClient';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';

export default async function DataQualityPage() {
  const sb = getSupabaseAdmin();
  const [postureRes, excRes, rulesRes, trendRes, runsRes] = await Promise.all([
    (sb as any).from('v_dq_posture').select('*'),
    (sb as any).from('v_dq_exceptions_open').select('*'),
    (sb as any).from('v_dq_rules').select('*'),
    (sb as any).from('v_dq_trend_weekly').select('*'),
    (sb as any).from('v_dq_runs_recent').select('*').limit(24),
  ]);

  const posture = (postureRes.data ?? []) as DqPostureRow[];
  const exceptions = (excRes.data ?? []) as DqExceptionRow[];
  const rules = (rulesRes.data ?? []) as DqRuleRow[];
  const trend = (trendRes.data ?? []) as DqTrendRow[];
  const runs = (runsRes.data ?? []) as DqRunRow[];

  const loadError =
    postureRes.error?.message ?? excRes.error?.message ?? rulesRes.error?.message ??
    trendRes.error?.message ?? runsRes.error?.message ?? null;

  return (
    <DqClient
      posture={posture}
      exceptions={exceptions}
      rules={rules}
      trend={trend}
      runs={runs}
      loadError={loadError}
    />
  );
}
