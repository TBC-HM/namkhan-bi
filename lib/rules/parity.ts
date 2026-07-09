// lib/rules/parity.ts
// PBS 2026-07-09: Lighthouse / OTA rate parity rules feeding the Revenue HoD.
// Consumes v_rate_integrity_matrix (own OTA parity) + v_lighthouse_rateshop
// (compset scrape) + v_parity_matrix_pb (compset delta).
// Fires insights on: max own-OTA spread%, spread$, sold-out day count,
// lighthouse scrape staleness, compset undercut share, avg delta vs comp,
// 3d/7d compset rate move.

import type { Insight } from '@/app/_components/ConclusionBlock';

export interface ParityTargets {
  parity_breach_usd?: number;              // lte $
  integrity_max_spread_pct?: number;       // lte %
  integrity_soldout_days_max?: number;     // lte count
  compset_stale_days?: number;             // lte days
  lighthouse_stale_days?: number;          // lte days
  compset_undercut_days_pct?: number;      // lte %
  compset_avg_delta_pct?: number;          // lte %
  compset_rate_change_3d_max_pct?: number; // lte %
  compset_rate_change_7d_max_pct?: number; // lte %
}

export interface ParityContext {
  // Own-OTA integrity
  integritySnapshotDate: string | null;
  integrityStayDatesCount: number;
  integrityMaxSpreadPct: number | null;
  integrityMaxSpreadUsd: number | null;
  integrityAvgSpreadPct: number | null;
  integritySoldOutDays: number;
  integrityWorstStayDate: string | null;
  integrityWorstDirectUsd: number | null;
  integrityWorstMaxOtaName: string | null;
  integrityWorstMaxOtaUsd: number | null;

  // Compset (v_parity_matrix_pb)
  lighthouseSnapshotDate: string | null;
  compsetStayDatesShopped: number;
  compsetUndercutDays: number;           // # stay-dates with >=1 comp under us
  compsetAvgPctVsCheapest: number | null; // % (signed)
  compsetMaxRateChange3dPct: number | null; // max % move in any comp rate over 3d
  compsetMaxRateChange7dPct: number | null;

  targets: ParityTargets;
}

const FB: Required<ParityTargets> = {
  parity_breach_usd: 5,
  integrity_max_spread_pct: 10,
  integrity_soldout_days_max: 5,
  compset_stale_days: 3,
  lighthouse_stale_days: 2,
  compset_undercut_days_pct: 30,
  compset_avg_delta_pct: 15,
  compset_rate_change_3d_max_pct: 20,
  compset_rate_change_7d_max_pct: 30,
};
const T = (ctx: ParityContext, k: keyof ParityTargets) => ctx.targets[k] ?? FB[k];

function daysSince(iso: string | null): number | null {
  if (!iso) return null;
  return Math.max(0, Math.round((Date.now() - new Date(iso + 'T00:00:00Z').getTime()) / 86400_000));
}

type Rule = (ctx: ParityContext) => Insight | null;

const ruleIntegrityMaxSpread: Rule = (ctx) => {
  const threshold = T(ctx, 'integrity_max_spread_pct') / 100;
  const observed = ctx.integrityMaxSpreadPct;
  if (observed == null) return null;
  if (observed <= threshold) return null;
  const worstDate = ctx.integrityWorstStayDate ?? 'unknown';
  const worstOta = ctx.integrityWorstMaxOtaName ?? 'an OTA';
  const direct = ctx.integrityWorstDirectUsd ?? 0;
  const worst = ctx.integrityWorstMaxOtaUsd ?? 0;
  const pctAbove = direct > 0 ? Math.round(((worst - direct) / direct) * 100) : 0;
  return {
    key: 'parity_integrity_max_spread',
    priority: observed >= threshold * 3 ? 'critical' : 'warning',
    title: `Max own-OTA spread ${(observed * 100).toFixed(1)}% (threshold ${(threshold * 100).toFixed(0)}%)`,
    body: `Widest on ${worstDate}: ${worstOta} sits ${pctAbove}% above Brand.com direct.`,
    action: 'Open rate integrity matrix',
    href: '/revenue/parity',
    guardrail: 'fixed',
  };
};

const ruleIntegrityBreachUsd: Rule = (ctx) => {
  const threshold = T(ctx, 'parity_breach_usd');
  const worstUsd = ctx.integrityMaxSpreadUsd;
  if (worstUsd == null) return null;
  if (worstUsd <= threshold) return null;
  const worstDate = ctx.integrityWorstStayDate ?? 'unknown';
  const worstOta = ctx.integrityWorstMaxOtaName ?? 'an OTA';
  return {
    key: 'parity_breach_usd',
    priority: worstUsd >= threshold * 6 ? 'critical' : 'warning',
    title: `Max own-OTA spread $${Math.round(worstUsd)} (threshold $${threshold})`,
    body: `Widest on ${worstDate}: ${worstOta} vs Brand.com direct.`,
    action: 'Open rate integrity matrix',
    href: '/revenue/parity',
    guardrail: 'fixed',
  };
};

const ruleIntegritySoldOutDays: Rule = (ctx) => {
  const threshold = T(ctx, 'integrity_soldout_days_max');
  if (ctx.integritySoldOutDays <= threshold) return null;
  return {
    key: 'parity_integrity_soldout_days',
    priority: 'warning',
    title: `${ctx.integritySoldOutDays} stay-dates have an OTA marked sold-out (threshold ${threshold})`,
    body: 'Agoda / Tiket can silently drop inventory — verify ARI push and rate-plan availability.',
    action: 'Open rate integrity matrix',
    href: '/revenue/parity',
    guardrail: 'fixed',
  };
};

const ruleLighthouseStale: Rule = (ctx) => {
  const threshold = T(ctx, 'lighthouse_stale_days');
  const days = daysSince(ctx.lighthouseSnapshotDate);
  if (days == null) {
    return {
      key: 'parity_lighthouse_missing',
      priority: 'warning',
      title: 'No lighthouse compset scrape on file',
      body: 'Upload a fresh lighthouse xlsx to imports/parity/ to seed the comp-set rateshop.',
      action: 'Open comp rates',
      href: '/revenue/lighthouse/overview',
      guardrail: 'fixed',
    };
  }
  if (days <= threshold) return null;
  return {
    key: 'parity_lighthouse_stale',
    priority: days >= threshold * 3 ? 'critical' : 'warning',
    title: `Comp-rates scrape ${days}d stale (threshold ${threshold}d)`,
    body: `Last shop: ${ctx.lighthouseSnapshotDate}. Refresh the daily lighthouse feed.`,
    action: 'Open comp rates',
    href: '/revenue/lighthouse/overview',
    guardrail: 'fixed',
  };
};

const ruleCompsetUndercutDays: Rule = (ctx) => {
  if (ctx.compsetStayDatesShopped === 0) return null;
  const observedPct = (ctx.compsetUndercutDays / ctx.compsetStayDatesShopped) * 100;
  const threshold = T(ctx, 'compset_undercut_days_pct');
  if (observedPct <= threshold) return null;
  return {
    key: 'compset_undercut_days',
    priority: observedPct >= threshold * 1.6 ? 'critical' : 'warning',
    title: `${Math.round(observedPct)}% of stay-dates undercut by competitors (threshold ${threshold}%)`,
    body: `${ctx.compsetUndercutDays} of ${ctx.compsetStayDatesShopped} shopped stay-dates have >=1 competitor sitting below our rate.`,
    action: 'Open compset',
    href: '/revenue/compset',
    guardrail: 'fixed',
  };
};

const ruleCompsetAvgDelta: Rule = (ctx) => {
  const observed = ctx.compsetAvgPctVsCheapest;
  if (observed == null) return null;
  const threshold = T(ctx, 'compset_avg_delta_pct');
  if (observed <= threshold) return null;
  return {
    key: 'compset_avg_delta',
    priority: observed >= threshold * 2 ? 'critical' : 'warning',
    title: `Sitting ${observed.toFixed(1)}% above cheapest comp on avg (threshold ${threshold}%)`,
    body: 'Persistent premium vs the compset floor. Review rate positioning by stay-date.',
    action: 'Open compset',
    href: '/revenue/compset',
    guardrail: 'fixed',
  };
};

const ruleCompsetRateChange3d: Rule = (ctx) => {
  const observed = ctx.compsetMaxRateChange3dPct;
  if (observed == null) return null;
  const threshold = T(ctx, 'compset_rate_change_3d_max_pct');
  if (observed <= threshold) return null;
  return {
    key: 'compset_rate_change_3d',
    priority: observed >= threshold * 2 ? 'critical' : 'warning',
    title: `Compset rates moved up to ${observed.toFixed(1)}% in the last 3 days`,
    body: 'Comps are actively repricing. Check whether we should follow / hold / step back.',
    action: 'Open comp rates · vs 3 days',
    href: '/revenue/lighthouse/vs-3d',
    guardrail: 'fixed',
  };
};

const ruleCompsetRateChange7d: Rule = (ctx) => {
  const observed = ctx.compsetMaxRateChange7dPct;
  if (observed == null) return null;
  const threshold = T(ctx, 'compset_rate_change_7d_max_pct');
  if (observed <= threshold) return null;
  return {
    key: 'compset_rate_change_7d',
    priority: observed >= threshold * 2 ? 'critical' : 'warning',
    title: `Compset rates moved up to ${observed.toFixed(1)}% in the last 7 days`,
    body: 'Sustained shift in the compset — worth a strategic look at ladder + calendar.',
    action: 'Open comp rates · vs 7 days',
    href: '/revenue/lighthouse/vs-7d',
    guardrail: 'fixed',
  };
};

const ALL: Rule[] = [
  ruleIntegrityMaxSpread,
  ruleIntegrityBreachUsd,
  ruleIntegritySoldOutDays,
  ruleLighthouseStale,
  ruleCompsetUndercutDays,
  ruleCompsetAvgDelta,
  ruleCompsetRateChange3d,
  ruleCompsetRateChange7d,
];

export function evaluateParityRules(ctx: ParityContext): Insight[] {
  const out: Insight[] = [];
  for (const r of ALL) {
    const v = r(ctx);
    if (v != null) out.push(v);
  }
  return out;
}
