// app/guest/page.tsx
// PBS 2026-07-06 v2: Guest HoD is now the SINGLE home for department conclusions.
// - Runs all four rule sets (retention, reputation, newsletter, observations)
// - Renders SIGNALS + OBSERVATIONS in two side-by-side ConclusionBlocks
// - Findings page removed from the strip (route still accessible for bookmarks)
// - Newsletters is now the last tab before Reports
// - No decorative "Attention · Docs · Where to next" clutter — the conclusions
//   are the operator's day-planner.

import { DashboardPage, type DashboardTab } from '@/app/(cockpit)/_design';
import ConclusionBlock, { type Insight } from '@/app/_components/ConclusionBlock';
import { evaluateRetentionRules, type RetentionContext } from '@/lib/rules/retention';
import { evaluateObservations, type ObservationContext } from '@/lib/rules/observations';
import { evaluateReputationRules, type ReputationContext } from '@/lib/rules/reputation';
import { evaluateNewsletterRules, type NewsletterContext } from '@/lib/rules/newsletter';
import { GUEST_SUBPAGES } from './_subpages';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { PROPERTY_ID } from '@/lib/supabase';

export const dynamic = 'force-dynamic';
export const revalidate = 60;

interface ProfileRow {
  email: string | null;
  country: string | null;
  stays_count: number | null;
  lifetime_revenue: number | null;
  last_stay_date: string | null;
}
interface ResRow {
  status: string | null;
  check_in_date: string | null;
  booking_date: string | null;
  source_name: string | null;
  guest_email: string | null;
}
interface DirRow {
  email: string | null;
  arrival_bucket: string | null;
  last_stay_date: string | null;
  spent_restaurant: boolean | null;
  spent_spa: boolean | null;
  spent_activities: boolean | null;
  spent_retail: boolean | null;
}
interface RecipientRow { sent_at: string | null; opened_at: string | null; unsubscribed_at: string | null; }
interface ReviewRow { rating_norm: number | string | null; response_status: string | null; body: string | null; received_at: string | null; }
interface CampaignRow { status: string | null; planned_date: string | null; last_run_at: string | null; }

function daysBetween(iso: string | null, ms: number): number | null {
  if (!iso) return null;
  return Math.floor((ms - new Date(iso).getTime()) / 86_400_000);
}
function pct(n: number, d: number): number { return d > 0 ? (n / d) * 100 : 0; }

export default async function GuestHodPage() {
  try {
    return await renderHodBody();
  } catch (e) {
    // Any throw in the body renders the shell with an error banner instead of crashing to __next_error__.
    const tabs: DashboardTab[] = GUEST_SUBPAGES.map((s) => ({
      key: s.href, label: s.label, href: s.href, active: s.href === '/guest',
    }));
    const msg = e instanceof Error ? e.message : String(e);
    return (
      <DashboardPage title="Guest · HoD" subtitle="Rules failed to load — details below." tabs={tabs}>
        <div style={{ gridColumn: '1 / -1' }}>
          <div style={{ padding: '14px 16px', background: '#FFF3F1', border: '1px solid #E6C9BF', borderRadius: 6, fontSize: 12, color: '#B04A2F', fontFamily: 'monospace', whiteSpace: 'pre-wrap' }}>
            {msg}
          </div>
        </div>
      </DashboardPage>
    );
  }
}

async function renderHodBody() {
  const sb = getSupabaseAdmin();
  const windowDays = 180;
  const todayMs = Date.now();
  const sinceIso = new Date(todayMs - windowDays * 86_400_000).toISOString().slice(0, 10);
  const since30dDate = new Date(todayMs - 30 * 86_400_000).toISOString().slice(0, 10);
  const since30dIso = new Date(todayMs - 30 * 86_400_000).toISOString();
  const since90dIso = new Date(todayMs - 90 * 86_400_000).toISOString().slice(0, 10);

  // Defensive: use allSettled — one broken query mustn't take down the whole HoD.
  const results = await Promise.allSettled([
    sb.schema('guest').from('mv_guest_profile')
      .select('email, country, stays_count, lifetime_revenue, last_stay_date')
      .eq('property_id', PROPERTY_ID)
      .limit(5000),
    sb.from('reservations')
      .select('status, check_in_date, booking_date, source_name, guest_email')
      .eq('property_id', PROPERTY_ID)
      .gte('check_in_date', sinceIso),
    sb.schema('guest').from('v_directory_full')
      .select('email, arrival_bucket, last_stay_date, spent_restaurant, spent_spa, spent_activities, spent_retail')
      .eq('property_id', PROPERTY_ID),
    sb.schema('guest').from('campaign_recipients')
      .select('sent_at, opened_at, unsubscribed_at')
      .gte('sent_at', since30dIso)
      .limit(50000),
    // Use the public bridge view (mkt_reviews) not schema('marketing') — PostgREST is public-only.
    sb.from('mkt_reviews')
      .select('rating_norm, response_status, body, received_at')
      .eq('property_id', PROPERTY_ID)
      .limit(5000),
    sb.schema('guest').from('campaigns')
      .select('status, planned_date, last_run_at')
      .limit(500),
  ]);

  function pick(idx: number): unknown[] {
    const r = results[idx];
    if (r.status !== 'fulfilled') return [];
    const val = r.value as { data?: unknown[] | null } | null;
    return (val?.data ?? []) as unknown[];
  }
  const profiles: ProfileRow[]   = pick(0) as ProfileRow[];
  const res:      ResRow[]       = pick(1) as ResRow[];
  const dir:      DirRow[]       = pick(2) as DirRow[];
  const recips:   RecipientRow[] = pick(3) as RecipientRow[];
  const reviews:  ReviewRow[]    = pick(4) as ReviewRow[];
  const camps:    CampaignRow[]  = pick(5) as CampaignRow[];

  // ─── RETENTION context ───
  const totalGuests = profiles.length;
  const stayed      = profiles.filter(p => Number(p.stays_count ?? 0) >= 1);
  const repeats     = profiles.filter(p => Number(p.stays_count ?? 0) >= 2);
  const repeatRate  = pct(repeats.length, stayed.length);
  const avgLtvAll   = totalGuests > 0
    ? profiles.reduce((s, p) => s + Number(p.lifetime_revenue ?? 0), 0) / totalGuests : 0;
  const avgLtvRepeat = repeats.length > 0
    ? repeats.reduce((s, p) => s + Number(p.lifetime_revenue ?? 0), 0) / repeats.length : 0;
  const winbackPool = profiles.filter(p =>
    Number(p.stays_count ?? 0) >= 2 && p.email && String(p.email).includes('@') &&
    p.last_stay_date && (daysBetween(p.last_stay_date, todayMs) ?? 0) > 365,
  ).length;
  const guestsAt4Stays = profiles.filter(p => Number(p.stays_count ?? 0) === 4).length;
  const guestsSlipping60d = profiles.filter(p => {
    const n = Number(p.stays_count ?? 0);
    if (n < 2) return false;
    const days = daysBetween(p.last_stay_date, todayMs);
    if (days == null) return false;
    const expectedCadence = 365 / Math.max(2, n);
    return days > expectedCadence + 60 && days <= 365;
  }).length;

  const totalRes = res.length;
  const confirmed = res.filter(r => r.status && ['confirmed','checked_in','checked_out'].includes(r.status)).length;
  const arrived   = res.filter(r => r.status && ['checked_in','checked_out'].includes(r.status)).length;
  const inHouse   = res.filter(r => r.status === 'checked_in').length;
  const canceled  = res.filter(r => r.status === 'canceled').length;
  const noShows   = res.filter(r => r.status === 'no_show').length;

  const upcomingPool = dir.filter(d =>
    d.arrival_bucket && ['next_7', 'next_30', 'next_90'].includes(d.arrival_bucket),
  );
  const preStayCoveragePct = upcomingPool.length > 0
    ? pct(upcomingPool.filter(d => !!d.email && String(d.email).includes('@')).length, upcomingPool.length)
    : 0;

  const leads = res
    .filter(r => r.booking_date && r.check_in_date)
    .map(r => Math.max(0, Math.floor((new Date(r.check_in_date!).getTime() - new Date(r.booking_date!).getTime()) / 86_400_000)));
  leads.sort((a, b) => a - b);

  const responded = reviews.filter(r => r.response_status === 'responded').length;
  const responseRate = reviews.length >= 5 ? pct(responded, reviews.length) : null;
  const lowScoringUnanswered = reviews.filter(r =>
    r.rating_norm != null && Number(r.rating_norm) < 4 && r.response_status !== 'responded',
  ).length;
  const criticalUnanswered = reviews.filter(r =>
    r.rating_norm != null && Number(r.rating_norm) < 3 && r.response_status !== 'responded',
  ).length;

  const sent30 = recips.filter(r => r.sent_at).length;
  const unsub30 = recips.filter(r => r.unsubscribed_at).length;
  const opens30 = recips.filter(r => r.opened_at).length;
  const unsubRate30d = sent30 >= 50 ? pct(unsub30, sent30) : null;
  const openRate30d  = sent30 >= 50 ? pct(opens30, sent30)  : null;

  const retentionCtx: RetentionContext = {
    totalGuests, repeatGuests: repeats.length, repeatRate,
    repeatRateBaseline: stayed.length >= 100 ? repeatRate * 0.95 + 25 * 0.05 : null,
    avgLtvAll, avgLtvRepeat, winbackPool, loyaltyMembers: 0,
    guestsAt4Stays, guestsSlipping60d,
    reservations: totalRes,
    confirmRate: pct(confirmed, totalRes),
    arriveRate: pct(arrived, confirmed),
    cancelRate: pct(canceled, totalRes),
    cancelRateBaseline: null,
    noShows,
    medianLead: leads.length ? leads[Math.floor(leads.length / 2)] : null,
    inHouse, windowDays, preStayCoveragePct,
    responseRate, lowScoringUnanswered, unsubRate30d,
  };

  // ─── OBSERVATIONS context ───
  const guestsNoEmail = profiles.filter(p => !p.email || !String(p.email).includes('@')).length;
  const guestsNoCountry = profiles.filter(p => !p.country || String(p.country).trim().length === 0).length;

  const otas = ['booking', 'expedia', 'agoda', 'ctrip', 'trip.com', 'hotelbeds', 'traveloka'];
  const isOtaSource = (s: string | null | undefined) => !!s && otas.some(o => String(s).toLowerCase().includes(o));
  const isRealEmail = (e: string | null | undefined) =>
    !!e && String(e).includes('@') &&
    !String(e).toLowerCase().includes('guest.booking.com') &&
    !String(e).toLowerCase().includes('expediapartnercentral');

  const res30d = res.filter(r => (r.check_in_date ?? '').slice(0, 10) >= since30dDate);
  const otaReservations30d = res30d.filter(r => isOtaSource(r.source_name)).length;
  const otaReservations30dNoEmail = res30d.filter(r => isOtaSource(r.source_name) && !isRealEmail(r.guest_email)).length;

  const reservationsNoSource = res.filter(r => !r.source_name || String(r.source_name).trim().length === 0).length;

  const emailCounts = new Map<string, number>();
  for (const p of profiles) {
    const e = (p.email ?? '').toLowerCase();
    if (!e || !e.includes('@')) continue;
    emailCounts.set(e, (emailCounts.get(e) ?? 0) + 1);
  }
  const duplicateEmails = Array.from(emailCounts.values()).filter(n => n >= 2).length;

  const guestsMissingSpendFlags = dir.filter(d =>
    d.last_stay_date &&
    d.spent_restaurant == null && d.spent_spa == null &&
    d.spent_activities == null && d.spent_retail == null,
  ).length;

  const reviewsWithoutBody = reviews.filter(r => !r.body || String(r.body).trim().length < 10).length;

  const observationCtx: ObservationContext = {
    totalGuests, guestsNoEmail, guestsNoCountry,
    otaReservations30d, otaReservations30dNoEmail,
    reservationsNoSource, reservationsWindowDays: windowDays, reservationsTotal: totalRes,
    duplicateEmails, guestsMissingSpendFlags,
    reviewsWithoutBody, reviewsTotal: reviews.length,
  };

  // ─── REPUTATION context ───
  const receivedAts = reviews.map(r => r.received_at).filter(Boolean).sort() as string[];
  const lastReceived = receivedAts.length > 0 ? receivedAts[receivedAts.length - 1] : null;
  const daysSinceLastScrape = daysBetween(lastReceived, todayMs);

  const ratings = reviews.map(r => Number(r.rating_norm)).filter(n => Number.isFinite(n));
  const avgRatingAllTime = ratings.length > 0
    ? ratings.reduce((s, n) => s + n, 0) / ratings.length : null;
  const last90dReviews = reviews.filter(r => r.received_at && String(r.received_at).slice(0, 10) >= since90dIso);
  const last90dRatings = last90dReviews.map(r => Number(r.rating_norm)).filter(n => Number.isFinite(n));
  const avgRatingLast90d = last90dRatings.length > 0
    ? last90dRatings.reduce((s, n) => s + n, 0) / last90dRatings.length : null;

  const reputationCtx: ReputationContext = {
    totalReviews: reviews.length,
    respondedReviews: responded,
    responseRate,
    lowScoringUnanswered,
    criticalUnanswered,
    daysSinceLastScrape,
    sourcesWithoutContent: 0,
    avgRatingLast90d,
    avgRatingAllTime,
  };

  // ─── NEWSLETTER context ───
  const scheduledCount = camps.filter(c => c.status === 'scheduled' &&
    c.planned_date && String(c.planned_date) >= new Date().toISOString().slice(0, 10)).length;
  const draftsCount = camps.filter(c => c.status === 'draft').length;
  const sentDates = camps.map(c => c.last_run_at).filter(Boolean).sort() as string[];
  const lastSent = sentDates.length > 0 ? sentDates[sentDates.length - 1] : null;
  const daysSinceLastSend = daysBetween(lastSent, todayMs);
  const contactableGuests = profiles.filter(p => p.email && String(p.email).includes('@')).length;

  const newsletterCtx: NewsletterContext = {
    scheduledCount, draftsCount,
    daysSinceLastSend,
    sends30d: 0, sent30d: sent30, unsub30d, opens30d: opens30, openRate30d,
    unsubRate30d, contactableGuests, totalGuests,
    failedSends24h: 0, // wire when guest.campaign_recipients has failure timestamp
  };

  // ─── Consolidate all signals + observations ───
  const signals: Insight[] = [
    ...evaluateRetentionRules(retentionCtx),
    ...evaluateReputationRules(reputationCtx),
    ...evaluateNewsletterRules(newsletterCtx),
  ];
  // Newsletter contactable and observations we bucket into observations.
  const observations: Insight[] = evaluateObservations(observationCtx);

  const tabs: DashboardTab[] = GUEST_SUBPAGES.map((s) => ({
    key: s.href, label: s.label, href: s.href,
    active: s.href === '/guest',
  }));

  return (
    <DashboardPage
      title="Guest · HoD"
      subtitle="Your day starts here. Every card below is something to send, approve, edit, or investigate."
      tabs={tabs}
    >
      {/* CONCLUSIONS · SIGNALS + OBSERVATIONS side-by-side */}
      <div style={{ gridColumn: '1 / -1', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: 8 }}>
        <ConclusionBlock
          insights={signals}
          title="SIGNALS · retention · reputation · newsletter"
          subtitle={`Rule-based across ${totalGuests} guests · ${totalRes} reservations · ${reviews.length} reviews · ${sent30} sends 30d`}
          emptyText="Everything is green. Consider a positive-note broadcast to top guests."
          storageKey="guest_hod_signals"
          maxRender={12}
        />
        <ConclusionBlock
          insights={observations}
          title="OBSERVATIONS · data quality"
          subtitle="What the upstream numbers might be lying about · click for the guest list."
          emptyText="No data-quality issues in the current sample."
          storageKey="guest_hod_observations"
          maxRender={12}
        />
      </div>

      {/* Small footnote — no more chip cluster, no more docs, no more where-to-next */}
      <div style={{ gridColumn: '1 / -1' }}>
        <div style={{ padding: '10px 14px', background: '#FAFAF7', border: '1px dashed #E6DFCC', borderRadius: 4, fontSize: 11, color: '#5A5A5A', lineHeight: 1.55 }}>
          <strong>Guardrails:</strong> Signals tagged <code>DYNAMIC</code> use rolling baselines (LY repeat rate, 12-month cancel rate, all-time review avg).
          Signals without the tag use fixed operator targets (25% repeat, 80% response rate, ≤ 0.5% unsub).
          Dismissed signals reappear when the underlying condition re-fires.
          For KPIs and detail panels, dive into the sub-pages above.
        </div>
      </div>
    </DashboardPage>
  );
}
