// lib/rules/revenue.ts v3
// PBS 2026-07-07: Revenue HoD "rev-manager morning brief" — forward-looking.
// The rev manager needs to know WHERE to intervene THIS WEEK to close
// a booking window that's about to shut, not what tonight's OCC is.
//
// Windows we evaluate:
//   0-14d   inside — critical rate action (day-of / short-notice moves)
//   15-30d  short  — promo / package trigger window
//   31-60d  mid    — nurture + campaign window
//   61-90d  long   — country promo / demand generation window
//
// Rules read operator-editable targets from public.guardrails (domain='revenue').

import type { Insight } from '@/app/_components/ConclusionBlock';

export interface RevenueTargets {
  occupancy_target?: number;    // gte %
  adr_target?: number;
  revpar_target?: number;
  pickup_min_daily?: number;
  pace_gap_pp?: number;         // lte pp — max acceptable pace-vs-SDLY gap
}

export interface PaceNight {
  night_date: string;      // YYYY-MM-DD
  daysOut: number;         // 0..90
  confirmedRooms: number;
  capacity: number;
  occPct: number;          // 0-100
  stlyRooms: number | null; // rooms sold same night LY
}

export interface CountryPickup {
  country: string;         // ISO2 or full name
  pickupL14: number;       // bookings in last 14 days
  pickupLyL14: number | null; // same window LY
}

export interface RevenueContext {
  currencySymbol: string;

  // Live tonight
  rnTonight: number;
  capacity: number;
  occPct: number;
  adrToday: number;
  revparToday: number;

  // Today's activity
  pickupCount: number;
  pickupValue: number;
  cancelCount: number;
  cancelValue: number;

  // FORWARD OUTLOOK (main brain of the rev-manager brief)
  paceNext90: PaceNight[];      // one row per night, next 90 days
  topCountriesL14: CountryPickup[]; // top 5 source markets, last 14 days pickup
  ratePlanSleepingCount: number | null; // # of rate plans with zero L14 pickup
  ratePlanTopSharePct: number | null;   // top rate plan % of L14 pickup

  // Avg LOS (from next-30-day arrivals)
  avgLosNext30: number | null;
  avgLosBaseline: number | null; // L365 baseline

  targets: RevenueTargets;
}

type Rule = (ctx: RevenueContext) => Insight | Insight[] | null;

const FB: Required<RevenueTargets> = {
  occupancy_target: 50,
  adr_target: 180,
  revpar_target: 85,
  pickup_min_daily: 3,
  pace_gap_pp: 5,
};
const T = (ctx: RevenueContext, k: keyof RevenueTargets) => ctx.targets[k] ?? FB[k];

function money(ctx: RevenueContext, n: number): string {
  return `${ctx.currencySymbol}${Math.round(n).toLocaleString('en-US')}`;
}

function slice(paceNext90: PaceNight[], fromDay: number, toDay: number): PaceNight[] {
  return paceNext90.filter(n => n.daysOut >= fromDay && n.daysOut <= toDay);
}

// ─────────────────────────────────────────────────────────────
// Forward-looking rules — the rev-manager morning brief
// ─────────────────────────────────────────────────────────────

// Rule 1 — 0-14d critical rate action
// Fires when there are ≥ 3 nights inside 14 days with OCC < occupancy_target - 20.
const ruleShortWindowCritical: Rule = (ctx) => {
  const target = T(ctx, 'occupancy_target');
  const inside = slice(ctx.paceNext90, 0, 14);
  const soft = inside.filter(n => n.occPct < target - 20);
  if (soft.length < 3) return null;
  const gapAvg = soft.reduce((s, n) => s + (target - n.occPct), 0) / soft.length;
  return {
    key: 'fwd_window_0_14d_critical',
    priority: 'critical',
    guardrail: 'fixed',
    title: `${soft.length} soft nights inside 14 days — avg ${gapAvg.toFixed(0)}pp below target`,
    body: `Short-notice window still open. Rate action + last-minute channel push most effective NOW; every day the arrival gets closer the lever gets weaker.`,
    evidence: soft.slice(0, 3).map(n => `${n.night_date} · ${n.occPct.toFixed(0)}%`).join(' · '),
    action: 'Open calendar →',
    href: '/revenue/pricing',
  };
};

// Rule 2 — 15-30d promo/package window
const ruleShortMidWindow: Rule = (ctx) => {
  const target = T(ctx, 'occupancy_target');
  const window = slice(ctx.paceNext90, 15, 30);
  const soft = window.filter(n => n.occPct < target - 10);
  if (soft.length < 4) return null;
  return {
    key: 'fwd_window_15_30d_soft',
    priority: 'warning',
    guardrail: 'fixed',
    title: `${soft.length} soft nights in 15-30d — promo/package window`,
    body: `Enough runway to trigger a rate-drop promo or add a package (breakfast, transfer, spa credit) to lift bookings without discounting the base rate.`,
    evidence: `Threshold: OCC < ${target - 10}% · softest ${soft.slice(0, 3).map(n => n.night_date).join(', ')}`,
    action: 'See pace →',
    href: '/revenue/pace',
  };
};

// Rule 3 — 61-90d long window (PBS: "USA 90 days out window closing")
const ruleLongWindowClosing: Rule = (ctx) => {
  const target = T(ctx, 'occupancy_target');
  const window = slice(ctx.paceNext90, 61, 90);
  if (window.length === 0) return null;
  const avgOcc = window.reduce((s, n) => s + n.occPct, 0) / window.length;
  if (avgOcc >= target - 15) return null;
  const soft = window.filter(n => n.occPct < 40);
  return {
    key: 'fwd_window_61_90d_closing',
    priority: 'warning',
    guardrail: 'fixed',
    title: `61-90d avg OCC ${avgOcc.toFixed(0)}% — window closing on long-lead markets`,
    body: `USA / EU / AU book 60-90 days out. This is the window to run a source-market promo before the demand curve moves past your leverage point.`,
    evidence: `${soft.length} sub-40% nights · target ≥ ${target}%`,
    action: 'See markets →',
    href: '/revenue/markets',
  };
};

// Rule 4 — pace_gap_pp — pace running below SDLY (uses DB threshold)
const rulePaceVsSdly: Rule = (ctx) => {
  const rows = ctx.paceNext90.filter(n => n.stlyRooms != null && n.daysOut <= 60);
  if (rows.length < 14) return null;
  const totalOtb = rows.reduce((s, n) => s + n.confirmedRooms, 0);
  const totalStly = rows.reduce((s, n) => s + (n.stlyRooms ?? 0), 0);
  if (totalStly === 0) return null;
  const gapPct = ((totalOtb - totalStly) / totalStly) * 100; // negative = behind LY
  const maxGap = T(ctx, 'pace_gap_pp');
  if (gapPct >= -maxGap) return null;
  return {
    key: 'fwd_pace_vs_sdly',
    priority: gapPct < -maxGap * 2 ? 'critical' : 'warning',
    guardrail: 'dynamic',
    title: `Next-60d pace ${gapPct.toFixed(1)}% behind SDLY — over ${maxGap}pp tolerance`,
    body: `Running behind last year on OTB. If ADR is holding, it's a volume-side issue (marketing, distribution). If ADR is up, might be intentional yield play — verify with rate integrity.`,
    evidence: `OTB ${totalOtb} rn · SDLY ${totalStly} rn over ${rows.length} nights`,
    action: 'See pace →',
    href: '/revenue/pace',
  };
};

// Rule 5 — country pace slowing (PBS: "need to do promo in USA")
const ruleCountryPaceSlowing: Rule = (ctx) => {
  if (ctx.topCountriesL14.length === 0) return null;
  const slowing = ctx.topCountriesL14
    .filter(c => c.pickupLyL14 != null && c.pickupLyL14 > 0)
    .map(c => ({ ...c, gapPct: ((c.pickupL14 - (c.pickupLyL14 ?? 0)) / (c.pickupLyL14 ?? 1)) * 100 }))
    .filter(c => c.gapPct < -30)
    .sort((a, b) => a.gapPct - b.gapPct);
  if (slowing.length === 0) return null;
  const worst = slowing[0];
  return {
    key: 'country_pace_slowing',
    priority: 'warning',
    guardrail: 'dynamic',
    title: `${worst.country} pickup ${worst.gapPct.toFixed(0)}% behind LY (last 14d)`,
    body: `Source-market softness. Trigger a targeted promo / re-engagement campaign — this is exactly the window the demand-generation lever still works.`,
    evidence: `${worst.pickupL14} bookings L14 vs ${worst.pickupLyL14} LY${slowing.length > 1 ? ` · also slowing: ${slowing.slice(1, 3).map(c => c.country).join(', ')}` : ''}`,
    action: 'See markets →',
    href: '/revenue/markets',
  };
};

// Rule 6 — rate plan concentration
const ruleRatePlanConcentration: Rule = (ctx) => {
  if (ctx.ratePlanTopSharePct == null) return null;
  if (ctx.ratePlanTopSharePct < 40) return null;
  return {
    key: 'rate_plan_concentration',
    priority: ctx.ratePlanTopSharePct > 60 ? 'warning' : 'info',
    guardrail: 'fixed',
    title: `Top rate plan = ${ctx.ratePlanTopSharePct.toFixed(0)}% of L14 pickup`,
    body: `High plan concentration = parity risk + single-lever exposure. If your top plan is a non-refundable discount, the yield ceiling is capped.`,
    evidence: `Threshold: > 40% share`,
    action: 'See rate plans →',
    href: '/revenue/rateplans',
  };
};

// Rule 7 — rate plans sleeping
const ruleRatePlansSleeping: Rule = (ctx) => {
  if (ctx.ratePlanSleepingCount == null) return null;
  if (ctx.ratePlanSleepingCount < 2) return null;
  return {
    key: 'rate_plans_sleeping',
    priority: 'info',
    guardrail: 'fixed',
    title: `${ctx.ratePlanSleepingCount} rate plans with zero pickup in L14`,
    body: `Dead plans clutter the ARI and confuse the guest. Either prune, or re-position with a new hook (early-bird, member-rate, LOS-tier).`,
    evidence: 'Trigger ≥ 2 plans idle',
    action: 'See rate plans →',
    href: '/revenue/rateplans',
  };
};

// Rule 8 — LOS shortening trend
const ruleLosShortening: Rule = (ctx) => {
  if (ctx.avgLosNext30 == null || ctx.avgLosBaseline == null) return null;
  const gap = ctx.avgLosBaseline - ctx.avgLosNext30;
  if (gap < 0.5) return null;
  return {
    key: 'los_shortening',
    priority: 'info',
    guardrail: 'dynamic',
    title: `Avg LOS next 30d = ${ctx.avgLosNext30.toFixed(1)}n vs ${ctx.avgLosBaseline.toFixed(1)}n baseline`,
    body: `Stays getting shorter = falling revenue-per-guest even at same ADR. Check whether shorter LOS is coming from a rate plan or a source market.`,
    evidence: `Gap ${gap.toFixed(1)} nights`,
    action: 'See rate plans →',
    href: '/revenue/rateplans',
  };
};

// Rule 9 — sold-out night ahead (positive)
const ruleSoldOutAhead: Rule = (ctx) => {
  const soldOut = ctx.paceNext90.filter(n => n.daysOut <= 30 && n.capacity > 0 && n.confirmedRooms >= n.capacity);
  if (soldOut.length === 0) return null;
  return {
    key: 'sold_out_ahead',
    priority: 'positive',
    guardrail: 'fixed',
    title: `${soldOut.length} sold-out nights in next 30 days`,
    body: `Peak demand identified. Check whether tomorrow's rate on adjacent dates is priced high enough to catch the overflow.`,
    evidence: `Next: ${soldOut.slice(0, 3).map(n => n.night_date).join(', ')}`,
    action: 'See calendar →',
    href: '/revenue/pricing',
  };
};

// Rule 10 — Net negative day (real-time — kept from v2)
const ruleNetNegativeDay: Rule = (ctx) => {
  if (ctx.pickupValue === 0 && ctx.cancelValue === 0) return null;
  if (ctx.cancelValue <= ctx.pickupValue) return null;
  const net = ctx.pickupValue - ctx.cancelValue;
  return {
    key: 'net_revenue_negative',
    priority: 'warning',
    guardrail: 'dynamic',
    title: `Net booking revenue NEGATIVE today · ${money(ctx, net)}`,
    body: `Real-time triage: cancels outpacing pickup. Check parity + source-specific patterns before end of day.`,
    evidence: `+${money(ctx, ctx.pickupValue)} pickup · −${money(ctx, ctx.cancelValue)} cancels`,
    action: 'Check parity →',
    href: '/revenue/parity',
  };
};

const RULES: Rule[] = [
  ruleShortWindowCritical,
  ruleShortMidWindow,
  ruleLongWindowClosing,
  rulePaceVsSdly,
  ruleCountryPaceSlowing,
  ruleRatePlanConcentration,
  ruleRatePlansSleeping,
  ruleLosShortening,
  ruleSoldOutAhead,
  ruleNetNegativeDay,
];

export function evaluateRevenueRules(ctx: RevenueContext): Insight[] {
  const out: Insight[] = [];
  for (const rule of RULES) {
    try {
      const r = rule(ctx);
      if (!r) continue;
      if (Array.isArray(r)) out.push(...r);
      else out.push(r);
    } catch { /* silently skip */ }
  }
  return out;
}
