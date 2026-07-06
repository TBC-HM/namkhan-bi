// lib/rules/observations.ts
// PBS 2026-07-06: Data-quality observations for the Behaviour cockpit's right column.
// Not the same as "conclusions" — these tell you the numbers upstream are lying.
// Each observation renders in the ConclusionBlock as priority='observation' (grey dot).

import type { Insight } from '@/app/_components/ConclusionBlock';

export interface ObservationContext {
  totalGuests: number;
  guestsNoEmail: number;
  guestsNoCountry: number;
  otaReservations30d: number;
  otaReservations30dNoEmail: number;
  reservationsNoSource: number;
  reservationsWindowDays: number;
  reservationsTotal: number;
  duplicateEmails: number;                 // count of email addresses appearing 2+ times
  guestsMissingSpendFlags: number;         // stays_count>=1 but ALL spent_* NULL
  reviewsWithoutBody: number;              // scraped reviews with no body text
  reviewsTotal: number;
}

type Rule = (ctx: ObservationContext) => Insight | Insight[] | null;

// ─── Contact hygiene ────────────────────────────────────────────────────────
const obsGuestsMissingEmail: Rule = (ctx) => {
  if (ctx.totalGuests < 20) return null;
  const pct = (ctx.guestsNoEmail / ctx.totalGuests) * 100;
  if (pct < 5) return null;
  return {
    key: 'obs_missing_email',
    priority: 'observation',
    guardrail: 'dynamic',
    title: `${ctx.guestsNoEmail} guests have no email on file (${pct.toFixed(0)}%)`,
    body: 'These guests can\'t be reached by newsletter, Anticipation, or Gratitude. Silent leakage on every touchpoint.',
    evidence: `${ctx.guestsNoEmail} of ${ctx.totalGuests} · ${pct.toFixed(1)}%`,
    action: 'See list → hydrate emails',
    insightKey: 'no_email',
  };
};

const obsOtaReservationsNoEmail: Rule = (ctx) => {
  if (ctx.otaReservations30d < 10) return null;
  const share = (ctx.otaReservations30dNoEmail / ctx.otaReservations30d) * 100;
  if (share < 10) return null;
  return {
    key: 'obs_ota_no_email',
    priority: 'observation',
    guardrail: 'fixed',
    title: `${ctx.otaReservations30dNoEmail} OTA reservations in last 30d without a real email (${share.toFixed(0)}%)`,
    body: 'OTAs strip real emails behind masked addresses. Without a real email, no post-stay retention loop can fire on these guests.',
    evidence: `${ctx.otaReservations30dNoEmail} / ${ctx.otaReservations30d} last 30d`,
    action: 'See list → request emails',
    insightKey: 'ota_no_email',
  };
};

// ─── Country / segmentation hygiene ─────────────────────────────────────────
const obsGuestsNoCountry: Rule = (ctx) => {
  if (ctx.totalGuests < 20) return null;
  const pct = (ctx.guestsNoCountry / ctx.totalGuests) * 100;
  if (pct < 10) return null;
  return {
    key: 'obs_no_country',
    priority: 'observation',
    guardrail: 'dynamic',
    title: `${ctx.guestsNoCountry} guests have no country (${pct.toFixed(0)}%)`,
    body: 'Segmentation by geography is degraded — any country breakdown you see under-represents these guests.',
    evidence: `${ctx.guestsNoCountry} of ${ctx.totalGuests}`,
    action: 'See list → hydrate countries',
    insightKey: 'no_country',
  };
};

// ─── Reservation hygiene ─────────────────────────────────────────────────────
const obsReservationsNoSource: Rule = (ctx) => {
  if (ctx.reservationsTotal < 20) return null;
  const share = (ctx.reservationsNoSource / ctx.reservationsTotal) * 100;
  if (share < 5) return null;
  return {
    key: 'obs_no_source',
    priority: 'observation',
    guardrail: 'dynamic',
    title: `${ctx.reservationsNoSource} reservations in last ${ctx.reservationsWindowDays}d without source_name (${share.toFixed(0)}%)`,
    body: 'Channel attribution can\'t include these — commission/margin analysis is soft under-weighted for direct.',
    evidence: `${ctx.reservationsNoSource} / ${ctx.reservationsTotal}`,
    action: 'Investigate channels →',
    href: '/revenue/channels',
  };
};

// ─── Duplicates ──────────────────────────────────────────────────────────────
const obsDuplicateEmails: Rule = (ctx) => {
  if (ctx.duplicateEmails < 3) return null;
  return {
    key: 'obs_dup_emails',
    priority: 'observation',
    guardrail: 'fixed',
    title: `${ctx.duplicateEmails} email addresses appear on multiple guest profiles`,
    body: 'Same person, two profile rows — LTV is split, retention rules undercount them. Directory-side dedup should merge.',
    evidence: 'From guest.mv_guest_profile aggregation',
    action: 'See duplicates → merge',
    insightKey: 'dup_emails',
  };
};

// ─── Spend / folio hygiene ──────────────────────────────────────────────────
const obsMissingSpendFlags: Rule = (ctx) => {
  if (ctx.guestsMissingSpendFlags < 20) return null;
  return {
    key: 'obs_missing_spend',
    priority: 'observation',
    guardrail: 'fixed',
    title: `${ctx.guestsMissingSpendFlags} stayed guests have no spend flags set at all`,
    body: 'Either the folio hasn\'t been classified into outlets, or these guests genuinely bought nothing on-site. Second dimension analysis will be blank for them.',
    evidence: 'spent_restaurant / _spa / _activities / _retail all NULL',
    action: 'Trigger folio reclassify →',
    href: '/operations/restaurant',
  };
};

// ─── Review content ─────────────────────────────────────────────────────────
const obsReviewsNoBody: Rule = (ctx) => {
  if (ctx.reviewsTotal < 20) return null;
  const share = (ctx.reviewsWithoutBody / ctx.reviewsTotal) * 100;
  if (share < 15) return null;
  return {
    key: 'obs_reviews_no_body',
    priority: 'observation',
    guardrail: 'dynamic',
    title: `${ctx.reviewsWithoutBody} of ${ctx.reviewsTotal} scraped reviews have no body`,
    body: 'The scraper caught the rating but not the text — sentiment word cloud + management report use only a fraction of what\'s on-platform.',
    evidence: `${share.toFixed(0)}% of scraped rows`,
    action: 'Re-run scrape →',
    href: '/guest/reputation',
  };
};

const OBSERVATIONS: Rule[] = [
  obsGuestsMissingEmail,
  obsOtaReservationsNoEmail,
  obsGuestsNoCountry,
  obsReservationsNoSource,
  obsDuplicateEmails,
  obsMissingSpendFlags,
  obsReviewsNoBody,
];

export function evaluateObservations(ctx: ObservationContext): Insight[] {
  const out: Insight[] = [];
  for (const r of OBSERVATIONS) {
    try {
      const res = r(ctx);
      if (!res) continue;
      if (Array.isArray(res)) out.push(...res);
      else out.push(res);
    } catch { /* one bad rule shouldn't nuke the block */ }
  }
  return out;
}
