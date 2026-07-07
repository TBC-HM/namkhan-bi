// lib/rules/marketing.ts v1
// PBS 2026-07-07: Marketing HoD conclusion rules.
// Consumes operator-editable thresholds from public.guardrails (domain='marketing').

import type { Insight } from '@/app/_components/ConclusionBlock';

export interface MarketingTargets {
  campaign_cadence_days_min?: number;   // gte days — max gap between sends
  cost_per_lead_max?: number;           // lte currency
  prospect_enrichment_min?: number;     // gte % — prospects with email + country
  mx_verified_share_min?: number;       // gte % — MX-verified deliverable share
}

export interface MarketingContext {
  currencySymbol: string;

  // Live data (may be null when source not yet threaded)
  daysSinceLastCampaignSend: number | null;
  costPerLead: number | null;
  prospectEnrichmentPct: number | null;
  mxVerifiedSharePct: number | null;
  activeCampaigns: number;
  scheduledCampaigns: number;

  targets: MarketingTargets;
}

type Rule = (ctx: MarketingContext) => Insight | Insight[] | null;

const FB: Required<MarketingTargets> = {
  campaign_cadence_days_min: 21,
  cost_per_lead_max: 25,
  prospect_enrichment_min: 60,
  mx_verified_share_min: 80,
};
const T = (ctx: MarketingContext, k: keyof MarketingTargets) => ctx.targets[k] ?? FB[k];

// Rule 1 — No campaigns sent in a while
const ruleCampaignGap: Rule = (ctx) => {
  if (ctx.daysSinceLastCampaignSend == null) return null;
  const max = T(ctx, 'campaign_cadence_days_min');
  if (ctx.daysSinceLastCampaignSend <= max) return null;
  return {
    key: 'campaign_cadence_gap',
    priority: ctx.daysSinceLastCampaignSend > max * 2 ? 'warning' : 'info',
    guardrail: 'fixed',
    title: `${ctx.daysSinceLastCampaignSend}d since last campaign send — beyond ${max}-day cadence`,
    body: 'Silence trains the list to disengage. Even a short in-house update maintains permission + deliverability.',
    evidence: `Target ≤ ${max} days between sends`,
    action: 'See campaigns →',
    href: '/marketing/campaigns',
  };
};

// Rule 2 — Zero scheduled campaigns
const ruleNoneScheduled: Rule = (ctx) => {
  if (ctx.scheduledCampaigns > 0) return null;
  return {
    key: 'no_campaigns_scheduled',
    priority: 'warning',
    guardrail: 'fixed',
    title: 'No campaigns scheduled',
    body: 'Empty pipeline = unpredictable acquisition volume. Line up at least 2 sends in the next 30 days.',
    evidence: 'active=' + ctx.activeCampaigns + ' · scheduled=0',
    action: 'Plan a send →',
    href: '/marketing/campaigns',
  };
};

// Rule 3 — CPL over ceiling
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

// Rule 4 — Prospect enrichment low
const ruleEnrichmentLow: Rule = (ctx) => {
  if (ctx.prospectEnrichmentPct == null) return null;
  const min = T(ctx, 'prospect_enrichment_min');
  if (ctx.prospectEnrichmentPct >= min) return null;
  return {
    key: 'prospect_enrichment_low',
    priority: 'info',
    guardrail: 'fixed',
    title: `Prospect enrichment ${ctx.prospectEnrichmentPct.toFixed(0)}% — below ${min}% target`,
    body: 'Missing email/country on prospects = wasted opportunity. Route new prospects through the enrichment step before scheduling nurtures.',
    evidence: `Target ≥ ${min}%`,
    action: 'See prospects →',
    href: '/marketing/prospects',
  };
};

// Rule 5 — MX-verified share low
const ruleMxLow: Rule = (ctx) => {
  if (ctx.mxVerifiedSharePct == null) return null;
  const min = T(ctx, 'mx_verified_share_min');
  if (ctx.mxVerifiedSharePct >= min) return null;
  return {
    key: 'mx_verified_low',
    priority: 'warning',
    guardrail: 'fixed',
    title: `MX-verified share ${ctx.mxVerifiedSharePct.toFixed(0)}% — below ${min}% target`,
    body: 'Low deliverability floor = bounces and spam penalties. Run MX verification on the segment before the next big send.',
    evidence: `Target ≥ ${min}%`,
    action: 'See prospects →',
    href: '/marketing/prospects',
  };
};

const RULES: Rule[] = [
  ruleCampaignGap,
  ruleNoneScheduled,
  ruleCplHigh,
  ruleEnrichmentLow,
  ruleMxLow,
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
