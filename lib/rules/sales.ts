// lib/rules/sales.ts v1
// PBS 2026-07-07: Sales HoD conclusion rules.
// Consumes operator-editable thresholds from public.guardrails (domain='sales').

import type { Insight } from '@/app/_components/ConclusionBlock';

export interface SalesTargets {
  inquiry_response_hours?: number;   // lte hours — max acceptable response lag
  conversion_rate?: number;          // gte % — inquiry → booking
  cost_per_lead_max?: number;        // lte currency
  group_lead_time_days?: number;     // gte days — group-booking minimum lead
}

export interface SalesContext {
  currencySymbol: string;

  // Live data (may be null when not yet threaded)
  openInquiries: number;              // count of active inquiries
  oldestInquiryHours: number | null;  // hours since oldest unhandled
  inquiryConversionPct: number | null;
  costPerLead: number | null;
  avgGroupLeadTime: number | null;

  targets: SalesTargets;
}

type Rule = (ctx: SalesContext) => Insight | Insight[] | null;

const FB: Required<SalesTargets> = {
  inquiry_response_hours: 24,
  conversion_rate: 10,
  cost_per_lead_max: 25,
  group_lead_time_days: 60,
};
const T = (ctx: SalesContext, k: keyof SalesTargets) => ctx.targets[k] ?? FB[k];

// Rule 1 — Slow inquiry response
const ruleInquiryResponseSlow: Rule = (ctx) => {
  if (ctx.oldestInquiryHours == null || ctx.openInquiries === 0) return null;
  const max = T(ctx, 'inquiry_response_hours');
  if (ctx.oldestInquiryHours <= max) return null;
  return {
    key: 'inquiry_response_slow',
    priority: ctx.oldestInquiryHours > max * 2 ? 'critical' : 'warning',
    guardrail: 'fixed',
    title: `Oldest inquiry ${Math.round(ctx.oldestInquiryHours)}h old — over ${max}h SLA`,
    body: 'Sales SLA breached. Response speed is the single biggest predictor of conversion — every hour past target = ~2-3% conversion drop.',
    evidence: `${ctx.openInquiries} open inquiries · target ≤ ${max}h`,
    action: 'See inquiries →',
    href: '/sales/inquiries',
  };
};

// Rule 2 — Inquiry backlog high
const ruleInquiryBacklog: Rule = (ctx) => {
  if (ctx.openInquiries < 5) return null;
  return {
    key: 'inquiry_backlog',
    priority: ctx.openInquiries >= 10 ? 'warning' : 'info',
    guardrail: 'fixed',
    title: `${ctx.openInquiries} open inquiries in the funnel`,
    body: 'Backlog signal. Either the team is under-resourced or the qualification step is bottlenecking. Look at oldest-first triage.',
    evidence: `≥ 5 open triggers this signal`,
    action: 'See inquiries →',
    href: '/sales/inquiries',
  };
};

// Rule 3 — Conversion rate below target
const ruleConversionLow: Rule = (ctx) => {
  if (ctx.inquiryConversionPct == null) return null;
  const target = T(ctx, 'conversion_rate');
  if (ctx.inquiryConversionPct >= target) return null;
  return {
    key: 'conversion_low',
    priority: 'warning',
    guardrail: 'fixed',
    title: `Inquiry conversion ${ctx.inquiryConversionPct.toFixed(1)}% — below ${target}% target`,
    body: 'Either the top of funnel is not qualified enough, or the pitch/rate is losing hot inquiries. Compare source-by-source conversion.',
    evidence: `Target ≥ ${target}%`,
    action: 'See funnel →',
    href: '/sales/inquiries',
  };
};

// Rule 4 — Cost per lead high
const ruleCplHigh: Rule = (ctx) => {
  if (ctx.costPerLead == null) return null;
  const max = T(ctx, 'cost_per_lead_max');
  if (ctx.costPerLead <= max) return null;
  return {
    key: 'cpl_high',
    priority: 'warning',
    guardrail: 'fixed',
    title: `CPL ${ctx.currencySymbol}${Math.round(ctx.costPerLead)} — above ${ctx.currencySymbol}${max} ceiling`,
    body: 'Acquisition cost outpacing benchmark. Audit which campaigns are burning budget without converting, and pause the ones with sub-target lead quality.',
    evidence: `Ceiling ≤ ${ctx.currencySymbol}${max}`,
    action: 'See campaigns →',
    href: '/marketing/campaigns',
  };
};

// Rule 5 — Group booking lead time short
const ruleGroupLeadShort: Rule = (ctx) => {
  if (ctx.avgGroupLeadTime == null) return null;
  const min = T(ctx, 'group_lead_time_days');
  if (ctx.avgGroupLeadTime >= min) return null;
  return {
    key: 'group_lead_short',
    priority: 'info',
    guardrail: 'fixed',
    title: `Avg group lead ${Math.round(ctx.avgGroupLeadTime)} days — below ${min}-day floor`,
    body: 'Short group leads = tighter planning, tighter margins, and lower upsell potential. Consider a rate-decay curve that penalises late bookings.',
    evidence: `Target ≥ ${min} days`,
    action: 'See groups →',
    href: '/sales/groups',
  };
};

const RULES: Rule[] = [
  ruleInquiryResponseSlow,
  ruleInquiryBacklog,
  ruleConversionLow,
  ruleCplHigh,
  ruleGroupLeadShort,
];

export function evaluateSalesRules(ctx: SalesContext): Insight[] {
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
