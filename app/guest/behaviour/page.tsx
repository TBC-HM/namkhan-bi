// app/guest/behaviour/page.tsx
// PBS 2026-07-06 v2: retention cockpit.
// - CONCLUSIONS sit BELOW the KPI strip, split into two side-by-side blocks:
//     left  = SIGNALS      (rule-based, from lib/rules/retention.ts)
//     right = OBSERVATIONS (data-quality, from lib/rules/observations.ts)
// - Each insight is dismissable (client-side localStorage) and click-through to
//   /guest/behaviour/insight/[key] which lists the exact guests behind that signal.
// - Guardrails: some thresholds are DYNAMIC (data-driven baselines), tagged in the UI.
// - On-site spending correlation panel below — the second dimension PBS asked for.
//
// Reads:
//   guest.mv_guest_profile       (LTV, stays, contactability)
//   guest.loyalty_members        (tier ladder)
//   public.reservations          (funnel, cancels, no-shows, 30d/12mo baselines)
//   guest.v_directory_full       (contactability, in-stay engagement, spending)
//   guest.campaign_recipients    (unsub rate)
//   marketing.reviews            (response rate, low-scoring unanswered)

// CONCLUSIONS now live on the HoD page (/guest). This page is KPIs + panels only.
import { DashboardPage, KpiTile, type DashboardTab, type KpiTileProps } from '@/app/(cockpit)/_design';
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
interface ResRow {
  status: string | null;
  check_in_date: string | null;
  booking_date: string | null;
  source_name: string | null;
  guest_email: string | null;
}
interface DirRow {
  guest_id: string | null;
  email: string | null;
  phone: string | null;
  arrival_bucket: string | null;
  last_stay_date: string | null;
  spent_restaurant: boolean | null;
  spent_spa: boolean | null;
  spent_activities: boolean | null;
  spent_retail: boolean | null;
  top_source: string | null;
  last_room_type: string | null;
  party_type: string | null;
  last_adr: number | null;
  last_nights: number | null;
}
interface DemographicRow {
  guest_country: string | null;
  total_reservations: number | null;
  total_revenue: number | null;
  average_length_of_stay: number | null;
  revenue_share_pct: number | null;
  reservation_share_pct: number | null;
}
interface DiversityRow {
  dimension: string | null;
  bucket: string | null;
  headcount: number | null;
}
function daysBetween(iso: string | null, ms: number): number | null {
  if (!iso) return null;
  return Math.floor((ms - new Date(iso).getTime()) / 86_400_000);
}
function fmtNum(n: number): string { return Math.round(n).toLocaleString('en-US'); }
function pct(n: number, d: number): number { return d > 0 ? (n / d) * 100 : 0; }

interface Props { searchParams: Record<string, string | string[] | undefined>; propertyId?: number }

export default async function GuestBehaviourPage({ searchParams, propertyId }: Props) {
  const pid = propertyId ?? PROPERTY_ID;
  const daysParam = Array.isArray(searchParams.days) ? searchParams.days[0] : searchParams.days;
  const windowDays = Math.max(7, Math.min(365, Number(daysParam) || 180));
  const sinceIso = new Date(Date.now() - windowDays * 86_400_000).toISOString().slice(0, 10);
  const since90dIso = new Date(Date.now() - 90 * 86_400_000).toISOString().slice(0, 10);
  const todayMs = Date.now();

  const sb = getSupabaseAdmin();

  const [profilesR, resR, dirR, demoR, diversityR] = await Promise.all([
    sb.schema('guest').from('mv_guest_profile')
      .select('guest_id, full_name, country, email, bookings_count, stays_count, lifetime_revenue, total_nights, avg_adr, first_stay_date, last_stay_date, is_repeat, top_source')
      .eq('property_id', pid)
      .order('lifetime_revenue', { ascending: false })
      .limit(5000),
    sb.from('reservations')
      .select('status, check_in_date, booking_date, source_name, guest_email')
      .eq('property_id', pid)
      .gte('check_in_date', sinceIso),
    sb.schema('guest').from('v_directory_full')
      .select('guest_id, email, phone, arrival_bucket, last_stay_date, spent_restaurant, spent_spa, spent_activities, spent_retail, top_source, last_room_type, party_type, last_adr, last_nights')
      .eq('property_id', pid),
    sb.from('v_chart_guest_demographics' as never)
      .select('guest_country, total_reservations, total_revenue, average_length_of_stay, revenue_share_pct, reservation_share_pct')
      .eq('property_id', pid)
      .order('revenue_share_pct', { ascending: false })
      .limit(20),
    sb.from('v_diversity_mix' as never)
      .select('dimension, bucket, headcount')
      .eq('property_id', pid)
      .order('dimension', { ascending: true }),
  ]);

  const profiles:    ProfileRow[]    = (profilesR.data as ProfileRow[]) ?? [];
  const res:         ResRow[]        = (resR.data as ResRow[]) ?? [];
  const dir:         DirRow[]        = (dirR.data as DirRow[]) ?? [];
  const demographics: DemographicRow[] = (demoR.data as DemographicRow[]) ?? [];
  const diversity:    DiversityRow[]   = (diversityR.data as DiversityRow[]) ?? [];

  // ─── LOYALTY side ──────────────────────────────────────────────────────
  const totalGuests   = profiles.length;
  const stayedGuests  = profiles.filter(p => Number(p.stays_count ?? 0) >= 1);
  const repeatGuests  = profiles.filter(p => Number(p.stays_count ?? 0) >= 2);
  const repeatRate    = pct(repeatGuests.length, stayedGuests.length);

  const avgLtvAll = totalGuests > 0
    ? profiles.reduce((s, p) => s + Number(p.lifetime_revenue ?? 0), 0) / totalGuests : 0;
  const avgLtvRepeat = repeatGuests.length > 0
    ? repeatGuests.reduce((s, p) => s + Number(p.lifetime_revenue ?? 0), 0) / repeatGuests.length : 0;

  const winbackPool = profiles.filter(p =>
    Number(p.stays_count ?? 0) >= 2 &&
    p.email && String(p.email).includes('@') &&
    p.last_stay_date &&
    (daysBetween(p.last_stay_date, todayMs) ?? 0) > 365,
  ).length;

  // ─── JOURNEY side ──────────────────────────────────────────────────────
  const totalRes = res.length;
  const confirmed = res.filter(r => r.status && ['confirmed','checked_in','checked_out'].includes(r.status)).length;
  const arrived   = res.filter(r => r.status && ['checked_in','checked_out'].includes(r.status)).length;
  const inHouse   = res.filter(r => r.status === 'checked_in').length;
  const canceled  = res.filter(r => r.status === 'canceled').length;
  const noShows   = res.filter(r => r.status === 'no_show').length;

  const confirmRate = pct(confirmed, totalRes);
  const arriveRate  = pct(arrived, confirmed);
  const cancelRate  = pct(canceled, totalRes);

  // ─── Panels ───
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

  // ─── In-stay engagement (FIXED: strip time from last_stay_date before compare) ───
  const recentStays = dir.filter(d => {
    if (!d.last_stay_date) return false;
    const day = String(d.last_stay_date).slice(0, 10);
    return day >= since90dIso;
  });
  const recentTotal = recentStays.length;
  const engagement = [
    { label: 'Restaurant',  n: recentStays.filter(d => d.spent_restaurant).length },
    { label: 'Spa',         n: recentStays.filter(d => d.spent_spa).length },
    { label: 'Activities',  n: recentStays.filter(d => d.spent_activities).length },
    { label: 'Retail',      n: recentStays.filter(d => d.spent_retail).length },
  ];

  // ─── On-site spending correlation: SOURCE × outlet ───
  const sourceGroups = new Map<string, DirRow[]>();
  for (const d of recentStays) {
    const src = (d.top_source ?? 'unknown').toLowerCase();
    const bucket = ['booking','expedia','agoda','ctrip','trip.com','hotelbeds','traveloka'].some(o => src.includes(o))
      ? 'OTA' : src.includes('direct') || src.includes('website') || src.includes('walk') ? 'Direct'
      : src.includes('travel') || src.includes('agent') || src.includes('operator') ? 'Trade'
      : 'Other';
    const arr = sourceGroups.get(bucket) ?? [];
    arr.push(d);
    sourceGroups.set(bucket, arr);
  }
  const sourceRows = Array.from(sourceGroups.entries())
    .map(([k, arr]) => ({
      source: k,
      n: arr.length,
      restaurant: pct(arr.filter(x => x.spent_restaurant).length, arr.length),
      spa:        pct(arr.filter(x => x.spent_spa).length, arr.length),
      activities: pct(arr.filter(x => x.spent_activities).length, arr.length),
      retail:     pct(arr.filter(x => x.spent_retail).length, arr.length),
      avgAdr:     arr.reduce((s, x) => s + Number(x.last_adr ?? 0), 0) / Math.max(1, arr.filter(x => x.last_adr).length),
    }))
    .sort((a, b) => b.n - a.n);

  // ─── On-site spending correlation: ROOM × outlet ───
  const roomGroups = new Map<string, DirRow[]>();
  for (const d of recentStays) {
    const room = (d.last_room_type ?? 'unknown').trim() || 'unknown';
    const arr = roomGroups.get(room) ?? [];
    arr.push(d);
    roomGroups.set(room, arr);
  }
  const roomRows = Array.from(roomGroups.entries())
    .map(([k, arr]) => ({
      room: k, n: arr.length,
      restaurant: pct(arr.filter(x => x.spent_restaurant).length, arr.length),
      spa:        pct(arr.filter(x => x.spent_spa).length, arr.length),
      activities: pct(arr.filter(x => x.spent_activities).length, arr.length),
      retail:     pct(arr.filter(x => x.spent_retail).length, arr.length),
    }))
    .sort((a, b) => b.n - a.n)
    .slice(0, 10);

  // ─── Best clients: LTV × spend intensity ───
  const spendIntensity = (p: ProfileRow): number => {
    const d = dir.find(x => x.guest_id === p.guest_id);
    if (!d) return 0;
    return [d.spent_restaurant, d.spent_spa, d.spent_activities, d.spent_retail].filter(Boolean).length;
  };
  const bestClients = [...profiles]
    .filter(p => Number(p.stays_count ?? 0) >= 1)
    .map(p => ({
      ...p,
      intensity: spendIntensity(p),
      lastRoom: dir.find(x => x.guest_id === p.guest_id)?.last_room_type ?? null,
      partyType: dir.find(x => x.guest_id === p.guest_id)?.party_type ?? null,
    }))
    .sort((a, b) => (Number(b.lifetime_revenue ?? 0) * (b.intensity + 1)) - (Number(a.lifetime_revenue ?? 0) * (a.intensity + 1)))
    .slice(0, 20);

  // ─── Diversity mix: group by dimension ───
  const diversityByDimension = new Map<string, { bucket: string; headcount: number }[]>();
  for (const d of diversity) {
    const dim = d.dimension ?? 'Other';
    const arr = diversityByDimension.get(dim) ?? [];
    arr.push({ bucket: d.bucket ?? '—', headcount: d.headcount ?? 0 });
    diversityByDimension.set(dim, arr);
  }
  const diversityDims = Array.from(diversityByDimension.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([dim, rows]) => ({
      dim,
      rows: rows.sort((a, b) => b.headcount - a.headcount),
      total: rows.reduce((s, r) => s + r.headcount, 0),
    }));

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
  const th: React.CSSProperties = { padding: '8px 12px', textAlign: 'left', fontWeight: 600, borderBottom: '1px solid ' + HAIR, color: INK_S, fontSize: 11 };
  const thR: React.CSSProperties = { ...th, textAlign: 'right' };
  const td: React.CSSProperties = { padding: '8px 12px', borderBottom: '1px solid #F5F0E1', color: INK, fontSize: 12 };
  const tdR: React.CSSProperties = { ...td, textAlign: 'right' };

  function shareCell(p: number, count: number) {
    const color = p >= 40 ? GREEN : p >= 20 ? AMBER : p > 0 ? '#5A5A5A' : '#B0B0B0';
    return (
      <td style={{ ...tdR, color, fontVariantNumeric: 'tabular-nums' }}>
        {p.toFixed(0)}% <span style={{ color: INK_M, fontSize: 10 }}>· {count}</span>
      </td>
    );
  }

  return (
    <div style={{ background: WHITE, minHeight: '100vh' }}>
      <DashboardPage
        title="Contacts · Behaviour"
        subtitle="Retention cockpit — who's staying, who's slipping, who to save. Second dimension: on-site spending."
        tabs={tabs}
      >
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
                  const pctVal = pct(b.n, retentionTotal);
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
                  const pctVal = pct(c.n, totalGuests);
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
            <div style={{ fontSize: 11, color: INK_M, marginBottom: 12 }}>{windowDays}d · confirm {confirmRate.toFixed(0)}% · arrive {arriveRate.toFixed(0)}%</div>
            {totalRes === 0 ? <EmptyBox text="No reservations in window." /> : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {funnel.map((f, i) => {
                  const pctVal = pct(f.n, totalRes);
                  const barPct = (f.n / funnelMax) * 100;
                  const prev = i > 0 ? funnel[i - 1].n : null;
                  const drop = prev != null && prev > 0 ? (f.n / prev) * 100 : null;
                  return (
                    <div key={f.label} style={{ display: 'grid', gridTemplateColumns: '80px 1fr 110px', gap: 8, alignItems: 'center', fontSize: 11 }}>
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

        {/* IN-STAY ENGAGEMENT · fixed bug: strip time from last_stay_date */}
        <div style={{ gridColumn: '1 / -1' }}>
          <div style={sectionH}>In-stay engagement · last 90 days · {recentTotal} stayed guests</div>
          <div style={cardBox}>
            {recentTotal === 0 ? (
              <EmptyBox text="No guests with last_stay_date in the last 90 days." />
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 8 }}>
                {engagement.map(e => {
                  const p = pct(e.n, recentTotal);
                  const color = p >= 60 ? GREEN : p >= 30 ? AMBER : p > 0 ? RED : '#B0B0B0';
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

        {/* ON-SITE SPENDING × SOURCE */}
        <div style={{ gridColumn: '1 / -1' }}>
          <div style={sectionH}>On-site spending by SOURCE · last 90d departures</div>
          {sourceRows.length === 0 ? (
            <EmptyBox text="No spend data in the last 90 days." />
          ) : (
            <div style={{ background: WHITE, border: '1px solid ' + HAIR, borderRadius: 6, overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead>
                  <tr>
                    <th style={th}>Source group</th>
                    <th style={thR}>Guests</th>
                    <th style={thR}>Avg ADR</th>
                    <th style={thR}>Restaurant</th>
                    <th style={thR}>Spa</th>
                    <th style={thR}>Activities</th>
                    <th style={thR}>Retail</th>
                  </tr>
                </thead>
                <tbody>
                  {sourceRows.map(r => (
                    <tr key={r.source}>
                      <td style={{ ...td, fontWeight: 600 }}>{r.source}</td>
                      <td style={tdR}>{fmtNum(r.n)}</td>
                      <td style={{ ...tdR, color: INK_S }}>{r.avgAdr > 0 ? '$' + fmtNum(r.avgAdr) : '—'}</td>
                      {shareCell(r.restaurant, r.n)}
                      {shareCell(r.spa, r.n)}
                      {shareCell(r.activities, r.n)}
                      {shareCell(r.retail, r.n)}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* ON-SITE SPENDING × ROOM TYPE */}
        <div style={{ gridColumn: '1 / -1' }}>
          <div style={sectionH}>On-site spending by ROOM TYPE · top 10 rooms · last 90d departures</div>
          {roomRows.length === 0 ? (
            <EmptyBox text="No room-typed departures in the last 90 days." />
          ) : (
            <div style={{ background: WHITE, border: '1px solid ' + HAIR, borderRadius: 6, overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead>
                  <tr>
                    <th style={th}>Room type</th>
                    <th style={thR}>Guests</th>
                    <th style={thR}>Restaurant</th>
                    <th style={thR}>Spa</th>
                    <th style={thR}>Activities</th>
                    <th style={thR}>Retail</th>
                  </tr>
                </thead>
                <tbody>
                  {roomRows.map(r => (
                    <tr key={r.room}>
                      <td style={{ ...td, fontWeight: 600 }}>{r.room}</td>
                      <td style={tdR}>{fmtNum(r.n)}</td>
                      {shareCell(r.restaurant, r.n)}
                      {shareCell(r.spa, r.n)}
                      {shareCell(r.activities, r.n)}
                      {shareCell(r.retail, r.n)}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* BEST CLIENTS · LTV × spend intensity */}
        <div style={{ gridColumn: '1 / -1' }}>
          <div style={sectionH}>Best clients · top 20 by (LTV × outlets hit + 1)</div>
          {bestClients.length === 0 ? (
            <EmptyBox text="No guests yet." />
          ) : (
            <div style={{ background: WHITE, border: '1px solid ' + HAIR, borderRadius: 6, overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead>
                  <tr>
                    <th style={th}>Guest</th>
                    <th style={th}>Country</th>
                    <th style={th}>Source</th>
                    <th style={th}>Party</th>
                    <th style={th}>Last room</th>
                    <th style={thR}>Stays</th>
                    <th style={thR}>Outlets</th>
                    <th style={thR}>LTV</th>
                  </tr>
                </thead>
                <tbody>
                  {bestClients.map(r => (
                    <tr key={r.guest_id}>
                      <td style={td}>
                        <div style={{ fontWeight: 600 }}>{r.full_name ?? '—'}</div>
                        {r.email && <div style={{ fontSize: 11, color: INK_M }}>{r.email}</div>}
                      </td>
                      <td style={{ ...td, color: INK_S }}>{r.country ?? '—'}</td>
                      <td style={{ ...td, color: INK_S }}>{r.top_source ?? '—'}</td>
                      <td style={{ ...td, color: INK_S }}>{r.partyType ?? '—'}</td>
                      <td style={{ ...td, color: INK_S }}>{r.lastRoom ?? '—'}</td>
                      <td style={tdR}>{r.stays_count ?? 0}</td>
                      <td style={{ ...tdR, color: r.intensity >= 3 ? GREEN : r.intensity >= 1 ? AMBER : INK_M }}>{r.intensity}/4</td>
                      <td style={{ ...tdR, fontWeight: 600 }}>{fmtNum(Number(r.lifetime_revenue ?? 0))}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* GUEST ORIGINS · country breakdown */}
        <div style={{ gridColumn: '1 / -1' }}>
          <div style={sectionH}>Guest origins · top 20 countries by revenue share</div>
          {demographics.length === 0 ? (
            <EmptyBox text="No demographic data available." />
          ) : (
            <div style={{ background: WHITE, border: '1px solid ' + HAIR, borderRadius: 6, overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead>
                  <tr>
                    <th style={th}>Country</th>
                    <th style={thR}>Reservations</th>
                    <th style={thR}>Rev share %</th>
                    <th style={thR}>Avg LOS</th>
                    <th style={thR}>Total revenue</th>
                  </tr>
                </thead>
                <tbody>
                  {demographics.map((r, i) => {
                    const revPct = Number(r.revenue_share_pct ?? 0);
                    const revColor = revPct >= 20 ? GREEN : revPct >= 8 ? AMBER : INK_S;
                    return (
                      <tr key={r.guest_country ?? i}>
                        <td style={{ ...td, fontWeight: 600 }}>{r.guest_country ?? '—'}</td>
                        <td style={tdR}>{fmtNum(Number(r.total_reservations ?? 0))}</td>
                        <td style={{ ...tdR, color: revColor, fontVariantNumeric: 'tabular-nums' }}>{revPct.toFixed(1)}%</td>
                        <td style={{ ...tdR, color: INK_S }}>{Number(r.average_length_of_stay ?? 0).toFixed(1)}n</td>
                        <td style={{ ...tdR, fontVariantNumeric: 'tabular-nums' }}>{fmtNum(Number(r.total_revenue ?? 0))}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* DIVERSITY MIX */}
        {diversityDims.length > 0 && (
          <div style={{ gridColumn: '1 / -1' }}>
            <div style={sectionH}>Diversity mix</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 8 }}>
              {diversityDims.map(({ dim, rows, total }) => (
                <div key={dim} style={cardBox}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: INK, marginBottom: 2, textTransform: 'capitalize' }}>{dim.replace(/_/g, ' ')}</div>
                  <div style={{ fontSize: 11, color: INK_M, marginBottom: 10 }}>{fmtNum(total)} guests</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                    {rows.slice(0, 8).map(r => {
                      const pctVal = total > 0 ? (r.headcount / total) * 100 : 0;
                      return (
                        <div key={r.bucket} style={{ display: 'grid', gridTemplateColumns: '1fr 80px', gap: 6, alignItems: 'center', fontSize: 11 }}>
                          <div style={{ position: 'relative' }}>
                            <div style={{ fontSize: 11, color: INK_S, marginBottom: 2 }}>{r.bucket}</div>
                            <div style={{ position: 'relative', height: 6, background: '#FAF6EB', border: '1px solid ' + HAIR, borderRadius: 2 }}>
                              <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: pctVal + '%', background: GREEN, borderRadius: 2 }} />
                            </div>
                          </div>
                          <span style={{ textAlign: 'right', color: INK, fontVariantNumeric: 'tabular-nums' }}>{fmtNum(r.headcount)} · {pctVal.toFixed(0)}%</span>
                        </div>
                      );
                    })}
                    {rows.length > 8 && (
                      <div style={{ fontSize: 10, color: INK_M, marginTop: 2 }}>+{rows.length - 8} more buckets</div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

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