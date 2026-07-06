// app/guest/behaviour/page.tsx
// PBS 2026-07-06: Retention manager cockpit. Merges /guest/loyalty + /guest/journey
// into ONE surface. Dynamic ConclusionBlock at top runs the "gold rules" registry
// (lib/rules/retention.ts) → shows operators what the data actually means + what to do.
//
// Reads:
//   guest.mv_guest_profile       (LTV, stays, is_repeat, last_stay_date)
//   guest.loyalty_members        (tier ladder)
//   public.reservations          (funnel, cancels, no-shows, lead time)
//   guest.v_directory_full       (contactability, in-stay engagement)
//   guest.journey_events         (touchpoint stages)
//   guest.campaign_recipients    (unsub rate, opens)
//   guest.unsubscribes           (opt-out set)
//   marketing.reviews            (response rate, low-scoring unanswered)

import { DashboardPage, KpiTile, type DashboardTab, type KpiTileProps } from '@/app/(cockpit)/_design';
import ConclusionBlock, { type Insight } from '@/app/_components/ConclusionBlock';
import { evaluateRetentionRules, type RetentionContext } from '@/lib/rules/retention';
import { GUEST_SUBPAGES } from '../_subpages';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { PROPERTY_ID } from '@/lib/supabase';

export const dynamic = 'force-dynamic';
export const revalidate = 60;

interface ProfileRow {
  guest_id: string;
  full_name: string | null;
  country: string | null;
  email: string | null;
  bookings_count: number | null;
  stays_count: number | null;
  lifetime_revenue: number | null;
  total_nights: number | null;
  avg_adr: number | null;
  first_stay_date: string | null;
  last_stay_date: string | null;
  is_repeat: boolean | null;
  top_source: string | null;
}
interface LoyaltyMemberRow {
  tier_label: string | null;
  joined_at: string | null;
}
interface ResRow {
  status: string | null;
  check_in_date: string | null;
  booking_date: string | null;
}
interface DirRow {
  email: string | null;
  phone: string | null;
  upcoming_stay_date: string | null;
  last_stay_date: string | null;
  arrival_bucket: string | null;
  spent_restaurant: boolean | null;
  spent_spa: boolean | null;
  spent_activities: boolean | null;
  spent_retail: boolean | null;
  newsletters_sent: number | null;
}
interface RecipientRow { email: string | null; sent_at: string | null; opened_at: string | null; unsubscribed_at: string | null; }
interface UnsubRow { email: string | null; }
interface ReviewRow { rating_norm: number | string | null; response_status: string | null; source: string | null; }

function daysBetween(iso: string | null, ms: number): number | null {
  if (!iso) return null;
  return Math.floor((ms - new Date(iso).getTime()) / 86_400_000);
}
function fmtNum(n: number): string { return Math.round(n).toLocaleString('en-US'); }

interface Props { searchParams: Record<string, string | string[] | undefined>; }

export default async function GuestBehaviourPage({ searchParams }: Props) {
  const daysParam = Array.isArray(searchParams.days) ? searchParams.days[0] : searchParams.days;
  const windowDays = Math.max(7, Math.min(365, Number(daysParam) || 180));
  const sinceIso = new Date(Date.now() - windowDays * 86_400_000).toISOString().slice(0, 10);
  const since30dIso = new Date(Date.now() - 30 * 86_400_000).toISOString();
  const since90dIso = new Date(Date.now() - 90 * 86_400_000).toISOString().slice(0, 10);
  const todayMs = Date.now();
  const todayIso = new Date().toISOString().slice(0, 10);

  const sb = getSupabaseAdmin();

  const [profilesR, membersR, resR, dirR, recipR, unsubR, reviewsR] = await Promise.all([
    sb.schema('guest').from('mv_guest_profile')
      .select('guest_id, full_name, country, email, bookings_count, stays_count, lifetime_revenue, total_nights, avg_adr, first_stay_date, last_stay_date, is_repeat, top_source')
      .eq('property_id', PROPERTY_ID)
      .order('lifetime_revenue', { ascending: false })
      .limit(5000),
    sb.schema('guest').from('loyalty_members').select('tier_label, joined_at').limit(2000),
    sb.from('reservations')
      .select('status, check_in_date, booking_date')
      .eq('property_id', PROPERTY_ID)
      .gte('check_in_date', sinceIso),
    sb.schema('guest').from('v_directory_full')
      .select('email, phone, upcoming_stay_date, last_stay_date, arrival_bucket, spent_restaurant, spent_spa, spent_activities, spent_retail, newsletters_sent')
      .eq('property_id', PROPERTY_ID),
    sb.schema('guest').from('campaign_recipients')
      .select('email, sent_at, opened_at, unsubscribed_at')
      .gte('sent_at', since30dIso)
      .limit(20000),
    sb.schema('guest').from('unsubscribes').select('email').eq('property_id', PROPERTY_ID),
    sb.schema('marketing').from('reviews')
      .select('rating_norm, response_status, source')
      .eq('property_id', PROPERTY_ID)
      .limit(5000),
  ]);

  const profiles: ProfileRow[] = (profilesR.data as ProfileRow[]) ?? [];
  const members:  LoyaltyMemberRow[] = (membersR.data as LoyaltyMemberRow[]) ?? [];
  const res:      ResRow[] = (resR.data as ResRow[]) ?? [];
  const dir:      DirRow[] = (dirR.data as DirRow[]) ?? [];
  const recips:   RecipientRow[] = (recipR.data as RecipientRow[]) ?? [];
  const unsubs:   UnsubRow[] = (unsubR.data as UnsubRow[]) ?? [];
  const reviews:  ReviewRow[] = (reviewsR.data as ReviewRow[]) ?? [];

  // ---------------------------------------------------------------------------
  // LOYALTY side
  // ---------------------------------------------------------------------------
  const totalGuests   = profiles.length;
  const stayedGuests  = profiles.filter(p => Number(p.stays_count ?? 0) >= 1);
  const repeatGuests  = profiles.filter(p => Number(p.stays_count ?? 0) >= 2);
  const repeatRate    = stayedGuests.length > 0 ? (repeatGuests.length / stayedGuests.length) * 100 : 0;

  const avgLtvAll = totalGuests > 0
    ? profiles.reduce((s, p) => s + Number(p.lifetime_revenue ?? 0), 0) / totalGuests
    : 0;
  const avgLtvRepeat = repeatGuests.length > 0
    ? repeatGuests.reduce((s, p) => s + Number(p.lifetime_revenue ?? 0), 0) / repeatGuests.length
    : 0;

  const winbackPool = profiles.filter(p =>
    Number(p.stays_count ?? 0) >= 2 &&
    p.email && String(p.email).includes('@') &&
    p.last_stay_date &&
    (daysBetween(p.last_stay_date, todayMs) ?? 0) > 365,
  ).length;

  const guestsAt4Stays = profiles.filter(p => Number(p.stays_count ?? 0) === 4).length;

  // "Slipping" repeats: their average cadence has been broken by 60+ days.
  // Cheap heuristic: repeat guest, >2 stays, days since last stay > (365 / stays_count) + 60.
  const guestsSlipping60d = profiles.filter(p => {
    const n = Number(p.stays_count ?? 0);
    if (n < 2) return null;
    const days = daysBetween(p.last_stay_date, todayMs);
    if (days == null) return false;
    const expectedCadence = 365 / Math.max(2, n);
    return days > expectedCadence + 60 && days <= 365; // >365 already counted in winback pool
  }).length;

  // ---------------------------------------------------------------------------
  // JOURNEY side
  // ---------------------------------------------------------------------------
  const totalRes = res.length;
  const confirmed = res.filter(r => r.status && ['confirmed','checked_in','checked_out'].includes(r.status)).length;
  const arrived   = res.filter(r => r.status && ['checked_in','checked_out'].includes(r.status)).length;
  const inHouse   = res.filter(r => r.status === 'checked_in').length;
  const canceled  = res.filter(r => r.status === 'canceled').length;
  const noShows   = res.filter(r => r.status === 'no_show').length;

  const confirmRate = totalRes > 0 ? (confirmed / totalRes) * 100 : 0;
  const arriveRate  = confirmed > 0 ? (arrived / confirmed) * 100 : 0;
  const cancelRate  = totalRes > 0 ? (canceled / totalRes) * 100 : 0;

  const leads = res
    .filter(r => r.booking_date && r.check_in_date)
    .map(r => Math.max(0, Math.floor(
      (new Date(r.check_in_date!).getTime() - new Date(r.booking_date!).getTime()) / 86_400_000,
    )));
  leads.sort((a, b) => a - b);
  const medianLead: number | null = leads.length ? leads[Math.floor(leads.length / 2)] : null;

  // Pre-stay reachability — for upcoming arrivals, share with a usable email on file.
  // (Direct proxy for pre-stay email coverage — the Anticipation template only fires with an email.)
  const upcomingPool = dir.filter(d =>
    d.arrival_bucket && ['next_7', 'next_30', 'next_90'].includes(d.arrival_bucket),
  );
  const preStayCoveragePct = upcomingPool.length > 0
    ? (upcomingPool.filter(d => !!d.email && String(d.email).includes('@')).length / upcomingPool.length) * 100
    : 0;

  // ---------------------------------------------------------------------------
  // MARKETING loop
  // ---------------------------------------------------------------------------
  const sent30 = recips.length;
  const unsub30 = recips.filter(r => r.unsubscribed_at).length;
  const unsubRate30d: number | null = sent30 >= 50 ? (unsub30 / sent30) * 100 : null;

  // ---------------------------------------------------------------------------
  // REPUTATION side
  // ---------------------------------------------------------------------------
  const reviewsWithRating = reviews.filter(r => r.rating_norm != null);
  const responded = reviews.filter(r => r.response_status === 'responded').length;
  const responseRate = reviews.length >= 5 ? (responded / reviews.length) * 100 : null;
  const lowScoringUnanswered = reviewsWithRating.filter(r =>
    Number(r.rating_norm) < 4 && r.response_status !== 'responded',
  ).length;

  // ---------------------------------------------------------------------------
  // Run the rules
  // ---------------------------------------------------------------------------
  const ctx: RetentionContext = {
    totalGuests,
    repeatGuests: repeatGuests.length,
    repeatRate,
    avgLtvAll,
    avgLtvRepeat,
    winbackPool,
    loyaltyMembers: members.length,
    guestsAt4Stays,
    guestsSlipping60d,
    reservations: totalRes,
    confirmRate,
    arriveRate,
    cancelRate,
    noShows,
    medianLead,
    inHouse,
    windowDays,
    preStayCoveragePct,
    responseRate,
    lowScoringUnanswered,
    unsubRate30d,
  };

  const insights: Insight[] = evaluateRetentionRules(ctx);

  // ---------------------------------------------------------------------------
  // Panels — retention curve, LTV cohorts, funnel, engagement grid
  // ---------------------------------------------------------------------------
  const retentionBuckets = [
    { label: '1 stay',   n: stayedGuests.filter(p => Number(p.stays_count) === 1).length, key: '1' },
    { label: '2 stays',  n: stayedGuests.filter(p => Number(p.stays_count) === 2).length, key: '2' },
    { label: '3 stays',  n: stayedGuests.filter(p => Number(p.stays_count) === 3).length, key: '3' },
    { label: '4 stays',  n: stayedGuests.filter(p => Number(p.stays_count) === 4).length, key: '4' },
    { label: '5+ stays', n: stayedGuests.filter(p => Number(p.stays_count) >= 5).length, key: '5+' },
  ];
  const retentionTotal = retentionBuckets.reduce((s, b) => s + b.n, 0);

  const ltvCohorts = [
    { label: '0–500',    n: 0 },
    { label: '500–1.5k', n: 0 },
    { label: '1.5k–5k',  n: 0 },
    { label: '5k+',      n: 0 },
  ];
  for (const p of profiles) {
    const v = Number(p.lifetime_revenue ?? 0);
    if      (v < 500)  ltvCohorts[0].n++;
    else if (v < 1500) ltvCohorts[1].n++;
    else if (v < 5000) ltvCohorts[2].n++;
    else               ltvCohorts[3].n++;
  }
  const ltvMax = Math.max(1, ...ltvCohorts.map(c => c.n));

  const funnel = [
    { label: 'Reservations', n: totalRes },
    { label: 'Confirmed',    n: confirmed },
    { label: 'Arrived',      n: arrived },
    { label: 'In-house',     n: inHouse },
  ];
  const funnelMax = Math.max(1, ...funnel.map(f => f.n));

  const recentStays = dir.filter(d => d.last_stay_date && d.last_stay_date >= since90dIso && d.last_stay_date <= todayIso);
  const recentTotal = recentStays.length;
  const engagement = [
    { label: 'Restaurant',  n: recentStays.filter(d => d.spent_restaurant).length },
    { label: 'Spa',         n: recentStays.filter(d => d.spent_spa).length },
    { label: 'Activities',  n: recentStays.filter(d => d.spent_activities).length },
    { label: 'Retail',      n: recentStays.filter(d => d.spent_retail).length },
  ];

  const tabs: DashboardTab[] = GUEST_SUBPAGES.map(s => ({
    key: s.href, label: s.label, href: s.href, active: s.href === '/guest/behaviour',
  }));

  const tiles: KpiTileProps[] = [
    { label: 'Total guests',    value: totalGuests,                       size: 'sm' },
    { label: 'Repeat rate',     value: Number(repeatRate.toFixed(1)),     size: 'sm', footnote: 'target ≥ 25%', status: repeatRate >= 25 ? 'green' : repeatRate >= 15 ? 'amber' : 'red' },
    { label: 'Avg LTV',         value: Math.round(avgLtvAll),             size: 'sm', footnote: 'all guests' },
    { label: 'Avg LTV · repeat',value: Math.round(avgLtvRepeat),          size: 'sm', footnote: '≥ 2 stays' },
    { label: 'Win-back pool',   value: winbackPool,                       size: 'sm', footnote: '> 1y · has email', status: winbackPool > 30 ? 'red' : winbackPool > 5 ? 'amber' : 'green' },
    { label: 'Reservations',    value: totalRes,                          size: 'sm', footnote: `${windowDays}d window` },
    { label: 'Cancel rate',     value: Number(cancelRate.toFixed(1)),     size: 'sm', status: cancelRate > 25 ? 'red' : cancelRate > 10 ? 'amber' : 'green' },
    { label: 'No-shows',        value: noShows,                           size: 'sm', status: noShows > 5 ? 'red' : noShows > 0 ? 'amber' : 'green' },
    { label: 'In-house now',    value: inHouse,                           size: 'sm' },
  ];

  const WHITE = '#FFFFFF';
  const HAIR  = '#E6DFCC';
  const INK   = '#1B1B1B';
  const INK_S = '#3A3A3A';
  const INK_M = '#5A5A5A';
  const GREEN = '#1F3A2E';
  const RED   = '#B03826';
  const AMBER = '#8B5A1C';

  const sectionH: React.CSSProperties = { fontSize: 11, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: INK_M, margin: '4px 2px 8px' };
  const cardBox: React.CSSProperties = { background: WHITE, border: '1px solid ' + HAIR, borderRadius: 6, padding: '14px 16px' };

  return (
    <div style={{ background: WHITE, minHeight: '100vh' }}>
      <DashboardPage
        title="Guest · Behaviour"
        subtitle="One page for the retention story — who came, who came back, what to do next."
        tabs={tabs}
      >
        {/* CONCLUSIONS at the very top — the "so what?" layer */}
        <div style={{ gridColumn: '1 / -1' }}>
          <ConclusionBlock
            insights={insights}
            title="CONCLUSIONS · RETENTION"
            subtitle={`Rule-based read across ${totalGuests} guest profiles · ${totalRes} reservations in last ${windowDays}d · ${reviews.length} reviews.`}
            emptyText="All retention signals are green — nothing to flag this cycle."
          />
        </div>

        {/* KPI STRIP */}
        <div style={{ gridColumn: '1 / -1', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 8 }}>
          {tiles.map((t, i) => <KpiTile key={i} {...t} />)}
        </div>

        {/* RETENTION CURVE + LTV COHORTS + FUNNEL */}
        <div style={{ gridColumn: '1 / -1', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 8 }}>
          <div style={cardBox}>
            <div style={{ fontSize: 12, fontWeight: 600, color: INK, marginBottom: 2 }}>Retention curve</div>
            <div style={{ fontSize: 11, color: INK_M, marginBottom: 12 }}>Guests by stay count · {fmtNum(retentionTotal)} total</div>
            {retentionTotal === 0 ? (
              <EmptyBox text="No stays yet." />
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {retentionBuckets.map(b => {
                  const pctVal = retentionTotal > 0 ? (b.n / retentionTotal) * 100 : 0;
                  return (
                    <div key={b.key} style={{ display: 'grid', gridTemplateColumns: '70px 1fr 90px', gap: 8, alignItems: 'center', fontSize: 11 }}>
                      <span style={{ color: INK_S }}>{b.label}</span>
                      <div style={{ position: 'relative', height: 14, background: '#FAF6EB', border: '1px solid ' + HAIR, borderRadius: 3 }}>
                        <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: pctVal + '%',
                          background: b.key === '1' ? '#B8AE93' : b.key === '2' ? GREEN : b.key === '5+' ? '#0F2A1E' : '#2D5941' }} />
                      </div>
                      <span style={{ textAlign: 'right', color: INK, fontVariantNumeric: 'tabular-nums' }}>{fmtNum(b.n)} · {pctVal.toFixed(1)}%</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div style={cardBox}>
            <div style={{ fontSize: 12, fontWeight: 600, color: INK, marginBottom: 2 }}>LTV cohorts</div>
            <div style={{ fontSize: 11, color: INK_M, marginBottom: 12 }}>Guests bucketed by lifetime revenue</div>
            {totalGuests === 0 ? <EmptyBox text="No profiles yet." /> : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {ltvCohorts.map((c, i) => {
                  const pctVal = totalGuests > 0 ? (c.n / totalGuests) * 100 : 0;
                  const barPct = (c.n / ltvMax) * 100;
                  return (
                    <div key={c.label} style={{ display: 'grid', gridTemplateColumns: '80px 1fr 90px', gap: 8, alignItems: 'center', fontSize: 11 }}>
                      <span style={{ color: INK_S }}>{c.label}</span>
                      <div style={{ position: 'relative', height: 14, background: '#FAF6EB', border: '1px solid ' + HAIR, borderRadius: 3 }}>
                        <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: barPct + '%',
                          background: i === 0 ? '#B8AE93' : i === 1 ? '#8FA37F' : i === 2 ? GREEN : '#0F2A1E' }} />
                      </div>
                      <span style={{ textAlign: 'right', color: INK, fontVariantNumeric: 'tabular-nums' }}>{fmtNum(c.n)} · {pctVal.toFixed(0)}%</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div style={cardBox}>
            <div style={{ fontSize: 12, fontWeight: 600, color: INK, marginBottom: 2 }}>Reservation funnel</div>
            <div style={{ fontSize: 11, color: INK_M, marginBottom: 12 }}>{windowDays}d window · confirm {confirmRate.toFixed(0)}% · arrive {arriveRate.toFixed(0)}%</div>
            {totalRes === 0 ? <EmptyBox text="No reservations in window." /> : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {funnel.map((f, i) => {
                  const pctVal = totalRes > 0 ? (f.n / totalRes) * 100 : 0;
                  const barPct = (f.n / funnelMax) * 100;
                  const prev = i > 0 ? funnel[i - 1].n : null;
                  const drop = prev != null && prev > 0 ? (f.n / prev) * 100 : null;
                  return (
                    <div key={f.label} style={{ display: 'grid', gridTemplateColumns: '80px 1fr 100px', gap: 8, alignItems: 'center', fontSize: 11 }}>
                      <span style={{ color: INK_S }}>{f.label}</span>
                      <div style={{ position: 'relative', height: 14, background: '#FAF6EB', border: '1px solid ' + HAIR, borderRadius: 3 }}>
                        <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: barPct + '%', background: i === 0 ? '#8FA37F' : i === 1 ? '#2D5941' : i === 2 ? GREEN : '#0F2A1E' }} />
                      </div>
                      <span style={{ textAlign: 'right', color: INK, fontVariantNumeric: 'tabular-nums' }}>
                        {fmtNum(f.n)} · {pctVal.toFixed(0)}%
                        {drop != null && <span style={{ color: INK_M }}> · {drop.toFixed(0)}%</span>}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* IN-STAY ENGAGEMENT */}
        <div style={{ gridColumn: '1 / -1' }}>
          <div style={sectionH}>In-stay engagement · last 90 days</div>
          <div style={cardBox}>
            {recentTotal === 0 ? (
              <EmptyBox text="No guests with last_stay_date in the last 90 days." />
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 8 }}>
                {engagement.map(e => {
                  const p = recentTotal > 0 ? (e.n / recentTotal) * 100 : 0;
                  const color = p >= 60 ? GREEN : p >= 30 ? AMBER : RED;
                  return (
                    <div key={e.label} style={{ padding: '10px 12px', border: '1px solid ' + HAIR, borderRadius: 4, background: WHITE }}>
                      <div style={{ fontSize: 10, letterSpacing: '0.06em', textTransform: 'uppercase', color: INK_M, fontWeight: 600 }}>{e.label}</div>
                      <div style={{ fontSize: 20, fontWeight: 600, color, marginTop: 2 }}>{p.toFixed(0)}%</div>
                      <div style={{ fontSize: 11, color: INK_M, marginTop: 2 }}>{e.n} of {recentTotal}</div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* HOW TO READ THIS PAGE */}
        <div style={{ gridColumn: '1 / -1' }}>
          <div style={{ padding: '10px 14px', background: '#FAFAF7', border: '1px dashed ' + HAIR, borderRadius: 4, fontSize: 11, color: INK_M, lineHeight: 1.55 }}>
            <strong>How this page works:</strong> Every card below the conclusions is <em>evidence</em>.
            The conclusions on top come from a small registry of rules (<code>lib/rules/retention.ts</code>) — pure functions that read this same context and emit priority-ranked signals.
            Add a rule = add a function. The same pattern will power revenue and sales conclusions later.
          </div>
        </div>

      </DashboardPage>
    </div>
  );
}

function EmptyBox({ text }: { text: string }) {
  return (
    <div style={{ padding: '24px 12px', background: '#FAFAF7', border: '1px dashed #E6DFCC', borderRadius: 4, textAlign: 'center', color: '#5A5A5A', fontSize: 11 }}>
      {text}
    </div>
  );
}
