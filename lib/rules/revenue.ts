// lib/rules/revenue.ts v1
// PBS 2026-07-07: "Gold rules" for Revenue HoD conclusions.
// Rules are pure functions of a context object → 0..N Insight[].
// Same shape as lib/rules/retention.ts + reputation.ts + newsletter.ts.
//
// Adding a rule = adding a function to RULES. Reviewing all interpretations = read this file.
//
// GUARDRAIL nature:
//   - `dynamic` = threshold is data-driven (rolling percentile, LY baseline, etc.)
//   - `fixed`   = threshold is a hardcoded operator target
//
// Threshold values live here today. When the guardrails table CRUD
// (public.guardrails · domain='revenue') is wired end-to-end, the values
// will be sourced from the DB row via the passed-in `thresholds` map.
// Missing keys fall back to the constants below.

import type { Insight } from '@/app/_components/ConclusionBlock';

export interface RevenueContext {
  // Tonight (in-house)
  rnTonight: number;
  capacity: number;
  occPct: number;              // 0-100
  adrToday: number;            // property currency
  revparToday: number;

  // Today's booking activity (last 24h)
  pickupCount: number;
  pickupValue: number;         // sum of new-booking value today
  cancelCount: number;
  cancelValue: number;         // sum of cancelled-booking value today (estimated)

  // Optional (may be null when we haven't hydrated the baseline yet)
  occBaselinePct: number | null;   // rolling LY / L30 baseline
  adrBaseline: number | null;      // rolling LY / L30 baseline
  currencySymbol: string;          // '$' | '€'

  // Optional guardrail overrides — sourced from public.guardrails (domain='revenue')
  thresholds?: Partial<Record<
    | 'occ_critical_pct'
    | 'occ_warn_pct'
    | 'occ_strong_pct'
    | 'adr_floor'
    | 'adr_strong'
    | 'pickup_strong'
    | 'cancel_spike'
    | 'empty_rooms_warn',
    number
  >>;
}

type Rule = (ctx: RevenueContext) => Insight | Insight[] | null;

// Fallback thresholds when public.guardrails has no row for a given rule_key.
const FB = {
  occ_critical_pct: 40,
  occ_warn_pct:     55,
  occ_strong_pct:   90,
  adr_floor:        80,
  adr_strong:       200,
  pickup_strong:    5,
  cancel_spike:     3,
  empty_rooms_warn: 5,
};

function T(ctx: RevenueContext, key: keyof typeof FB): number {
  return ctx.thresholds?.[key] ?? FB[key];
}

function money(ctx: RevenueContext, n: number): string {
  return `${ctx.currencySymbol}${Math.round(n).toLocaleString('en-US')}`;
}

// ─────────────────────────────────────────────────────────────
// Rules
// ─────────────────────────────────────────────────────────────

// Rule 1 — OCC critically low tonight
const ruleOccCritical: Rule = (ctx) => {
  const thr = T(ctx, 'occ_critical_pct');
  if (ctx.capacity === 0 || ctx.occPct >= thr) return null;
  const empty = ctx.capacity - ctx.rnTonight;
  return {
    key: 'occ_critical_tonight',
    priority: 'critical',
    guardrail: 'fixed',
    title: `OCC ${ctx.occPct.toFixed(0)}% tonight — ${empty} rooms empty`,
    body: 'Every unsold room-night is unrecoverable revenue. Trigger last-minute channels, flash a direct rate, or push spa/F&B to convert booked guests to higher spend.',
    evidence: `${ctx.rnTonight} of ${ctx.capacity} occupied · target ≥ ${thr}%`,
    action: 'Pull last-minute pace →',
    href: '/revenue/pace',
  };
};

// Rule 2 — OCC low tonight (warning band)
const ruleOccLow: Rule = (ctx) => {
  const crit = T(ctx, 'occ_critical_pct');
  const warn = T(ctx, 'occ_warn_pct');
  if (ctx.capacity === 0 || ctx.occPct < crit || ctx.occPct >= warn) return null;
  return {
    key: 'occ_low_tonight',
    priority: 'warning',
    guardrail: 'fixed',
    title: `OCC ${ctx.occPct.toFixed(0)}% tonight — below ${warn}% target`,
    body: 'Softer night. Worth a quick pace + comp-set check to see whether it\'s market-wide or a Namkhan-specific gap.',
    evidence: `${ctx.rnTonight} of ${ctx.capacity} · target ≥ ${warn}%`,
    action: 'Check pace vs SDLY →',
    href: '/revenue/pace',
  };
};

// Rule 3 — OCC strong milestone
const ruleOccStrong: Rule = (ctx) => {
  const thr = T(ctx, 'occ_strong_pct');
  if (ctx.capacity === 0 || ctx.occPct < thr) return null;
  const soldOut = ctx.rnTonight >= ctx.capacity;
  return {
    key: soldOut ? 'occ_sold_out' : 'occ_strong',
    priority: 'positive',
    guardrail: 'fixed',
    title: soldOut
      ? `Sold out tonight · ${ctx.rnTonight}/${ctx.capacity}`
      : `OCC ${ctx.occPct.toFixed(0)}% tonight — above ${thr}% target`,
    body: soldOut
      ? 'Full house — lean into upsell (transfer, spa, F&B) to lift TRevPAR, and check tomorrow\'s pricing for any leftover softness.'
      : 'Strong occupancy. Sanity-check that tomorrow\'s rate isn\'t underpriced given the demand signal.',
    evidence: `${ctx.rnTonight} of ${ctx.capacity} rooms`,
    action: 'Review calendar pricing →',
    href: '/revenue/pricing',
  };
};

// Rule 4 — ADR far below floor
const ruleAdrLow: Rule = (ctx) => {
  const floor = T(ctx, 'adr_floor');
  if (ctx.adrToday <= 0 || ctx.adrToday >= floor) return null;
  return {
    key: 'adr_below_floor',
    priority: 'warning',
    guardrail: 'fixed',
    title: `ADR ${money(ctx, ctx.adrToday)} tonight — below ${money(ctx, floor)} floor`,
    body: 'Aggressive pricing or a heavy discount-channel mix. Check whether promos are stacking, and whether the ARI closed enough date-rate combos.',
    evidence: `Floor target ≥ ${money(ctx, floor)} · in-house ADR`,
    action: 'Investigate channels →',
    href: '/revenue/channels',
  };
};

// Rule 5 — ADR vs LY baseline (dynamic)
const ruleAdrVsBaseline: Rule = (ctx) => {
  if (ctx.adrBaseline == null || ctx.adrToday <= 0) return null;
  const gap = ctx.adrToday - ctx.adrBaseline;
  if (gap >= -5) return null;  // within 5 currency units of baseline = fine
  return {
    key: 'adr_below_baseline',
    priority: gap < -30 ? 'critical' : 'warning',
    guardrail: 'dynamic',
    title: `ADR ${money(ctx, ctx.adrToday)} vs baseline ${money(ctx, ctx.adrBaseline)}`,
    body: 'Running under your own rolling baseline. Either the mix has shifted toward discount channels, or comp-set has moved and your rate ladder hasn\'t adapted.',
    evidence: `Gap ${money(ctx, Math.abs(gap))} below rolling baseline`,
    action: 'See calendar + channel mix →',
    href: '/revenue/pricing',
  };
};

// Rule 6 — ADR strong milestone
const ruleAdrStrong: Rule = (ctx) => {
  const thr = T(ctx, 'adr_strong');
  if (ctx.adrToday < thr) return null;
  return {
    key: 'adr_strong',
    priority: 'positive',
    guardrail: 'fixed',
    title: `ADR ${money(ctx, ctx.adrToday)} — above ${money(ctx, thr)} target`,
    body: 'Rate discipline paying off. Watch for pushback in the next 7 days — if pickup dips too hard, you\'ve pushed past the willingness curve.',
    evidence: `Target ≥ ${money(ctx, thr)}`,
  };
};

// Rule 7 — Pickup zero today
const rulePickupZero: Rule = (ctx) => {
  if (ctx.pickupCount > 0) return null;
  return {
    key: 'pickup_zero',
    priority: 'info',
    guardrail: 'fixed',
    title: 'Zero new bookings today (so far)',
    body: 'One quiet day is noise; three in a row is a signal. Check whether the funnel is dry (marketing) or the rate is scaring pace off (revenue).',
    evidence: 'Compare vs L7-day pickup average',
    action: 'See pickup matrix →',
    href: '/revenue/pickup',
  };
};

// Rule 8 — Pickup strong momentum
const rulePickupStrong: Rule = (ctx) => {
  const thr = T(ctx, 'pickup_strong');
  if (ctx.pickupCount < thr) return null;
  return {
    key: 'pickup_strong',
    priority: 'positive',
    guardrail: 'fixed',
    title: `Strong pickup — ${ctx.pickupCount} new bookings today · ${money(ctx, ctx.pickupValue)}`,
    body: 'Demand pushing. Consider tightening the ARI ladder — if pace is holding, you can lift rate on the softest arrival dates without losing volume.',
    evidence: `Target ≥ ${thr} bookings/day`,
    action: 'See pace →',
    href: '/revenue/pace',
  };
};

// Rule 9 — Cancellation spike today
const ruleCancelSpike: Rule = (ctx) => {
  const thr = T(ctx, 'cancel_spike');
  if (ctx.cancelCount < thr) return null;
  return {
    key: 'cancel_spike_today',
    priority: ctx.cancelCount >= thr * 2 ? 'critical' : 'warning',
    guardrail: 'fixed',
    title: `${ctx.cancelCount} cancellations today · ${money(ctx, ctx.cancelValue)} lost`,
    body: 'High single-day cancels usually mean a rate war on the same dates, or a group/wholesale segment washing out. Look at source concentration.',
    evidence: `Trigger ≥ ${thr}/day`,
    action: 'See cancellations →',
    href: '/revenue/cancellations',
  };
};

// Rule 10 — Net revenue negative day (cancels > pickup)
const ruleNetNegativeDay: Rule = (ctx) => {
  if (ctx.pickupValue === 0 && ctx.cancelValue === 0) return null;
  if (ctx.cancelValue <= ctx.pickupValue) return null;
  const net = ctx.pickupValue - ctx.cancelValue;
  return {
    key: 'net_revenue_negative',
    priority: 'critical',
    guardrail: 'dynamic',
    title: `Net booking revenue NEGATIVE today · ${money(ctx, net)}`,
    body: 'You lost more revenue in cancels than you won in new bookings. Two days in a row = escalate; it usually points at a rate-parity break or a source-specific problem.',
    evidence: `+${money(ctx, ctx.pickupValue)} pickup · −${money(ctx, ctx.cancelValue)} cancels`,
    action: 'Check parity →',
    href: '/revenue/parity',
  };
};

// Rule 11 — Empty rooms tonight (context-aware — only fires when OCC is in the middle band)
const ruleEmptyRooms: Rule = (ctx) => {
  const thr = T(ctx, 'empty_rooms_warn');
  if (ctx.capacity === 0) return null;
  const empty = ctx.capacity - ctx.rnTonight;
  const warn = T(ctx, 'occ_warn_pct');
  const strong = T(ctx, 'occ_strong_pct');
  if (empty < thr) return null;
  // Don't double-signal — the OCC rules already cover low OCC. Fire only in the "in-between" band.
  if (ctx.occPct < warn || ctx.occPct >= strong) return null;
  return {
    key: 'empty_rooms_tonight',
    priority: 'info',
    guardrail: 'fixed',
    title: `${empty} rooms empty tonight — walk-in window still open`,
    body: 'Middle-band OCC with rooms left. A same-day flash on the direct channel + a walk-in poster at reception recovers 1-2 rooms most nights.',
    evidence: `${ctx.rnTonight} of ${ctx.capacity} sold`,
  };
};

// Rule 12 — RevPAR observation (calm signal when everything is roughly balanced)
const ruleRevparObservation: Rule = (ctx) => {
  if (ctx.capacity === 0 || ctx.revparToday <= 0) return null;
  // Only fire when nothing else is screaming — an "everything nominal" line.
  if (ctx.occPct < T(ctx, 'occ_warn_pct') || ctx.cancelCount >= T(ctx, 'cancel_spike')) return null;
  if (ctx.occPct >= T(ctx, 'occ_strong_pct')) return null;
  return {
    key: 'revpar_nominal',
    priority: 'observation',
    guardrail: 'fixed',
    title: `RevPAR ${money(ctx, ctx.revparToday)} tonight — trading within band`,
    body: 'Nothing else is flagging. Good moment to look 7 days out and pre-empt any weak arrival dates.',
    evidence: `${ctx.rnTonight}/${ctx.capacity} · ADR ${money(ctx, ctx.adrToday)}`,
    action: 'See calendar →',
    href: '/revenue/pricing',
  };
};

const RULES: Rule[] = [
  ruleOccCritical,
  ruleOccLow,
  ruleOccStrong,
  ruleAdrLow,
  ruleAdrVsBaseline,
  ruleAdrStrong,
  rulePickupZero,
  rulePickupStrong,
  ruleCancelSpike,
  ruleNetNegativeDay,
  ruleEmptyRooms,
  ruleRevparObservation,
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
