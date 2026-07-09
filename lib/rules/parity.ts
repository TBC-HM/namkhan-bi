// lib/rules/parity.ts
// PBS 2026-07-09: Lighthouse / OTA rate parity rules feeding the Revenue HoD.
// Consumes v_rate_integrity_matrix (own OTA parity) + v_lighthouse_rateshop
// (compset scrape). Fires insights on: max own-OTA spread%, spread$,
// sold-out day count, lighthouse scrape staleness.

import type { Insight } from '@/app/_components/ConclusionBlock';

export interface ParityTargets {
  parity_breach_usd?: number;          // lte $
  integrity_max_spread_pct?: number;   // lte %
  integrity_soldout_days_max?: number; // lte count
  compset_stale_days?: number;         // lte days
  lighthouse_stale_days?: number;      // lte days
}

export interface ParityContext {
  // Integrity (from v_rate_integrity_matrix)
  integritySnapshotDate: string | null;
  integrityStayDatesCount: number;
  integrityMaxSpreadPct: number | null; // 0..1
  integrityMaxSpreadUsd: number | null;
  integrityAvgSpreadPct: number | null;
  integritySoldOutDays: number;
  integrityWorstStayDate: string | null;
  integrityWorstDirectUsd: number | null;
  integrityWorstMaxOtaName: string | null;
  integrityWorstMaxOtaUsd: number | null;

  // Lighthouse compset
  lighthouseSnapshotDate: string | null;

  targets: ParityTargets;
}

const FB: Required<ParityTargets> = {
  parity_breach_usd: 5,
  integrity_max_spread_pct: 10,
  integrity_soldout_days_max: 5,
  compset_stale_days: 3,
  lighthouse_stale_days: 2,
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
      action: 'Open lighthouse',
      href: '/revenue/lighthouse/overview',
      guardrail: 'fixed',
    };
  }
  if (days <= threshold) return null;
  return {
    key: 'parity_lighthouse_stale',
    priority: days >= threshold * 3 ? 'critical' : 'warning',
    title: `Lighthouse scrape ${days}d stale (threshold ${threshold}d)`,
    body: `Last shop: ${ctx.lighthouseSnapshotDate}. Refresh the daily lighthouse feed.`,
    action: 'Open lighthouse',
    href: '/revenue/lighthouse/overview',
    guardrail: 'fixed',
  };
};

const ALL: Rule[] = [
  ruleIntegrityMaxSpread,
  ruleIntegrityBreachUsd,
  ruleIntegritySoldOutDays,
  ruleLighthouseStale,
];

export function evaluateParityRules(ctx: ParityContext): Insight[] {
  const out: Insight[] = [];
  for (const r of ALL) {
    const v = r(ctx);
    if (v != null) out.push(v);
  }
  return out;
}
