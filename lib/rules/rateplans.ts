// lib/rules/rateplans.ts
// PBS 2026-07-09 pm: Rate-plan hygiene + revenue-mix guardrails.
// Consumes public.v_rate_plan_hygiene (one row per property with lifetime aggregates)
// + guardrails thresholds seeded by /guardrails.
//
// Rules ship insights on:
//   · NRR-locked revenue share vs target
//   · Advance-Purchase (early-bird) share vs target
//   · Flex + Semi-Flex share ceiling
//   · Sleeping rate-plan count > 2y (retire candidates)
//   · Never-booked catalogue bloat share
//   · Orphan rate plans (bookings without a live catalogue entry)

import type { Insight } from '@/app/_components/ConclusionBlock';

export interface RatePlanTargets {
  nrr_share_target?: number;             // gte %
  early_bird_share_target?: number;      // gte %
  flex_share_max?: number;               // lte %
  sleeping_plan_max_days?: number;       // lte days (catalogue-wide max)
  never_booked_plan_max_share?: number;  // lte %
  orphan_catalogue_gap_max?: number;     // lte count
}

export interface RatePlanContext {
  activePlansTotal: number;
  sleepingTotal: number;
  sleepingOver2y: number;
  sleeping1To2y: number;
  sleeping180dTo1y: number;
  neverBooked: number;
  neverBookedPct: number | null;
  orphanCount: number;

  ytdRevenueTotal: number;
  nrrLockedSharePct: number | null;
  flexSharePct: number | null;
  earlyBirdSharePct: number | null;

  targets: RatePlanTargets;
}

const FB: Required<RatePlanTargets> = {
  nrr_share_target: 30,
  early_bird_share_target: 15,
  flex_share_max: 55,
  sleeping_plan_max_days: 730,
  never_booked_plan_max_share: 20,
  orphan_catalogue_gap_max: 5,
};
const T = (ctx: RatePlanContext, k: keyof RatePlanTargets) => ctx.targets[k] ?? FB[k];

export function ruleNrrShareTarget(ctx: RatePlanContext): Insight | null {
  if (ctx.nrrLockedSharePct == null) return null;
  const target = T(ctx, 'nrr_share_target');
  if (ctx.nrrLockedSharePct >= target) {
    return {
      key: 'nrr_share_target_ok',
      priority: 'info',
      title: 'NRR share on target',
      body: `NRR + Advance-Purchase = ${ctx.nrrLockedSharePct.toFixed(1)}% of YTD revenue (target ≥ ${target}%). Cash discipline healthy.`,
    };
  }
  const gap = target - ctx.nrrLockedSharePct;
  return {
    key: 'nrr_share_target',
    priority: gap > 8 ? 'critical' : 'warning',
    title: 'NRR share below target',
    body: `NRR + Advance-Purchase = ${ctx.nrrLockedSharePct.toFixed(1)}% of YTD revenue vs target ≥ ${target}% (gap ${gap.toFixed(1)}pp). Raise NRR discount 3-5pp on 30-90d lead or promote AP tiers to shift booking mix.`,
  };
}

export function ruleEarlyBirdShareTarget(ctx: RatePlanContext): Insight | null {
  if (ctx.earlyBirdSharePct == null) return null;
  const target = T(ctx, 'early_bird_share_target');
  if (ctx.earlyBirdSharePct >= target) return null;
  const gap = target - ctx.earlyBirdSharePct;
  return {
    key: 'early_bird_share_target',
    priority: gap > 6 ? 'warning' : 'info',
    title: 'Early-bird share below target',
    body: `Advance-Purchase = ${ctx.earlyBirdSharePct.toFixed(1)}% of YTD revenue vs target ≥ ${target}% (gap ${gap.toFixed(1)}pp). Consider AP60 / AP90 tiers with tighter cancellation to attract long-lead bookers.`,
  };
}

export function ruleFlexShareMax(ctx: RatePlanContext): Insight | null {
  if (ctx.flexSharePct == null) return null;
  const ceiling = T(ctx, 'flex_share_max');
  if (ctx.flexSharePct <= ceiling) return null;
  return {
    key: 'flex_share_max',
    priority: ctx.flexSharePct > ceiling + 10 ? 'critical' : 'warning',
    title: 'Flex share too high',
    body: `Flex + Semi-Flex = ${ctx.flexSharePct.toFixed(1)}% of YTD revenue vs ceiling ${ceiling}%. Booking mix is exposed to late cancellations — grow NRR / Advance-Purchase to shift the balance.`,
  };
}

// PBS 2026-07-17: sleeping/never-booked/orphan are DATA-CLEANING items, not tactical
// revenue decisions. Downgrade severity to 'observation' so they don't crowd out
// real firings on the briefing page.
export function ruleSleepingPlanMax(ctx: RatePlanContext): Insight | null {
  const threshold = T(ctx, 'sleeping_plan_max_days');
  if (threshold >= 3650) return null;
  if (ctx.sleepingOver2y === 0) return null;
  return {
    key: 'sleeping_plan_max_days',
    priority: 'observation',
    title: `${ctx.sleepingOver2y} rate plans dormant > ${Math.round(threshold / 365)}y`,
    body: `Data cleaning: ${ctx.sleepingOver2y} plans have no bookings for over ${threshold} days. Retire or archive from the catalogue — reduces PMS bloat + OTA rate-plan picker fatigue.`,
  };
}

export function ruleNeverBookedShare(ctx: RatePlanContext): Insight | null {
  if (ctx.neverBookedPct == null) return null;
  const ceiling = T(ctx, 'never_booked_plan_max_share');
  if (ctx.neverBookedPct <= ceiling) return null;
  return {
    key: 'never_booked_plan_max_share',
    priority: 'observation',
    title: 'Catalogue bloat — never-booked plans',
    body: `Data cleaning: ${ctx.neverBooked} of ${ctx.activePlansTotal} active plans (${ctx.neverBookedPct.toFixed(1)}%) have never been booked. Retire the never-booked long tail.`,
  };
}

export function ruleOrphanCatalogueGap(ctx: RatePlanContext): Insight | null {
  const ceiling = T(ctx, 'orphan_catalogue_gap_max');
  if (ctx.orphanCount <= ceiling) return null;
  return {
    key: 'orphan_catalogue_gap_max',
    priority: 'observation',
    title: `${ctx.orphanCount} orphan rate plans`,
    body: `Data cleaning: ${ctx.orphanCount} historical rate plans carry bookings but are no longer in the live PMS catalogue. Normalise to canonical plans.`,
  };
}

/**
 * Run every rule and return the non-null insights in fixed order.
 */
export function runRatePlanRules(ctx: RatePlanContext): Insight[] {
  const out: (Insight | null)[] = [
    ruleNrrShareTarget(ctx),
    ruleEarlyBirdShareTarget(ctx),
    ruleFlexShareMax(ctx),
    ruleSleepingPlanMax(ctx),
    ruleNeverBookedShare(ctx),
    ruleOrphanCatalogueGap(ctx),
  ];
  return out.filter((x): x is Insight => x != null);
}
