// lib/rules/newsletter.ts
// PBS 2026-07-06: Newsletter "gold rules" — feed the HoD ConclusionBlock.
// Every insight has a CTA.

import type { Insight } from '@/app/_components/ConclusionBlock';

export interface NewsletterContext {
  scheduledCount: number;               // campaigns with status='scheduled' and future planned_date
  draftsCount: number;                  // status='draft'
  daysSinceLastSend: number | null;
  sends30d: number;                     // count of unique campaigns sent last 30d
  sent30d: number;                      // total recipient rows sent
  unsub30d: number;
  opens30d: number;
  openRate30d: number | null;           // %
  unsubRate30d: number | null;          // %
  contactableGuests: number;            // reachable pool
  totalGuests: number;
  failedSends24h: number;               // send jobs that returned non-ok in last 24h
}

type Rule = (ctx: NewsletterContext) => Insight | Insight[] | null;

const ruleNoScheduled: Rule = (ctx) => {
  if (ctx.scheduledCount > 0) return null;
  if (ctx.draftsCount === 0) return null;   // no drafts either → different concern
  return {
    key: 'nl_none_scheduled',
    priority: 'warning',
    guardrail: 'fixed',
    title: `${ctx.draftsCount} drafts ready but none scheduled`,
    body: 'Newsletters drive both repeat stays and win-backs. A draft in the queue that never ships is a story never told.',
    evidence: 'Cadence target: 1 per month minimum',
    action: 'Schedule a draft →',
    href: '/guest/newsletters',
  };
};

const ruleLongSinceSend: Rule = (ctx) => {
  if (ctx.daysSinceLastSend == null) return null;
  if (ctx.daysSinceLastSend < 45) return null;
  return {
    key: 'nl_long_since_send',
    priority: 'warning',
    guardrail: 'fixed',
    title: `${ctx.daysSinceLastSend}d since the last newsletter went out`,
    body: 'Beyond 6 weeks silent, list warmth cools — open rates drop on the next send. Time to ship one.',
    evidence: 'Target: send at least every 30-40d',
    action: 'Schedule + send →',
    href: '/guest/newsletters',
  };
};

const ruleHighUnsub: Rule = (ctx) => {
  if (ctx.unsubRate30d == null) return null;
  if (ctx.unsubRate30d <= 1) return null;
  return {
    key: 'nl_unsub_high',
    priority: ctx.unsubRate30d > 2 ? 'critical' : 'warning',
    guardrail: 'fixed',
    title: `Unsubscribe rate ${ctx.unsubRate30d.toFixed(2)}% (last 30d) · target ≤ 0.5%`,
    body: 'People opting out faster than target. Content, frequency, or segmentation is off.',
    evidence: `${ctx.unsub30d} unsub / ${ctx.sent30d} sent`,
    action: 'Edit cadence + segments →',
    href: '/guest/newsletters',
  };
};

const ruleLowOpenRate: Rule = (ctx) => {
  if (ctx.openRate30d == null) return null;
  if (ctx.sent30d < 100) return null; // ignore small samples
  if (ctx.openRate30d >= 25) return null;
  return {
    key: 'nl_open_rate_low',
    priority: 'warning',
    guardrail: 'fixed',
    title: `Open rate ${ctx.openRate30d.toFixed(1)}% (last 30d) — below 25% baseline`,
    body: 'Subject lines aren\'t landing, or the from-name doesn\'t look trusted. Both fix quickly.',
    evidence: `${ctx.opens30d} opens / ${ctx.sent30d} sent`,
    action: 'A/B a new subject →',
    href: '/guest/newsletters',
  };
};

const ruleFailedSends: Rule = (ctx) => {
  if (ctx.failedSends24h === 0) return null;
  return {
    key: 'nl_failed_sends',
    priority: 'critical',
    guardrail: 'fixed',
    title: `${ctx.failedSends24h} newsletter send${ctx.failedSends24h === 1 ? '' : 's'} failed in last 24h`,
    body: 'Sends returned errors from Resend. Check RESEND_API_KEY, domain verification, or per-hour rate limits.',
    evidence: 'From guest.campaign_recipients failed_reason',
    action: 'View send log →',
    href: '/guest/newsletters',
  };
};

const ruleContactableCoverage: Rule = (ctx) => {
  if (ctx.totalGuests < 100) return null;
  const share = (ctx.contactableGuests / ctx.totalGuests) * 100;
  if (share >= 60) return null;
  return {
    key: 'nl_contactable_low',
    priority: 'observation',
    guardrail: 'dynamic',
    title: `Only ${share.toFixed(0)}% of guests have a usable email`,
    body: 'Even the perfect newsletter can\'t reach nearly half your guest base. Contact-hydration is a marketing multiplier.',
    evidence: `${ctx.contactableGuests} of ${ctx.totalGuests}`,
    action: 'Chase missing emails →',
    href: '/guest/directory',
  };
};

const NEWSLETTER_RULES: Rule[] = [
  ruleFailedSends,
  ruleHighUnsub,
  ruleNoScheduled,
  ruleLongSinceSend,
  ruleLowOpenRate,
  ruleContactableCoverage,
];

export function evaluateNewsletterRules(ctx: NewsletterContext): Insight[] {
  const out: Insight[] = [];
  for (const rule of NEWSLETTER_RULES) {
    try {
      const r = rule(ctx);
      if (!r) continue;
      if (Array.isArray(r)) out.push(...r); else out.push(r);
    } catch { /* skip */ }
  }
  return out;
}
