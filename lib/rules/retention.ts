// lib/rules/retention.ts
// PBS 2026-07-06: "Gold rules" for the retention (guest.behaviour) conclusion block.
//
// Rules are pure functions of a context object → 0 or more Insight[].
// Each rule captures ONE piece of operator judgment: "if X is true, here's what it means and what to do."
// The evaluator runs all rules, ConclusionBlock sorts/renders.
//
// Adding a rule = adding a function to RULES. Reviewing all interpretations = read this file.
// Reuse the same shape for revenue/rules.ts, sales/rules.ts, etc.

import type { Insight } from '@/app/_components/ConclusionBlock';

// ---------------------------------------------------------------------------
// Domain context — what the rules read.
// Fill from page's server query results.
// ---------------------------------------------------------------------------
export interface RetentionContext {
  // Loyalty side
  totalGuests: number;
  repeatGuests: number;          // ≥ 2 stays
  repeatRate: number;            // % (0-100)
  avgLtvAll: number;             // $
  avgLtvRepeat: number;          // $
  winbackPool: number;           // last stay > 1y with valid email
  loyaltyMembers: number;
  guestsAt4Stays: number;        // 1 stay away from platinum tier
  guestsSlipping60d: number;     // repeat guests whose next-expected-stay is > 60d overdue

  // Journey side (last N days window)
  reservations: number;
  confirmRate: number;
  arriveRate: number;
  cancelRate: number;
  noShows: number;
  medianLead: number | null;
  inHouse: number;
  windowDays: number;
  preStayCoveragePct: number;    // % of arriving guests who got pre-stay email

  // Reputation side (cross-page — from marketing.reviews)
  responseRate: number | null;   // % across sources
  lowScoringUnanswered: number;  // ★<4 without a reply

  // Marketing loop
  unsubRate30d: number | null;   // % of newsletter recipients who unsubscribed in last 30d
}

// ---------------------------------------------------------------------------
// The rule set. Each rule = one file section = one operator judgment.
// ---------------------------------------------------------------------------
type Rule = (ctx: RetentionContext) => Insight | Insight[] | null;

// Rule 1: Repeat rate below target
const ruleRepeatRateBelowTarget: Rule = (ctx) => {
  if (ctx.repeatRate == null || ctx.totalGuests < 20) return null;
  if (ctx.repeatRate < 15) return {
    priority: 'critical',
    title: `Repeat rate ${ctx.repeatRate.toFixed(1)}% is well below 25% target`,
    body: 'Retention machine isn\'t firing. Guests aren\'t coming back — either the offer isn\'t compelling enough for a second visit, or you\'re losing them silently between stays.',
    evidence: `${ctx.repeatGuests} of ${ctx.totalGuests} guests · gap ${(25 - ctx.repeatRate).toFixed(1)}pp`,
    action: 'Send Anticipation + Gratitude to 100 most-recent guests',
    href: '/marketing/prospects/sequences',
  };
  if (ctx.repeatRate < 25) return {
    priority: 'warning',
    title: `Repeat rate ${ctx.repeatRate.toFixed(1)}% is under 25% target`,
    body: 'You\'re on the border. Small tweaks to post-stay follow-up cadence can push this into safe territory within 2 booking cycles.',
    evidence: `${ctx.repeatGuests} of ${ctx.totalGuests} · target ≥ 25%`,
  };
  return null;
};

// Rule 2: Win-back pool sitting cold
const ruleWinbackDormant: Rule = (ctx) => {
  if (ctx.winbackPool < 5) return null;
  return {
    priority: ctx.winbackPool > 30 ? 'critical' : 'warning',
    title: `${ctx.winbackPool} guests haven\'t stayed in 1+ year`,
    body: 'These are your highest-conversion prospects — a warm relationship you already earned. Every month they sit untouched, the invitation gets colder.',
    evidence: `Avg-LTV repeat ≈ $${Math.round(ctx.avgLtvRepeat)} · avg-LTV all ≈ $${Math.round(ctx.avgLtvAll)}`,
    action: 'Launch win-back sequence with "3 nights, complimentary massage" hook',
    href: '/marketing/prospects/sequences',
  };
};

// Rule 3: Repeat guests slipping — didn't come back on their typical cadence
const ruleSlippingRepeats: Rule = (ctx) => {
  if (ctx.guestsSlipping60d === 0) return null;
  return {
    priority: 'warning',
    title: `${ctx.guestsSlipping60d} repeat guests are 60+ days past their expected cadence`,
    body: 'They came back once; now the pattern broke. Something changed — travel plans, competitor, or an unresolved issue from their last stay. High-value save opportunity.',
    evidence: 'Check /guest/directory for recent-touch history',
    action: 'Personal note from Yasmine within 7 days',
  };
};

// Rule 4: Cancel rate above threshold
const ruleCancelRateHigh: Rule = (ctx) => {
  if (ctx.reservations < 20) return null;
  if (ctx.cancelRate < 10) return null;
  const pri: Insight['priority'] = ctx.cancelRate > 25 ? 'critical' : ctx.cancelRate > 15 ? 'warning' : 'info';
  return {
    priority: pri,
    title: `Cancel rate ${ctx.cancelRate.toFixed(1)}% (target ≤ 10%)`,
    body: 'High cancels signal either aggressive OTA pricing that guests re-shop, or a lag between booking excitement and stay date that lets doubts creep in.',
    evidence: `${ctx.reservations} reservations in last ${ctx.windowDays}d`,
    action: 'Review /revenue/cancellations for source split',
    href: '/revenue/cancellations',
  };
};

// Rule 5: No-shows
const ruleNoShows: Rule = (ctx) => {
  if (ctx.noShows === 0) return null;
  return {
    priority: ctx.noShows > 5 ? 'critical' : 'warning',
    title: `${ctx.noShows} no-shows in the last ${ctx.windowDays} days`,
    body: 'Every no-show is a room-night lost + a guest cost avoided somewhere else. Confirm-day text messaging catches ~40% of these.',
    evidence: 'Compare confirm rate + arrive rate above',
  };
};

// Rule 6: Pre-stay email coverage low
const rulePreStayCoverage: Rule = (ctx) => {
  if (ctx.preStayCoveragePct == null) return null;
  if (ctx.preStayCoveragePct < 70) return {
    priority: 'warning',
    title: `Pre-stay email hit ${ctx.preStayCoveragePct.toFixed(0)}% of arrivals`,
    body: 'The Anticipation email is your leverage moment — it sets expectations + captures upsells (transfer, spa, F&B). Missed sends = missed revenue.',
    evidence: 'Target ≥ 80% coverage',
    action: 'Audit journey — email addresses missing on Cloudbeds rows',
    href: '/marketing/prospects',
  };
  return null;
};

// Rule 7: Guests at 4 stays → tier-up nudge
const rulePlatinumNudge: Rule = (ctx) => {
  if (ctx.guestsAt4Stays === 0) return null;
  return {
    priority: 'positive',
    title: `${ctx.guestsAt4Stays} guests are ONE stay away from Platinum`,
    body: 'Textbook upsell moment. A personalized "your 5th stay" note + welcome-back perk converts most of these in 90 days.',
    evidence: 'Tier ladder: 1 → 3 → 5+ stays',
    action: 'Draft "your 5th stay" template + owner sign-off',
    href: '/guest/newsletters/templates',
  };
};

// Rule 8: OTA response rate low → hurts future bookings, not just guest satisfaction
const ruleReviewResponse: Rule = (ctx) => {
  if (ctx.responseRate == null || ctx.lowScoringUnanswered === 0) return null;
  if (ctx.lowScoringUnanswered >= 3 || (ctx.responseRate < 80)) return {
    priority: 'warning',
    title: `${ctx.lowScoringUnanswered} low-scoring reviews still unanswered`,
    body: 'Unreplied ★<4 reviews depress future bookings. OTAs rank properties partly on response cadence — silence hurts you twice.',
    evidence: `Overall response rate ${(ctx.responseRate ?? 0).toFixed(0)}%`,
    action: 'Reply to lowest-scoring first',
    href: '/guest/reputation',
  };
  return null;
};

// Rule 9: Newsletter fatigue signal
const ruleUnsubRate: Rule = (ctx) => {
  if (ctx.unsubRate30d == null) return null;
  if (ctx.unsubRate30d > 1) return {
    priority: 'warning',
    title: `Unsubscribe rate ${ctx.unsubRate30d.toFixed(2)}% in last 30d (target ≤ 0.5%)`,
    body: 'People are opting out faster than target — content or frequency mismatch. High-LTV guests unsubscribing is silent churn.',
    evidence: 'Check /guest/newsletters cadence + segment targeting',
    action: 'Split segments · reduce send cadence',
    href: '/guest/newsletters',
  };
  return null;
};

// Rule 10: Positive — repeat rate strong
const ruleRepeatRateStrong: Rule = (ctx) => {
  if (ctx.repeatRate >= 30 && ctx.totalGuests >= 50) return {
    priority: 'positive',
    title: `Repeat rate ${ctx.repeatRate.toFixed(1)}% is well ABOVE target`,
    body: 'Retention engine is humming. Consider a referral-reward mechanic — repeat guests are your best acquirers.',
    evidence: `${ctx.repeatGuests} of ${ctx.totalGuests} · ≥ 2 stays`,
  };
  return null;
};

// ---------------------------------------------------------------------------
// Registry + evaluator
// ---------------------------------------------------------------------------
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
