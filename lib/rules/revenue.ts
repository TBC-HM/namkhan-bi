// lib/rules/revenue.ts v2
// PBS 2026-07-07: Revenue HoD conclusion rules.
// Rewired to consume operator-editable thresholds from public.guardrails
// (domain='revenue'). Each rule_key on the DB row maps to one of the
// targets in RevenueContext.targets — edit the row, the rule threshold
// changes on next request.
//
// GUARDRAIL nature:
//   - `dynamic` = threshold is data-driven (rolling baseline)
//   - `fixed`   = threshold is an operator target (public.guardrails value)
//
// Adding a rule = adding a function to RULES + a wiring entry in
// lib/rules/wiring.ts so the status dot in Settings → Guardrails reflects it.

import type { Insight } from '@/app/_components/ConclusionBlock';

export interface RevenueTargets {
  // Sourced from public.guardrails (domain='revenue', active=true) — see wiring.ts
  occupancy_target?: number;    // gte %          e.g. 50
  adr_target?: number;          // gte currency   e.g. 180
  revpar_target?: number;       // gte currency   e.g. 85
  pickup_min_daily?: number;    // gte bookings   e.g. 3
  // Aspirational — currently NOT wired to data on the HoD (see wiring.ts):
  //   cancellation_rate · pace_gap_pp · lead_time_min_days · leakage_ota_share
  //   parity_breach_usd · compset_stale_days
}

export interface RevenueContext {
  // Live data (tonight in-house)
  rnTonight: number;
  capacity: number;
  occPct: number;              // 0-100
  adrToday: number;            // property currency
  revparToday: number;

  // Live data (today's activity, last 24h)
  pickupCount: number;
  pickupValue: number;
  cancelCount: number;
  cancelValue: number;

  // Presentation
  currencySymbol: string;      // '$' | '€'

  // Operator-editable targets
  targets: RevenueTargets;
}

type Rule = (ctx: RevenueContext) => Insight | Insight[] | null;

// Fallback targets when a public.guardrails row is missing.
const FALLBACK: Required<RevenueTargets> = {
  occupancy_target: 50,
  adr_target:       180,
  revpar_target:    85,
  pickup_min_daily: 3,
};

function T(ctx: RevenueContext, key: keyof RevenueTargets): number {
  return ctx.targets[key] ?? FALLBACK[key];
}

function money(ctx: RevenueContext, n: number): string {
  return `${ctx.currencySymbol}${Math.round(n).toLocaleString('en-US')}`;
}

// ─────────────────────────────────────────────────────────────
// Rules — every one consumes the DB target where possible.
// ─────────────────────────────────────────────────────────────

// occupancy_target — critical if OCC ≥ 20pp below target
const ruleOccupancyCritical: Rule = (ctx) => {
  if (ctx.capacity === 0) return null;
  const target = T(ctx, 'occupancy_target');
  const gap = target - ctx.occPct;
  if (gap < 20) return null;
  const empty = ctx.capacity - ctx.rnTonight;
  return {
    key: 'occ_critical_gap',
    priority: 'critical',
    guardrail: 'fixed',
    title: `OCC ${ctx.occPct.toFixed(0)}% tonight — ${gap.toFixed(0)}pp below ${target}% target · ${empty} rooms empty`,
    body: 'Well below your own floor. Trigger last-minute channels, flash a direct rate, or push spa/F&B to lift TRevPAR on booked guests.',
    evidence: `${ctx.rnTonight} of ${ctx.capacity} sold · target ≥ ${target}%`,
    action: 'Pull last-minute pace →',
    href: '/revenue/pace',
  };
};

// occupancy_target — warning when OCC 5-20pp below target
const ruleOccupancyWarn: Rule = (ctx) => {
  if (ctx.capacity === 0) return null;
  const target = T(ctx, 'occupancy_target');
  const gap = target - ctx.occPct;
  if (gap < 5 || gap >= 20) return null;
  return {
    key: 'occ_warn_gap',
    priority: 'warning',
    guardrail: 'fixed',
    title: `OCC ${ctx.occPct.toFixed(0)}% tonight — ${gap.toFixed(0)}pp below ${target}% target`,
    body: 'Middle-band softness. Look at pace + comp-set to check whether it\'s market-wide or Namkhan-specific.',
    evidence: `${ctx.rnTonight} of ${ctx.capacity} · target ≥ ${target}%`,
    action: 'Check pace →',
    href: '/revenue/pace',
  };
};

// occupancy_target — positive when OCC well above target
const ruleOccupancyStrong: Rule = (ctx) => {
  if (ctx.capacity === 0) return null;
  const target = T(ctx, 'occupancy_target');
  if (ctx.occPct < target + 25) return null;
  const soldOut = ctx.rnTonight >= ctx.capacity;
  return {
    key: soldOut ? 'occ_sold_out' : 'occ_strong',
    priority: 'positive',
    guardrail: 'fixed',
    title: soldOut
      ? `Sold out tonight · ${ctx.rnTonight}/${ctx.capacity}`
      : `OCC ${ctx.occPct.toFixed(0)}% tonight — ${(ctx.occPct - target).toFixed(0)}pp above ${target}% target`,
    body: soldOut
      ? 'Full house — lean into upsell (transfer, spa, F&B) and sanity-check tomorrow\'s rate isn\'t underpriced.'
      : 'Strong pace. Check whether the next 7 arrival dates are underpriced given the demand signal.',
    evidence: `${ctx.rnTonight} of ${ctx.capacity} rooms`,
    action: 'Review calendar pricing →',
    href: '/revenue/pricing',
  };
};

// adr_target — warning when ADR below target
const ruleAdrLow: Rule = (ctx) => {
  if (ctx.adrToday <= 0) return null;
  const target = T(ctx, 'adr_target');
  if (ctx.adrToday >= target) return null;
  const gap = target - ctx.adrToday;
  const critical = gap >= target * 0.25;   // 25% below target
  return {
    key: critical ? 'adr_critical_low' : 'adr_below_target',
    priority: critical ? 'critical' : 'warning',
    guardrail: 'fixed',
    title: `ADR ${money(ctx, ctx.adrToday)} tonight — below ${money(ctx, target)} target`,
    body: 'Aggressive pricing or a heavy discount-channel mix. Check whether promos are stacking, and whether the ARI closed enough date-rate combos.',
    evidence: `Gap ${money(ctx, gap)} below target`,
    action: 'Investigate channels →',
    href: '/revenue/channels',
  };
};

// adr_target — positive when ADR well above target
const ruleAdrStrong: Rule = (ctx) => {
  if (ctx.adrToday <= 0) return null;
  const target = T(ctx, 'adr_target');
  if (ctx.adrToday < target * 1.1) return null;   // 10% above target
  return {
    key: 'adr_strong',
    priority: 'positive',
    guardrail: 'fixed',
    title: `ADR ${money(ctx, ctx.adrToday)} tonight — above ${money(ctx, target)} target`,
    body: 'Rate discipline paying off. Watch pickup over the next 7 days — if pace dips too hard, you\'ve pushed past willingness-to-pay.',
    evidence: `Target ≥ ${money(ctx, target)}`,
  };
};

// revpar_target — warning when RevPAR below target
const ruleRevparLow: Rule = (ctx) => {
  if (ctx.revparToday <= 0) return null;
  const target = T(ctx, 'revpar_target');
  if (ctx.revparToday >= target) return null;
  const gap = target - ctx.revparToday;
  return {
    key: 'revpar_below_target',
    priority: gap >= target * 0.4 ? 'critical' : 'warning',
    guardrail: 'fixed',
    title: `RevPAR ${money(ctx, ctx.revparToday)} tonight — below ${money(ctx, target)} target`,
    body: 'The combined pricing × occupancy signal is under target. Usually one of the two levers is broken — check whether ADR or OCC is the culprit.',
    evidence: `Gap ${money(ctx, gap)} · OCC ${ctx.occPct.toFixed(0)}% · ADR ${money(ctx, ctx.adrToday)}`,
    action: 'See pulse →',
    href: '/revenue/pulse',
  };
};

// revpar_target — positive when RevPAR strong
const ruleRevparStrong: Rule = (ctx) => {
  if (ctx.revparToday <= 0) return null;
  const target = T(ctx, 'revpar_target');
  if (ctx.revparToday < target * 1.2) return null;
  return {
    key: 'revpar_strong',
    priority: 'positive',
    guardrail: 'fixed',
    title: `RevPAR ${money(ctx, ctx.revparToday)} tonight — ${money(ctx, ctx.revparToday - target)} above ${money(ctx, target)} target`,
    body: 'Both levers working. Good moment to look 7 days out and pre-empt weak arrival dates.',
    evidence: `OCC ${ctx.occPct.toFixed(0)}% · ADR ${money(ctx, ctx.adrToday)}`,
  };
};

// pickup_min_daily — warning when below floor
const rulePickupMinDaily: Rule = (ctx) => {
  const min = T(ctx, 'pickup_min_daily');
  if (ctx.pickupCount >= min) return null;
  if (ctx.pickupCount === 0) return {
    key: 'pickup_zero',
    priority: 'warning',
    guardrail: 'fixed',
    title: `Zero new bookings today (target ≥ ${min}/day)`,
    body: 'One quiet day is noise; three in a row is a signal. Check whether the funnel is dry (marketing) or the rate is scaring pace off (revenue).',
    evidence: `Target ≥ ${min} bookings/day`,
    action: 'See pickup matrix →',
    href: '/revenue/pickup',
  };
  return {
    key: 'pickup_below_target',
    priority: 'info',
    guardrail: 'fixed',
    title: `Pickup ${ctx.pickupCount} today — below ${min} floor`,
    body: 'Pace running lighter than target. Fine on isolated days; two in a row = check whether the pricing ladder is too tight.',
    evidence: `Target ≥ ${min}/day`,
    action: 'See pickup matrix →',
    href: '/revenue/pickup',
  };
};

// pickup_min_daily — positive when above 2× floor
const rulePickupStrong: Rule = (ctx) => {
  const min = T(ctx, 'pickup_min_daily');
  if (ctx.pickupCount < min * 2) return null;
  return {
    key: 'pickup_strong',
    priority: 'positive',
    guardrail: 'fixed',
    title: `Strong pickup — ${ctx.pickupCount} new bookings today · ${money(ctx, ctx.pickupValue)}`,
    body: 'Demand pushing. Consider tightening the ARI ladder — if pace holds, you can lift rate on softest arrival dates without losing volume.',
    evidence: `≥ 2× ${min}/day floor`,
    action: 'See pace →',
    href: '/revenue/pace',
  };
};

// Net revenue negative day (cancel value > pickup value) — no DB threshold needed
const ruleNetNegativeDay: Rule = (ctx) => {
  if (ctx.pickupValue === 0 && ctx.cancelValue === 0) return null;
  if (ctx.cancelValue <= ctx.pickupValue) return null;
  const net = ctx.pickupValue - ctx.cancelValue;
  return {
    key: 'net_revenue_negative',
    priority: 'critical',
    guardrail: 'dynamic',
    title: `Net booking revenue NEGATIVE today · ${money(ctx, net)}`,
    body: 'You lost more revenue in cancels than you won in new bookings. Two days in a row = escalate; usually a rate-parity break or a source-specific problem.',
    evidence: `+${money(ctx, ctx.pickupValue)} pickup · −${money(ctx, ctx.cancelValue)} cancels`,
    action: 'Check parity →',
    href: '/revenue/parity',
  };
};

const RULES: Rule[] = [
  ruleOccupancyCritical,
  ruleOccupancyWarn,
  ruleOccupancyStrong,
  ruleAdrLow,
  ruleAdrStrong,
  ruleRevparLow,
  ruleRevparStrong,
  rulePickupMinDaily,
  rulePickupStrong,
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
    } catch { /* one rule shouldn't nuke the block */ }
  }
  return out;
}
