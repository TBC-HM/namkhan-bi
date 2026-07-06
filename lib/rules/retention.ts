// lib/rules/retention.ts v2
// PBS 2026-07-06: "Gold rules" for retention conclusions.
// Rules are pure functions of a context object → 0..N Insight[].
// Each rule captures ONE piece of operator judgment.
//
// Adding a rule = adding a function to RULES. Reviewing all interpretations = read this file.
// Reuse the same shape for lib/rules/revenue.ts, lib/rules/sales.ts, etc.
//
// GUARDRAIL nature:
//   - `dynamic` = threshold is data-driven (rolling percentile, LY baseline, etc.)
//   - `fixed`   = threshold is a hardcoded operator target
//   Displayed as a small DYNAMIC pill in the UI so operators know which is which.
//
// INSIGHT KEY:
//   Each insight sets an insightKey — the ConclusionBlock renders it as a link to
//   /guest/behaviour/insight/{insightKey} where the drilldown page lists the exact guests.

import type { Insight } from '@/app/_components/ConclusionBlock';

export interface RetentionContext {
  // Loyalty side
  totalGuests: number;
  repeatGuests: number;
  repeatRate: number;                // % (0-100) — current window
  repeatRateBaseline: number | null; // % — dynamic baseline from LY (null if unknown)
  avgLtvAll: number;
  avgLtvRepeat: number;
  winbackPool: number;
  loyaltyMembers: number;
  guestsAt4Stays: number;
  guestsSlipping60d: number;

  // Journey side
  reservations: number;
  confirmRate: number;
  arriveRate: number;
  cancelRate: number;                // % — current window
  cancelRateBaseline: number | null; // % — trailing 12mo p75 (dynamic)
  noShows: number;
  medianLead: number | null;
  inHouse: number;
  windowDays: number;
  preStayCoveragePct: number;

  // Reputation
  responseRate: number | null;
  lowScoringUnanswered: number;

  // Marketing loop
  unsubRate30d: number | null;
}

type Rule = (ctx: RetentionContext) => Insight | Insight[] | null;

// ─────────────────────────────────────────────────────────────
// Rules
// ─────────────────────────────────────────────────────────────

// Rule 1 — repeat rate vs dynamic baseline OR fixed 25% floor.
const ruleRepeatRateBelowTarget: Rule = (ctx) => {
  if (ctx.repeatRate == null || ctx.totalGuests < 20) return null;

  // Dynamic threshold takes precedence when we have a baseline.
  if (ctx.repeatRateBaseline != null && ctx.repeatRate < ctx.repeatRateBaseline - 3) {
    return {
      key: 'repeat_rate_below_baseline',
      priority: 'warning',
      guardrail: 'dynamic',
      title: `Repeat rate ${ctx.repeatRate.toFixed(1)}% — below rolling baseline of ${ctx.repeatRateBaseline.toFixed(1)}%`,
      body: 'You\'re running below your own historical norm. Something in the post-stay cycle is missing, or acquisition has skewed toward one-shot bookers.',
      evidence: `${ctx.repeatGuests} of ${ctx.totalGuests} · gap ${(ctx.repeatRateBaseline - ctx.repeatRate).toFixed(1)}pp`,
      action: 'See slipping guests → save',
      insightKey: 'slipping',
    };
  }

  if (ctx.repeatRate < 15) return {
    key: 'repeat_rate_critical',
    priority: 'critical',
    guardrail: 'fixed',
    title: `Repeat rate ${ctx.repeatRate.toFixed(1)}% is well below 25% target`,
    body: 'Retention machine isn\'t firing. Either the offer isn\'t compelling for a second visit, or guests are lost silently between stays.',
    evidence: `${ctx.repeatGuests} of ${ctx.totalGuests} · gap ${(25 - ctx.repeatRate).toFixed(1)}pp`,
    action: 'Approve win-back list → send',
    insightKey: 'winback',
  };

  if (ctx.repeatRate < 25) return {
    key: 'repeat_rate_warning',
    priority: 'warning',
    guardrail: 'fixed',
    title: `Repeat rate ${ctx.repeatRate.toFixed(1)}% is under 25% target`,
    body: 'On the border. Small tweaks to post-stay cadence can push this into safe territory within 2 booking cycles.',
    evidence: `${ctx.repeatGuests} of ${ctx.totalGuests} · target ≥ 25%`,
    action: 'Send Gratitude to recent departures',
    insightKey: 'recent_stays',
  };
  return null;
};

// Rule 2 — win-back pool sitting cold
const ruleWinbackDormant: Rule = (ctx) => {
  if (ctx.winbackPool < 5) return null;
  return {
    key: 'winback_dormant',
    priority: ctx.winbackPool > 30 ? 'critical' : 'warning',
    guardrail: 'fixed',
    title: `${ctx.winbackPool} guests haven't stayed in 1+ year`,
    body: 'Highest-conversion prospects — you already earned the relationship. Every month untouched, the invitation gets colder.',
    evidence: `Avg-LTV repeat ≈ $${Math.round(ctx.avgLtvRepeat)} · avg-LTV all ≈ $${Math.round(ctx.avgLtvAll)}`,
    action: 'Approve list → send win-back',
    insightKey: 'winback',
  };
};

// Rule 3 — repeat guests slipping their normal cadence
const ruleSlippingRepeats: Rule = (ctx) => {
  if (ctx.guestsSlipping60d === 0) return null;
  return {
    key: 'slipping_repeats',
    priority: 'warning',
    guardrail: 'dynamic',
    title: `${ctx.guestsSlipping60d} repeat guests are 60+ days past cadence`,
    body: 'They came back once, then the pattern broke. High-value save opportunity — competitor, life change, or an unresolved issue.',
    evidence: 'Cadence = 365d / stays_count · +60d slack',
    action: 'See list → send personal note',
    insightKey: 'slipping',
  };
};

// Rule 4 — cancel rate vs baseline
const ruleCancelRateHigh: Rule = (ctx) => {
  if (ctx.reservations < 20) return null;
  if (ctx.cancelRate < 10) return null;

  const baseline = ctx.cancelRateBaseline;
  const usingDynamic = baseline != null && ctx.cancelRate > baseline + 3;
  const pri: Insight['priority'] = ctx.cancelRate > 25 ? 'critical' : ctx.cancelRate > 15 ? 'warning' : 'info';

  return {
    key: 'cancel_rate_high',
    priority: pri,
    guardrail: usingDynamic ? 'dynamic' : 'fixed',
    title: usingDynamic
      ? `Cancel rate ${ctx.cancelRate.toFixed(1)}% vs rolling baseline ${baseline!.toFixed(1)}%`
      : `Cancel rate ${ctx.cancelRate.toFixed(1)}% (target ≤ 10%)`,
    body: 'High cancels signal aggressive OTA pricing that guests re-shop, or the lag between booking and stay letting doubts creep in.',
    evidence: `${ctx.reservations} reservations in last ${ctx.windowDays}d`,
    action: 'Investigate cancellations →',
    href: '/revenue/cancellations',
  };
};

// Rule 5 — no-shows
const ruleNoShows: Rule = (ctx) => {
  if (ctx.noShows === 0) return null;
  return {
    key: 'no_shows',
    priority: ctx.noShows > 5 ? 'critical' : 'warning',
    guardrail: 'fixed',
    title: `${ctx.noShows} no-shows in last ${ctx.windowDays} days`,
    body: 'Each no-show is a room-night lost and a guest cost avoided somewhere else. Confirm-day text messaging catches ~40%.',
    evidence: 'Compare confirm + arrive rate above',
    action: 'Review reservations →',
    href: '/revenue/cancellations',
  };
};

// Rule 6 — pre-stay email reach
const rulePreStayCoverage: Rule = (ctx) => {
  if (ctx.preStayCoveragePct == null) return null;
  if (ctx.preStayCoveragePct < 70) return {
    key: 'prestay_coverage',
    priority: 'warning',
    guardrail: 'fixed',
    title: `Pre-stay email reach only ${ctx.preStayCoveragePct.toFixed(0)}% of arrivals`,
    body: 'The Anticipation email is your leverage moment — sets expectations + captures upsells (transfer, spa, F&B). Missed sends = missed revenue.',
    evidence: 'Target ≥ 80% coverage',
    action: 'See list → chase missing emails',
    insightKey: 'upcoming_no_email',
  };
  return null;
};

// Rule 7 — guests at 4 stays
const rulePlatinumNudge: Rule = (ctx) => {
  if (ctx.guestsAt4Stays === 0) return null;
  return {
    key: 'platinum_nudge',
    priority: 'positive',
    guardrail: 'fixed',
    title: `${ctx.guestsAt4Stays} guests are ONE stay from Platinum`,
    body: 'Textbook upsell moment. A "your 5th stay" note + welcome-back perk converts most of these in 90 days.',
    evidence: 'Tier ladder: 1 → 3 → 5+ stays',
    action: 'Approve list → send 5th-stay',
    insightKey: 'at_4_stays',
  };
};

// Rule 8 — OTA response rate
const ruleReviewResponse: Rule = (ctx) => {
  if (ctx.responseRate == null || ctx.lowScoringUnanswered === 0) return null;
  if (ctx.lowScoringUnanswered >= 3 || ctx.responseRate < 80) return {
    key: 'reviews_unanswered',
    priority: 'warning',
    guardrail: 'fixed',
    title: `${ctx.lowScoringUnanswered} low-scoring reviews still unanswered`,
    body: 'Unreplied ★<4 reviews depress future bookings. OTAs rank on response cadence — silence hurts twice.',
    evidence: `Overall response rate ${(ctx.responseRate ?? 0).toFixed(0)}%`,
    action: 'Reply now →',
    href: '/guest/reputation',
  };
  return null;
};

// Rule 9 — unsub rate
const ruleUnsubRate: Rule = (ctx) => {
  if (ctx.unsubRate30d == null) return null;
  if (ctx.unsubRate30d > 1) return {
    key: 'unsub_rate_high',
    priority: 'warning',
    guardrail: 'fixed',
    title: `Unsubscribe rate ${ctx.unsubRate30d.toFixed(2)}% (target ≤ 0.5%)`,
    body: 'People opting out faster than target — content or frequency mismatch. High-LTV guests unsubscribing is silent churn.',
    evidence: 'Reduce cadence · split segments',
    action: 'Edit newsletter cadence →',
    href: '/guest/newsletters',
  };
  return null;
};

// Rule 10 — positive — repeat rate strong
const ruleRepeatRateStrong: Rule = (ctx) => {
  if (ctx.repeatRate >= 30 && ctx.totalGuests >= 50) return {
    key: 'repeat_rate_strong',
    priority: 'positive',
    guardrail: 'fixed',
    title: `Repeat rate ${ctx.repeatRate.toFixed(1)}% is well ABOVE target`,
    body: 'Retention engine humming. Consider a referral-reward mechanic — repeat guests are your best acquirers.',
    evidence: `${ctx.repeatGuests} of ${ctx.totalGuests} · ≥ 2 stays`,
  };
  return null;
};

const RULES: Rule[] = [
  ruleRepeatRateBelowTarget,
  ruleWinbackDormant,
  ruleSlippingRepeats,
  ruleCancelRateHigh,
  ruleNoShows,
  rulePreStayCoverage,
  rulePlatinumNudge,
  ruleReviewResponse,
  ruleUnsubRate,
  ruleRepeatRateStrong,
];

export function evaluateRetentionRules(ctx: RetentionContext): Insight[] {
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
