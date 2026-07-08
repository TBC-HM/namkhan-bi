// app/guest/page.tsx
// PBS 2026-07-06 v3: dept renamed Contacts. Old chip/attn/docs content restored
// at the top. Conclusion boxes (SIGNALS + OBSERVATIONS) moved BELOW.
// All 4 rule sets (retention · reputation · newsletter · observations) still fire.

import TenantLink from '@/components/nav/TenantLink';
import { DashboardPage, Container, type DashboardTab } from '@/app/(cockpit)/_design';
import ConclusionBlock, { type Insight } from '@/app/_components/ConclusionBlock';
import { evaluateRetentionRules, type RetentionContext } from '@/lib/rules/retention';
import { evaluateObservations, type ObservationContext } from '@/lib/rules/observations';
import { evaluateReputationRules, type ReputationContext } from '@/lib/rules/reputation';
import { evaluateNewsletterRules, type NewsletterContext } from '@/lib/rules/newsletter';
import { GUEST_SUBPAGES } from './_subpages';
import { DEPT_CFG } from '@/lib/dept-cfg';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { PROPERTY_ID, supabase } from '@/lib/supabase';
import ReportBuilder from '@/app/revenue/_components/ReportBuilder';
// PBS 2026-07-08: mirror Revenue HoD blocks onto /guest
import HodTasksList from '@/app/revenue/_components/HodTasksList';
import ShortcutsPanel, { type Shortcut } from '@/app/revenue/_components/ShortcutsPanel';
import ExternalLinksPanel, { type ExternalLink } from '@/app/revenue/_components/ExternalLinksPanel';
import {
  ScheduledReportsTable, SendLogTable,
  type ScheduledRow, type SendLogRow,
} from '@/app/revenue/_components/RevenueReportsTables';

const GUEST_USER_EMAIL = 'pbsbase@gmail.com';

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
    const cfg = DEPT_CFG.guest;
    const tabs: DashboardTab[] = cfg.subPages.map((s) => ({
      key: s.href, label: s.label, href: s.href, active: s.href === '/guest',
    }));
    const msg = e instanceof Error ? e.message : String(e);
    return (
      <DashboardPage title="Contacts · HoD" subtitle="Rules failed to load — details below." tabs={tabs}>
        <div style={{ gridColumn: '1 / -1' }}>
          <div style={{ padding: '14px 16px', background: '#FFF3F1', border: '1px solid #E6C9BF', borderRadius: 6, fontSize: 12, color: '#B04A2F', fontFamily: 'monospace', whiteSpace: 'pre-wrap' }}>{msg}</div>
        </div>
      </DashboardPage>
    );
  }
}

async function renderHodBody() {
  const sb = getSupabaseAdmin();
  const cfg = DEPT_CFG.guest;
  const reportTypes = cfg.reportTypes ?? [];
  const windowDays = 180;
  const todayMs = Date.now();
  const sinceIso = new Date(todayMs - windowDays * 86_400_000).toISOString().slice(0, 10);
  const since30dDate = new Date(todayMs - 30 * 86_400_000).toISOString().slice(0, 10);
  const since30dIso = new Date(todayMs - 30 * 86_400_000).toISOString();
  const since90dIso = new Date(todayMs - 90 * 86_400_000).toISOString().slice(0, 10);

  // PBS 2026-07-08 mirror: fetch scheduled + sends + shortcuts alongside the
  // existing guest signals so we can render the same top row + bottom tables
  // as Revenue HoD without duplicating a shared component in this file.
  const [dueTasksRes, scheduledRes, sendsRes, myReportsRes, shortcutsRes] = await Promise.all([
    supabase.from('v_hod_tasks_due').select('id', { count: 'exact', head: true })
      .eq('dept_slug', 'guest').eq('property_id', PROPERTY_ID).eq('is_due', true),
    supabase.from('v_revenue_report_recipients')
      .select('id, property_id, template_key, cadence, email, name, next_fire_at, created_at')
      .eq('property_id', PROPERTY_ID).order('next_fire_at', { ascending: true }).limit(500),
    supabase.from('v_revenue_report_sends')
      .select('id, property_id, template_key, sent_at, recipient_email, created_by, report_name, status')
      .eq('property_id', PROPERTY_ID).limit(200),
    supabase.from('v_revenue_report_sends')
      .select('id, property_id, template_key, sent_at, recipient_email, created_by, report_name, status')
      .eq('property_id', PROPERTY_ID).eq('recipient_email', GUEST_USER_EMAIL)
      .order('sent_at', { ascending: false }).limit(20),
    supabase.from('v_hod_shortcuts').select('id, label, href, kind')
      .eq('property_id', PROPERTY_ID).eq('dept_slug', 'guest').eq('user_email', GUEST_USER_EMAIL)
      .order('sort_order').limit(100),
  ]);
  const dueTasksCount = dueTasksRes.count ?? 0;
  const scheduledRows = (scheduledRes.data ?? []) as ScheduledRow[];
  const sendLogRows   = (sendsRes.data   ?? []) as SendLogRow[];
  const myReportRows  = (myReportsRes.data ?? []) as SendLogRow[];
  const allShortcuts  = (shortcutsRes.data ?? []) as Array<Shortcut & { kind?: string }>;
  const shortcuts     = allShortcuts.filter((s) => (s.kind ?? 'internal') === 'internal');
  const externalLinks = allShortcuts.filter((s) => s.kind === 'external') as ExternalLink[];
  const reportOptions = [
    { value: 'daily',   label: 'Daily report' },
    { value: 'weekly',  label: 'Weekly report' },
    { value: 'monthly', label: 'Monthly report' },
    ...(DEPT_CFG.guest.reportTypes ?? []).map((rt) => ({ value: rt.value, label: rt.label })),
  ];

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
  const profiles = pick(0) as ProfileRow[];
  const res      = pick(1) as ResRow[];
  const dir      = pick(2) as DirRow[];
  const recips   = pick(3) as RecipientRow[];
  const reviews  = pick(4) as ReviewRow[];
  const camps    = pick(5) as CampaignRow[];

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
    scheduledCount, draftsCount, daysSinceLastSend,
    sends30d: 0, sent30d: sent30, unsub30d: unsub30, opens30d: opens30, openRate30d,
    unsubRate30d, contactableGuests, totalGuests,
    failedSends24h: 0,
  };

  const signals: Insight[] = [
    ...evaluateRetentionRules(retentionCtx),
    ...evaluateReputationRules(reputationCtx),
    ...evaluateNewsletterRules(newsletterCtx),
  ];
  const observations: Insight[] = evaluateObservations(observationCtx);

  const tabs: DashboardTab[] = cfg.subPages.map((s) => ({
    key: s.href, label: s.label, href: s.href, active: s.href === '/guest',
  }));

  const attn = cfg.defaultAttn ?? [];
  const docs = cfg.defaultDocs ?? [];
  const chips = cfg.quickChips ?? [];
  const severityTone: Record<string, string> = { high: '#B03826', medium: '#8B5A1C', low: '#1F5C2C' };

  return (
    <DashboardPage
      title="Contacts · HoD"
      subtitle={cfg.hodTagline}
      tabs={tabs}
    >
      {/* PBS 2026-07-07: chip cluster removed (duplicated the top strip). */}

      {/* PBS 2026-07-08 mirror: same 4-container row as /revenue HoD. */}
      <div style={{ gridColumn: '1 / -1', display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 10 }}>
        <Container title="Shortcuts" subtitle="Pin any Contacts page · × to remove" density="compact">
          <ShortcutsPanel initial={shortcuts} propertyId={PROPERTY_ID} deptSlug="guest" userEmail={GUEST_USER_EMAIL} />
        </Container>
        <Container title="My Reports" subtitle={`${myReportRows.length} report${myReportRows.length === 1 ? '' : 's'} sent to you · from send log`} density="compact">
          {myReportRows.length === 0 ? (
            <div style={{ fontSize: 11, color: '#5A5A5A', fontStyle: 'italic', padding: '8px 4px' }}>
              No reports have been sent to you yet. Add yourself as a recipient below.
            </div>
          ) : (
            <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 4 }}>
              {myReportRows.map((r) => (
                <li key={r.id} style={{ fontSize: 11, color: '#1B1B1B', display: 'flex', gap: 6, alignItems: 'baseline' }}>
                  <span style={{ fontWeight: 600 }}>{r.report_name}</span>
                  <span style={{ color: '#5A5A5A' }}>· {new Date(r.sent_at).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
                </li>
              ))}
            </ul>
          )}
        </Container>
        <Container title="My Tasks" subtitle={dueTasksCount > 0 ? `🔴 ${dueTasksCount} due · add / due-date / repeat / delete` : 'add / due-date / repeat / delete · per property'} density="compact">
          <HodTasksList deptSlug="guest" propertyId={PROPERTY_ID} />
        </Container>
        <Container title="External links" subtitle="Cloudbeds guest inbox · Google Business · anywhere outside" density="compact">
          <ExternalLinksPanel initial={externalLinks} propertyId={PROPERTY_ID} deptSlug="guest" userEmail={GUEST_USER_EMAIL} />
        </Container>
      </div>

      {/* CONCLUSIONS BELOW old content — PBS 2026-07-06 evening */}
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

      {/* PBS 2026-07-07 night: Build-a-report primitive (parity with every other HoD). */}
      {reportTypes.length > 0 && (
        <div style={{ gridColumn: '1 / -1' }}>
          <Container title="Build a report" subtitle="pick a type · narrow with chips · open print-ready render" density="compact">
            <ReportBuilder reportTypes={reportTypes} hrefPrefix="" />
          </Container>
        </div>
      )}

      <div style={{ gridColumn: '1 / -1' }}>
        <div style={{ padding: '10px 14px', background: '#FAFAF7', border: '1px dashed #E6DFCC', borderRadius: 4, fontSize: 11, color: '#5A5A5A', lineHeight: 1.55 }}>
          <strong>Guardrails:</strong> Signals tagged <code>DYNAMIC</code> use rolling baselines (LY repeat, 12-month cancel, all-time rating).
          Fixed targets currently: repeat ≥ 25% · cancel ≤ 15% · pre-stay reach ≥ 80% · response rate ≥ 80% · unsub ≤ 0.5%.
          Dismiss with a reason (helps fine-tune the thresholds). No AI, no LLM — just data + operator judgement.
        </div>
      </div>

      {/* PBS 2026-07-08 mirror: Scheduled reports + Send log at the bottom */}
      <div style={{ gridColumn: '1 / -1' }}>
        <Container title="Scheduled reports"
                   subtitle="Pick any report · pick a cadence · fires at 08:00 UTC · Preview per row · check + Dismiss to cancel"
                   density="compact">
          <ScheduledReportsTable
            rows={scheduledRows}
            propertyId={PROPERTY_ID}
            reportOptions={reportOptions}
          />
        </Container>
      </div>

      <div style={{ gridColumn: '1 / -1' }}>
        <Container title="Reports · send log"
                   subtitle="Every report ever sent · sort any column · bulk-delete with checkboxes"
                   density="compact">
          <SendLogTable rows={sendLogRows} />
        </Container>
      </div>
    </DashboardPage>
  );
}

const chipStyle: React.CSSProperties = {
  padding: '5px 12px', background: '#FFFFFF', color: '#1B1B1B', border: '1px solid #E6DFCC',
  borderRadius: 99, fontSize: 11, textDecoration: 'none', whiteSpace: 'nowrap',
};
const rowStyle: React.CSSProperties = {
  display: 'flex', alignItems: 'flex-start', gap: 6, padding: '4px 0',
  fontSize: 12, color: '#1B1B1B', lineHeight: 1.5,
};
const linkStyle: React.CSSProperties = {
  color: '#1F3A2E', textDecoration: 'underline', textDecorationColor: '#C79A6B', marginRight: 4,
};
const emptyStyle: React.CSSProperties = {
  padding: '10px 8px', fontSize: 12, color: '#5A5A5A', fontStyle: 'italic',
};
const ulReset: React.CSSProperties = {
  margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 4,
};
