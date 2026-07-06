// lib/rules/reputation.ts
// PBS 2026-07-06: Reputation "gold rules" — feed the HoD ConclusionBlock.
// Each rule = pure function on ReputationContext → 0..N Insight[].
// Every insight has a CTA.

import type { Insight } from '@/app/_components/ConclusionBlock';

export interface ReputationContext {
  totalReviews: number;
  respondedReviews: number;
  responseRate: number | null;              // %
  lowScoringUnanswered: number;             // ★<4 not responded
  criticalUnanswered: number;               // ★<3 not responded
  daysSinceLastScrape: number | null;
  sourcesWithoutContent: number;            // sources in our list with 0 rows
  avgRatingLast90d: number | null;
  avgRatingAllTime: number | null;
}

type Rule = (ctx: ReputationContext) => Insight | Insight[] | null;

const ruleCriticalUnanswered: Rule = (ctx) => {
  if (ctx.criticalUnanswered === 0) return null;
  return {
    key: 'rep_critical_unanswered',
    priority: 'critical',
    guardrail: 'fixed',
    title: `${ctx.criticalUnanswered} ★<3 review${ctx.criticalUnanswered === 1 ? '' : 's'} unanswered`,
    body: 'Bad reviews without a reply do the most damage — they signal to future guests that the property doesn\'t care.',
    evidence: 'Priority: reply within 48h',
    action: 'Reply now →',
    href: '/guest/reputation',
  };
};

const ruleResponseRate: Rule = (ctx) => {
  if (ctx.responseRate == null || ctx.totalReviews < 5) return null;
  if (ctx.responseRate >= 80) return null;
  return {
    key: 'rep_response_rate_low',
    priority: ctx.responseRate < 50 ? 'critical' : 'warning',
    guardrail: 'fixed',
    title: `Response rate ${ctx.responseRate.toFixed(0)}% — target ≥ 80%`,
    body: 'OTAs partially rank properties on how quickly + often you respond. Silence hurts you twice: guest experience + placement.',
    evidence: `${ctx.respondedReviews} of ${ctx.totalReviews} replies posted`,
    action: 'Open reply queue →',
    href: '/guest/reputation',
  };
};

const ruleLowScoringUnanswered: Rule = (ctx) => {
  if (ctx.lowScoringUnanswered < 3) return null;
  return {
    key: 'rep_low_scoring_unanswered',
    priority: 'warning',
    guardrail: 'fixed',
    title: `${ctx.lowScoringUnanswered} low-scoring (★<4) reviews still unanswered`,
    body: 'These are your reply pipeline. A short, honest reply defuses most of them.',
    evidence: 'Target: 0 unanswered ★<4',
    action: 'Reply queue →',
    href: '/guest/reputation',
  };
};

const ruleScrapeStale: Rule = (ctx) => {
  if (ctx.daysSinceLastScrape == null) return null;
  if (ctx.daysSinceLastScrape < 8) return null;
  return {
    key: 'rep_scrape_stale',
    priority: 'observation',
    guardrail: 'dynamic',
    title: `Last review scrape was ${ctx.daysSinceLastScrape}d ago`,
    body: 'The weekly Sunday cron may not have fired. Any new reviews on Booking / Expedia / TripAdvisor aren\'t visible here yet.',
    evidence: 'Weekly cron: Sunday 20:00 Laos',
    action: 'Pull latest →',
    href: '/guest/reputation',
  };
};

const ruleAvgRatingDrop: Rule = (ctx) => {
  if (ctx.avgRatingLast90d == null || ctx.avgRatingAllTime == null) return null;
  if (ctx.avgRatingLast90d >= ctx.avgRatingAllTime - 0.2) return null;
  return {
    key: 'rep_avg_rating_drop',
    priority: 'warning',
    guardrail: 'dynamic',
    title: `Avg rating last 90d (${ctx.avgRatingLast90d.toFixed(2)}) is below all-time (${ctx.avgRatingAllTime.toFixed(2)})`,
    body: 'Recent guests are scoring lower than your historical average. Something changed — service, product, or expectation-setting.',
    evidence: `Gap ${(ctx.avgRatingAllTime - ctx.avgRatingLast90d).toFixed(2)}`,
    action: 'Investigate recent reviews →',
    href: '/guest/reputation',
  };
};

const REPUTATION_RULES: Rule[] = [
  ruleCriticalUnanswered,
  ruleResponseRate,
  ruleLowScoringUnanswered,
  ruleScrapeStale,
  ruleAvgRatingDrop,
];

export function evaluateReputationRules(ctx: ReputationContext): Insight[] {
  const out: Insight[] = [];
  for (const rule of REPUTATION_RULES) {
    try {
      const r = rule(ctx);
      if (!r) continue;
      if (Array.isArray(r)) out.push(...r); else out.push(r);
    } catch { /* one bad rule can't nuke the block */ }
  }
  return out;
}
