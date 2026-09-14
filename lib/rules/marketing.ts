// lib/rules/marketing.ts v2
// PBS 2026-07-07: Marketing HoD conclusion rules.
// PBS 2026-09-14: Added open_rate, unsub_rate, direct_share, social cadence,
//                 newsletter cadence, OTA share, and reach composite rules.
// Consumes operator-editable thresholds from public.guardrails (domain='marketing').

import type { Insight } from '@/app/_components/ConclusionBlock';

export interface MarketingTargets {
  campaign_cadence_days_min?: number;      // gte days — max gap between sends
  cost_per_lead_max?: number;              // lte currency
  prospect_enrichment_min?: number;        // gte % — prospects with email + country
  mx_verified_share_min?: number;          // gte % — MX-verified deliverable share
  open_rate_min?: number;                  // gte % — newsletter open rate
  unsub_rate_max?: number;                 // lte % — newsletter unsub rate
  direct_share_min?: number;              // gte % — direct booking share last 90 d
  social_post_cadence_days_max?: number;  // lte days — max gap between published posts
  newsletter_cadence_days_max?: number;   // lte days — max days between sends
  ota_share_max?: number;                 // lte % — OTA revenue share last 90 d
  reach_composite_drop_pct_max?: number;  // lte % — max composite reach drop
}

export interface MarketingContext {
  currencySymbol: string;

  // Campaign / sending
  daysSinceLastCampaignSend: number | null;
  costPerLead: number | null;
  activeCampaigns: number;
  scheduledCampaigns: number;

  // Prospect list quality
  prospectEnrichmentPct: number | null;
  mxVerifiedSharePct: number | null;

  // Newsletter performance
  openRatePct: number | null;            // latest send open rate (%)
  unsubRatePct: number | null;           // latest send unsub rate (%)
  daysSinceLastNewsletter: number | null; // days since last broadcast

  // Channel mix
  directSharePct90d: number | null;      // direct % of booked revenue last 90 d
  otaSharePct90d: number | null;         // OTA % (excl. SLH) last 90 d

  // Social
  daysSinceLastSocialPost: number | null; // days since last published post
  scheduledPosts: number | null;          // posts scheduled in future

  // Reach
  compositeChangePct: number | null;      // composite reach change vs prior snapshot

  targets: MarketingTargets;
}

type Rule = (ctx: MarketingContext) => Insight | Insight[] | null;

const FB: Required<MarketingTargets> = {
  campaign_cadence_days_min: 21,
  cost_per_lead_max: 25,
  prospect_enrichment_min: 60,
  mx_verified_share_min: 80,
  open_rate_min: 25,
  unsub_rate_max: 0.5,
  direct_share_min: 60,
  social_post_cadence_days_max: 7,
  newsletter_cadence_days_max: 35,
  ota_share_max: 65,
  reach_composite_drop_pct_max: 25,
};
const T = (ctx: MarketingContext, k: keyof MarketingTargets) => ctx.targets[k] ?? FB[k];

// ─── Campaign / cadence rules ─────────────────────────────────────────────────

const ruleCampaignGap: Rule = (ctx) => {
  if (ctx.daysSinceLastCampaignSend == null) return null;
  const max = T(ctx, 'campaign_cadence_days_min');
  if (ctx.daysSinceLastCampaignSend <= max) return null;
  return {
    key: 'mkt_campaign_cadence_gap',
    priority: ctx.daysSinceLastCampaignSend > max * 2 ? 'warning' : 'info',
    guardrail: 'fixed',
    title: `${ctx.daysSinceLastCampaignSend}d since last campaign — beyond ${max}-day cadence`,
    body: 'Silence trains the list to disengage. Even a short in-house update maintains permission + deliverability.',
    evidence: `Target ≤ ${max} days between sends`,
    action: 'See campaigns →',
    href: '/marketing/campaigns',
  };
};

const ruleNoneScheduled: Rule = (ctx) => {
  if (ctx.scheduledCampaigns > 0) return null;
  return {
    key: 'mkt_no_campaigns_scheduled',
    priority: 'warning',
    guardrail: 'fixed',
    title: 'No campaigns scheduled',
    body: 'Empty pipeline = unpredictable acquisition volume. Line up at least 2 sends in the next 30 days.',
    evidence: 'active=' + ctx.activeCampaigns + ' · scheduled=0',
    action: 'Plan a send →',
    href: '/marketing/campaigns',
  };
};

// ─── Prospect quality rules ───────────────────────────────────────────────────

const ruleCplHigh: Rule = (ctx) => {
  if (ctx.costPerLead == null) return null;
  const max = T(ctx, 'cost_per_lead_max');
  if (ctx.costPerLead <= max) return null;
  return {
    key: 'mkt_cpl_high',
    priority: 'warning',
    guardrail: 'fixed',
    title: `CPL ${ctx.currencySymbol}${Math.round(ctx.costPerLead)} — above ${ctx.currencySymbol}${max} ceiling`,
    body: 'Paid acquisition is losing efficiency. Pause the worst 20% of ads by CPL before topping up budget.',
    evidence: `Ceiling ≤ ${ctx.currencySymbol}${max}`,
    action: 'See funnels →',
    href: '/marketing/funnels',
  };
};

const ruleEnrichmentLow: Rule = (ctx) => {
  if (ctx.prospectEnrichmentPct == null) return null;
  const min = T(ctx, 'prospect_enrichment_min');
  if (ctx.prospectEnrichmentPct >= min) return null;
  return {
    key: 'mkt_prospect_enrichment_low',
    priority: 'info',
    guardrail: 'fixed',
    title: `Prospect enrichment ${ctx.prospectEnrichmentPct.toFixed(0)}% — below ${min}% target`,
    body: 'Missing email/country on prospects = wasted opportunity. Route new prospects through the enrichment step before scheduling nurtures.',
    evidence: `Target ≥ ${min}%`,
    action: 'See prospects →',
    href: '/marketing/prospects',
  };
};

const ruleMxLow: Rule = (ctx) => {
  if (ctx.mxVerifiedSharePct == null) return null;
  const min = T(ctx, 'mx_verified_share_min');
  if (ctx.mxVerifiedSharePct >= min) return null;
  return {
    key: 'mkt_mx_verified_low',
    priority: 'warning',
    guardrail: 'fixed',
    title: `MX-verified share ${ctx.mxVerifiedSharePct.toFixed(0)}% — below ${min}% target`,
    body: 'Low deliverability floor = bounces and spam penalties. Run MX verification on the segment before the next big send.',
    evidence: `Target ≥ ${min}%`,
    action: 'See prospects →',
    href: '/marketing/prospects',
  };
};

// ─── Newsletter performance rules ─────────────────────────────────────────────

const ruleOpenRateLow: Rule = (ctx) => {
  if (ctx.openRatePct == null) return null;
  const min = T(ctx, 'open_rate_min');
  if (ctx.openRatePct >= min) return null;
  return {
    key: 'mkt_open_rate_low',
    priority: 'warning',
    guardrail: 'fixed',
    title: `Open rate ${ctx.openRatePct.toFixed(1)}% — below ${min}% target`,
    body: 'Below-target open rates signal subject-line fatigue or list quality issues. A/B test subjects on the next send; consider a re-engagement sub-segment.',
    evidence: `Target ≥ ${min}%`,
    action: 'See newsletters →',
    href: '/marketing/content/newsletters',
  };
};

const ruleUnsubHigh: Rule = (ctx) => {
  if (ctx.unsubRatePct == null) return null;
  const max = T(ctx, 'unsub_rate_max');
  if (ctx.unsubRatePct <= max) return null;
  return {
    key: 'mkt_unsub_rate_high',
    priority: ctx.unsubRatePct > max * 2 ? 'critical' : 'warning',
    guardrail: 'fixed',
    title: `Unsub rate ${ctx.unsubRatePct.toFixed(2)}% — above ${max}% ceiling`,
    body: 'High unsubscribes damage sender reputation and shrink the list. Narrow the send segment and review content relevance before the next broadcast.',
    evidence: `Ceiling ≤ ${max}%`,
    action: 'See newsletters →',
    href: '/marketing/content/newsletters',
  };
};

const ruleNewsletterCadence: Rule = (ctx) => {
  if (ctx.daysSinceLastNewsletter == null) return null;
  const max = T(ctx, 'newsletter_cadence_days_max');
  if (ctx.daysSinceLastNewsletter <= max) return null;
  return {
    key: 'mkt_newsletter_cadence_gap',
    priority: ctx.daysSinceLastNewsletter > max * 2 ? 'warning' : 'info',
    guardrail: 'fixed',
    title: `${ctx.daysSinceLastNewsletter}d since last newsletter — beyond ${max}-day cadence`,
    body: 'Irregular sends lose the habit loop. Use a quick property update or curated content piece to maintain momentum.',
    evidence: `Target ≤ ${max} days between sends`,
    action: 'Draft a send →',
    href: '/marketing/content/newsletters',
  };
};

// ─── Channel mix rules ────────────────────────────────────────────────────────

const ruleDirectShareLow: Rule = (ctx) => {
  if (ctx.directSharePct90d == null) return null;
  const min = T(ctx, 'direct_share_min');
  if (ctx.directSharePct90d >= min) return null;
  const gap = min - ctx.directSharePct90d;
  return {
    key: 'mkt_direct_share_low',
    priority: gap > 20 ? 'critical' : 'warning',
    guardrail: 'fixed',
    title: `Direct share ${ctx.directSharePct90d.toFixed(1)}% — ${gap.toFixed(0)}pp below ${min}% goal`,
    body: 'OTAs are absorbing revenue that should route directly. Prioritise funnel pages, repeat-guest outreach, and SLH direct-booking incentives.',
    evidence: `OTA share ${ctx.otaSharePct90d != null ? ctx.otaSharePct90d.toFixed(1) + '%' : '—'} of last-90d revenue`,
    action: 'Build funnel pages →',
    href: '/marketing/funnels',
  };
};

const ruleOtaShareHigh: Rule = (ctx) => {
  if (ctx.otaSharePct90d == null) return null;
  const max = T(ctx, 'ota_share_max');
  if (ctx.otaSharePct90d <= max) return null;
  return {
    key: 'mkt_ota_share_high',
    priority: 'warning',
    guardrail: 'fixed',
    title: `OTA share ${ctx.otaSharePct90d.toFixed(1)}% — above ${max}% ceiling`,
    body: 'OTA dependency erodes margin and repeat-guest ownership. Each percentage point shifted to direct saves ~15% commission.',
    evidence: `Direct ${ctx.directSharePct90d != null ? ctx.directSharePct90d.toFixed(1) + '%' : '—'} last 90 d`,
    action: 'See channel mix →',
    href: '/marketing/dashboard',
  };
};

// ─── Social cadence rule ──────────────────────────────────────────────────────

const ruleSocialPostGap: Rule = (ctx) => {
  if (ctx.daysSinceLastSocialPost == null) return null;
  const max = T(ctx, 'social_post_cadence_days_max');
  if (ctx.daysSinceLastSocialPost <= max) return null;
  const noQueue = ctx.scheduledPosts != null && ctx.scheduledPosts === 0;
  return {
    key: 'mkt_social_post_gap',
    priority: noQueue ? 'warning' : 'info',
    guardrail: 'fixed',
    title: `${ctx.daysSinceLastSocialPost}d since last social post — beyond ${max}-day cadence`,
    body: noQueue
      ? 'No scheduled posts in queue either. Algorithms penalise prolonged silence — publish even an evergreen repost to keep the feed alive.'
      : 'Last publish was over target cadence. Queued posts will cover this soon.',
    evidence: `Scheduled posts: ${ctx.scheduledPosts ?? '—'}`,
    action: 'See social →',
    href: '/marketing/social',
  };
};

// ─── Reach composite rule ─────────────────────────────────────────────────────

const ruleReachDrop: Rule = (ctx) => {
  if (ctx.compositeChangePct == null) return null;
  const max = T(ctx, 'reach_composite_drop_pct_max');
  const drop = -(ctx.compositeChangePct); // positive = dropped
  if (drop <= max) return null;
  return {
    key: 'mkt_reach_composite_drop',
    priority: drop > max * 1.5 ? 'critical' : 'warning',
    guardrail: 'fixed',
    title: `Reach composite dropped ${drop.toFixed(1)}% — beyond ${max}% threshold`,
    body: 'Combined audience reach (sessions + search impressions + social) fell materially vs the prior snapshot. Review which channel drove the decline.',
    evidence: `Change: ${ctx.compositeChangePct.toFixed(1)}%`,
    action: 'See dashboard →',
    href: '/marketing/dashboard',
  };
};

const RULES: Rule[] = [
  ruleCampaignGap,
  ruleNoneScheduled,
  ruleCplHigh,
  ruleEnrichmentLow,
  ruleMxLow,
  ruleOpenRateLow,
  ruleUnsubHigh,
  ruleNewsletterCadence,
  ruleDirectShareLow,
  ruleOtaShareHigh,
  ruleSocialPostGap,
  ruleReachDrop,
];

export function evaluateMarketingRules(ctx: MarketingContext): Insight[] {
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
