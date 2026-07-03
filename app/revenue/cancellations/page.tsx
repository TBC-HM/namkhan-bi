// app/revenue/cancellations/page.tsx
// PBS 2026-07-03: cancellations deep-dive linked from the Channels area.
// Analyzes cancellation source, country, room type, LOS bucket, DTA bucket,
// segment and rate plan so ops can spot patterns and act on them.
//
// Data source: public.v_cancellations_detail — per-cancellation row with
// lost_revenue recovered from pms.v_reservation_rooms.rate (Cloudbeds zeros
// total_amount on cancel, but per-night rates persist).

import Link from 'next/link';
import { DashboardPage, Container, KpiTile, Chart, type ChartSeries, type DashboardTab, type KpiTileProps } from '@/app/(cockpit)/_design';
import { supabase, PROPERTY_ID } from '@/lib/supabase';
import { REVENUE_SUBPAGES } from '../_subpages';

export const dynamic = 'force-dynamic';
export const revalidate = 60;

interface CxlRow {
  reservation_id: string;
  cancellation_date: string;
  check_in_date: string;
  days_to_arrival: number | null;
  nights: number;
  source_name: string;
  guest_country: string | null;
  room_type_name: string;
  market_segment: string;
  rate_plan: string;
  lost_revenue: number;
  lost_room_nights: number;
  dta_bucket: string;
  los_bucket: string;
}

interface MonthImpactRow {
  cancel_year_month: string;
  cancellations: number;
  lost_room_nights: number;
  lost_revenue: number;
  avg_days_to_arrival: number | null;
}
interface ChanMonthRow {
  month: string;
  channel_group: string | null;
  total_reservations: number;
  cancellations: number;
  cancel_rate_pct: number | null;
}
interface BookedRow {
  source_name: string | null;
  is_cancelled: boolean | null;
  booking_date: string | null;
  check_in_date: string | null;
}
interface RebookRow {
  cxl_source: string | null;
  rebook_source: string | null;
  gap_days: number | null;
  ci_shift_days: number | null;
}

const WIN_KEYS = ['30d','90d','365d','ytd','all'] as const;
type Win = typeof WIN_KEYS[number];
const DEFAULT_WIN: Win = '90d';
const WIN_LABEL: Record<Win, string> = {
  '30d':  'Last 30 days',
  '90d':  'Last 90 days',
  '365d': 'Last 365 days',
  'ytd':  'Year to date',
  'all':  'All time',
};

function shiftYearIso(iso: string, dy: number): string {
  const d = new Date(iso + 'T00:00:00Z');
  d.setUTCFullYear(d.getUTCFullYear() + dy);
  return d.toISOString().slice(0, 10);
}
function fmt$(n: number): string { return `$${Math.round(n).toLocaleString('en-US')}`; }
function isoBack(days: number): string { return new Date(Date.now() - days * 86_400_000).toISOString().slice(0, 10); }

function resolveWin(raw: string | string[] | undefined): { win: Win; from: string; to: string } {
  const v = String(Array.isArray(raw) ? raw[0] : raw ?? '').toLowerCase();
  const win: Win = (WIN_KEYS as readonly string[]).includes(v) ? (v as Win) : DEFAULT_WIN;
  const today = new Date().toISOString().slice(0, 10);
  if (win === 'all')  return { win, from: '2020-01-01', to: today };
  if (win === 'ytd')  return { win, from: today.slice(0, 4) + '-01-01', to: today };
  if (win === '30d')  return { win, from: isoBack(30),  to: today };
  if (win === '90d')  return { win, from: isoBack(90),  to: today };
  return { win, from: isoBack(365), to: today };
}

function pctDelta(now: number, prior: number): { value: number; direction: 'up' | 'down' | 'flat' } {
  if (prior <= 0) return { value: 0, direction: 'flat' };
  const pct = ((now - prior) / prior) * 100;
  return { value: Math.round(pct * 10) / 10, direction: pct > 0.5 ? 'up' : pct < -0.5 ? 'down' : 'flat' };
}

export default async function CancellationsPage({
  searchParams,
  propertyId,
}: {
  searchParams: Record<string, string | string[] | undefined>;
  propertyId?: number;
}) {
  const pid = propertyId ?? PROPERTY_ID;
  const { win, from, to } = resolveWin(searchParams.win);
  const sdlyFrom = shiftYearIso(from, -1);
  const sdlyTo   = shiftYearIso(to,   -1);

  const [rows, sdlyRows, monthImpact, rateOverall, chanMonthly, bookedRows, rebookRows] = await Promise.all([
    supabase.from('v_cancellations_detail')
      .select('reservation_id, cancellation_date, check_in_date, days_to_arrival, nights, source_name, guest_country, room_type_name, market_segment, rate_plan, lost_revenue, lost_room_nights, dta_bucket, los_bucket')
      .eq('property_id', pid)
      .gte('cancellation_date', from)
      .lte('cancellation_date', to)
      .order('cancellation_date', { ascending: false })
      .limit(2000)
      .then(r => (r.data ?? []) as CxlRow[]).catch(() => [] as CxlRow[]),
    supabase.from('v_cancellations_detail')
      .select('reservation_id, lost_revenue, lost_room_nights, nights, days_to_arrival')
      .eq('property_id', pid)
      .gte('cancellation_date', sdlyFrom)
      .lte('cancellation_date', sdlyTo)
      .limit(2000)
      .then(r => (r.data ?? []) as Array<{ lost_revenue: number; lost_room_nights: number; nights: number; days_to_arrival: number | null }>).catch(() => []),
    supabase.from('v_cancellation_impact_monthly')
      .select('cancel_year_month, cancellations, lost_room_nights, lost_revenue, avg_days_to_arrival')
      .eq('property_id', pid)
      .gte('cancel_year_month', '2025-01')
      .order('cancel_year_month')
      .then(r => (r.data ?? []) as MonthImpactRow[]).catch(() => []),
    supabase.from('v_cancellation_rate')
      .select('cancelled_30d, total_30d, cancel_rate_30d, cancelled_90d, total_90d, cancel_rate_90d')
      .eq('property_id', pid)
      .maybeSingle()
      .then(r => r.data as { cancelled_30d: number; total_30d: number; cancel_rate_30d: number; cancelled_90d: number; total_90d: number; cancel_rate_90d: number } | null).catch(() => null),
    // PBS 2026-07-03: bookings received vs cancellations by channel · monthly.
    // Aggregated in the page for the "bookings vs cancels" trend + per-channel rate table.
    supabase.from('v_cancel_rate_by_channel_monthly')
      .select('month, channel_group, total_reservations, cancellations, cancel_rate_pct')
      .eq('property_id', pid)
      .gte('month', '2025-01-01')
      .then(r => (r.data ?? []) as ChanMonthRow[]).catch(() => [] as ChanMonthRow[]),
    // PBS 2026-07-03: raw bookings received in the CHOSEN window for cancel
    // rate by booking-window (check_in − booking_date lead time). Filter is on
    // booking_date so we capture EVERY booking received in the window, cancel
    // or not, exactly like the monthly view but for arbitrary date ranges.
    supabase.from('v_reservations_unified')
      .select('source_name, is_cancelled, booking_date, check_in_date')
      .eq('property_id', pid)
      .gte('booking_date', from)
      .lte('booking_date', to)
      .limit(10000)
      .then(r => (r.data ?? []) as BookedRow[]).catch(() => [] as BookedRow[]),
    // PBS 2026-07-03: rebook analysis — did cancelled guests come back?
    // Matched on email or lowercased guest_name in v_cancellations_rebook.
    supabase.from('v_cancellations_rebook')
      .select('cxl_source, rebook_source, gap_days, ci_shift_days')
      .eq('property_id', pid)
      .gte('cxl_date', from)
      .lte('cxl_date', to)
      .limit(5000)
      .then(r => (r.data ?? []) as RebookRow[]).catch(() => [] as RebookRow[]),
  ]);

  const cxlCount = rows.length;
  const lostRev  = rows.reduce((s, r) => s + Number(r.lost_revenue ?? 0), 0);
  const lostRn   = rows.reduce((s, r) => s + Number(r.lost_room_nights ?? 0), 0);
  const dtaVals  = rows.map(r => Number(r.days_to_arrival ?? 0)).filter((n) => Number.isFinite(n) && n >= 0);
  const avgDta   = dtaVals.length > 0 ? dtaVals.reduce((s, v) => s + v, 0) / dtaVals.length : 0;

  const sdlyCount   = sdlyRows.length;
  const sdlyLostRev = sdlyRows.reduce((s, r) => s + Number(r.lost_revenue ?? 0), 0);
  const sdlyLostRn  = sdlyRows.reduce((s, r) => s + Number(r.lost_room_nights ?? 0), 0);
  const sdlyDtaVals = sdlyRows.map(r => Number(r.days_to_arrival ?? 0)).filter((n) => Number.isFinite(n) && n >= 0);
  const sdlyAvgDta  = sdlyDtaVals.length > 0 ? sdlyDtaVals.reduce((s, v) => s + v, 0) / sdlyDtaVals.length : 0;
  const dCount  = pctDelta(cxlCount, sdlyCount);
  const dLostRev = pctDelta(lostRev, sdlyLostRev);
  const dLostRn  = pctDelta(lostRn,  sdlyLostRn);
  const dDta     = pctDelta(avgDta,  sdlyAvgDta);

  // Cancel rate — from v_cancellation_rate view (30d/90d built-in)
  const cxlRate30 = rateOverall ? Number(rateOverall.cancel_rate_30d ?? 0) : 0;
  const cxlRate90 = rateOverall ? Number(rateOverall.cancel_rate_90d ?? 0) : 0;
  const cxlRateHeadline = win === '30d' ? cxlRate30 : cxlRate90;
  const cxlRateWinLabel = win === '30d' ? '30d' : '90d';

  // Group helpers
  const group = <K,>(keyFn: (r: CxlRow) => K) => {
    const m = new Map<K, { count: number; lostRev: number; lostRn: number }>();
    for (const r of rows) {
      const k = keyFn(r);
      const c = m.get(k) ?? { count: 0, lostRev: 0, lostRn: 0 };
      c.count   += 1;
      c.lostRev += Number(r.lost_revenue ?? 0);
      c.lostRn  += Number(r.lost_room_nights ?? 0);
      m.set(k, c);
    }
    return m;
  };
  const bySource   = Array.from(group(r => r.source_name).entries()).sort((a, b) => b[1].count - a[1].count);
  const byCountry  = Array.from(group(r => r.guest_country ?? '—').entries()).sort((a, b) => b[1].count - a[1].count);
  const byRoom     = Array.from(group(r => r.room_type_name).entries()).sort((a, b) => b[1].count - a[1].count);
  const bySegment  = Array.from(group(r => r.market_segment).entries()).sort((a, b) => b[1].count - a[1].count);
  const byLos      = Array.from(group(r => r.los_bucket).entries()).sort((a, b) => losOrder(a[0]) - losOrder(b[0]));
  const byDta      = Array.from(group(r => r.dta_bucket).entries()).sort((a, b) => dtaOrder(a[0]) - dtaOrder(b[0]));

  // PBS 2026-07-03: add "% of total cancels" as a right-axis line so the
  // relative weight is obvious without eyeballing bar heights.
  const chartBySource = bySource.slice(0, 6).map(([source, v]) => ({
    source,
    cancels: v.count,
    lost_usd: Math.round(v.lostRev),
    pct_of_total: cxlCount > 0 ? Math.round((v.count / cxlCount) * 1000) / 10 : 0,
  }));
  const chartByDta    = byDta.map(([bucket, v]) => ({
    bucket,
    cancels: v.count,
    lost_usd: Math.round(v.lostRev),
    pct_of_total: cxlCount > 0 ? Math.round((v.count / cxlCount) * 1000) / 10 : 0,
  }));

  // Bookings-vs-cancellations monthly trend (from v_cancel_rate_by_channel_monthly, all channels summed)
  const monthMap = new Map<string, { received: number; cancels: number }>();
  for (const r of chanMonthly) {
    const key = String(r.month).slice(0, 7);
    const c = monthMap.get(key) ?? { received: 0, cancels: 0 };
    c.received += Number(r.total_reservations ?? 0);
    c.cancels  += Number(r.cancellations ?? 0);
    monthMap.set(key, c);
  }
  const bookingsVsCancels = Array.from(monthMap.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([month, v]) => ({
      month,
      bookings_ok: Math.max(0, v.received - v.cancels),
      cancels:     v.cancels,
      cancel_pct:  v.received > 0 ? Math.round((v.cancels / v.received) * 1000) / 10 : 0,
    }));

  // Per-channel cancel rate over the CHOSEN window — aggregate v_cancel_rate_by_channel_monthly
  // by clipping to months intersecting from → to. Simpler: aggregate months whose
  // first-day is within window.
  const chanRateMap = new Map<string, { received: number; cancels: number }>();
  for (const r of chanMonthly) {
    const mIso = String(r.month).slice(0, 10);
    if (mIso < from.slice(0, 7) + '-01' || mIso > to) continue;
    const key = r.channel_group ?? 'Unknown';
    const c = chanRateMap.get(key) ?? { received: 0, cancels: 0 };
    c.received += Number(r.total_reservations ?? 0);
    c.cancels  += Number(r.cancellations ?? 0);
    chanRateMap.set(key, c);
  }
  const chanRateRows = Array.from(chanRateMap.entries())
    .map(([channel, v]) => ({
      channel,
      received: v.received,
      cancels:  v.cancels,
      rate_pct: v.received > 0 ? (v.cancels / v.received) * 100 : 0,
    }))
    .filter(r => r.received > 0)
    .sort((a, b) => b.rate_pct - a.rate_pct);
  const chanRateTotal = chanRateRows.reduce((s, r) => ({ received: s.received + r.received, cancels: s.cancels + r.cancels }), { received: 0, cancels: 0 });
  const chanRateOverall = chanRateTotal.received > 0 ? (chanRateTotal.cancels / chanRateTotal.received) * 100 : 0;

  // PBS 2026-07-03: Rebook analytics per source. `bySource` gives total cancels
  // in-window per source; `rebookRows` gives cancels-that-came-back. Rebook rate
  // = rebooked / cancelled; small avg_gap = quick channel switch (e.g. SiteMinder),
  // large gap = the guest actually re-planned the trip later.
  const rebookAggMap = new Map<string, { rebooked: number; gapSum: number; gapN: number; ciShiftSum: number; ciShiftN: number }>();
  for (const r of rebookRows) {
    const key = r.cxl_source ?? 'Unknown';
    const cur = rebookAggMap.get(key) ?? { rebooked: 0, gapSum: 0, gapN: 0, ciShiftSum: 0, ciShiftN: 0 };
    cur.rebooked += 1;
    if (Number.isFinite(Number(r.gap_days))) { cur.gapSum += Number(r.gap_days); cur.gapN += 1; }
    if (Number.isFinite(Number(r.ci_shift_days))) { cur.ciShiftSum += Number(r.ci_shift_days); cur.ciShiftN += 1; }
    rebookAggMap.set(key, cur);
  }
  const bySourceCount = new Map<string, number>();
  for (const [s, v] of bySource) bySourceCount.set(s, v.count);
  const rebookRowsAgg = Array.from(rebookAggMap.entries())
    .map(([source, v]) => {
      const totalCxl = bySourceCount.get(source) ?? v.rebooked;
      return {
        source,
        cancels: totalCxl,
        rebooked: v.rebooked,
        rebook_rate: totalCxl > 0 ? (v.rebooked / totalCxl) * 100 : 0,
        avg_gap: v.gapN > 0 ? v.gapSum / v.gapN : 0,
        avg_ci_shift: v.ciShiftN > 0 ? v.ciShiftSum / v.ciShiftN : 0,
      };
    })
    .filter(r => r.rebooked > 0)
    .sort((a, b) => b.rebooked - a.rebooked);
  const rebookedTotal = rebookRows.length;
  const rebookRateOverall = cxlCount > 0 ? (rebookedTotal / cxlCount) * 100 : 0;

  // PBS 2026-07-03: Cancel rate by BOOKING WINDOW (lead time between booking
  // and check-in). Bookings booked 0-7d out cancel far less than those booked
  // 90+d out — this table exposes that pattern.
  const BWIN_ORDER = ['0-7d','8-30d','31-90d','91-180d','180+d'] as const;
  type Bwin = typeof BWIN_ORDER[number];
  function bwinBucket(lead: number): Bwin {
    if (lead <= 7)   return '0-7d';
    if (lead <= 30)  return '8-30d';
    if (lead <= 90)  return '31-90d';
    if (lead <= 180) return '91-180d';
    return '180+d';
  }
  const bwinMap = new Map<Bwin, { received: number; cancels: number }>();
  let receivedTotal = 0, cancelsTotal = 0;
  for (const r of bookedRows) {
    if (!r.booking_date || !r.check_in_date) continue;
    const ci = new Date(String(r.check_in_date));
    const bd = new Date(String(r.booking_date));
    const lead = Math.round((ci.getTime() - bd.getTime()) / 86_400_000);
    if (!Number.isFinite(lead) || lead < 0) continue;
    const key = bwinBucket(lead);
    const cur = bwinMap.get(key) ?? { received: 0, cancels: 0 };
    cur.received += 1;
    if (r.is_cancelled) cur.cancels += 1;
    bwinMap.set(key, cur);
    receivedTotal += 1;
    if (r.is_cancelled) cancelsTotal += 1;
  }
  const overallRate = receivedTotal > 0 ? (cancelsTotal / receivedTotal) * 100 : 0;
  const bwinRows = BWIN_ORDER
    .map((b) => {
      const v = bwinMap.get(b) ?? { received: 0, cancels: 0 };
      return { bucket: b, received: v.received, cancels: v.cancels, rate_pct: v.received > 0 ? (v.cancels / v.received) * 100 : 0 };
    })
    .filter((r) => r.received > 0);

  // PBS 2026-07-03: source × booking-window cross-tab.
  // Row = source; column = lead-time bucket; cell = cancel rate for that combo.
  // Cell is null-coloured when the cell has fewer than 3 bookings (noise).
  const xtabMap = new Map<string, Map<Bwin, { received: number; cancels: number }>>();
  const srcTotals = new Map<string, { received: number; cancels: number }>();
  for (const r of bookedRows) {
    if (!r.booking_date || !r.check_in_date) continue;
    const ci = new Date(String(r.check_in_date));
    const bd = new Date(String(r.booking_date));
    const lead = Math.round((ci.getTime() - bd.getTime()) / 86_400_000);
    if (!Number.isFinite(lead) || lead < 0) continue;
    const bwin = bwinBucket(lead);
    const source = r.source_name ?? 'Unknown';
    if (!xtabMap.has(source)) xtabMap.set(source, new Map());
    const inner = xtabMap.get(source)!;
    const cell = inner.get(bwin) ?? { received: 0, cancels: 0 };
    cell.received += 1;
    if (r.is_cancelled) cell.cancels += 1;
    inner.set(bwin, cell);
    const tot = srcTotals.get(source) ?? { received: 0, cancels: 0 };
    tot.received += 1;
    if (r.is_cancelled) tot.cancels += 1;
    srcTotals.set(source, tot);
  }
  const MIN_CELL_BOOKINGS = 3;
  const xtabRows = Array.from(xtabMap.entries())
    .map(([source, inner]) => {
      const total = srcTotals.get(source) ?? { received: 0, cancels: 0 };
      return {
        source,
        total,
        cells: BWIN_ORDER.map((b) => inner.get(b) ?? { received: 0, cancels: 0 }),
      };
    })
    .filter((r) => r.total.received >= 5)
    .sort((a, b) => b.total.received - a.total.received)
    .slice(0, 10);
  const xtabColTotals = BWIN_ORDER.map((b) => {
    let received = 0, cancels = 0;
    for (const src of xtabRows) {
      const inner = xtabMap.get(src.source);
      if (!inner) continue;
      const c = inner.get(b);
      if (!c) continue;
      received += c.received;
      cancels += c.cancels;
    }
    return { received, cancels };
  });

  const tabs: DashboardTab[] = REVENUE_SUBPAGES.map((s) => ({
    key: s.href, label: s.label, href: s.href,
    active: s.href.endsWith('/cancellations'),
  }));

  const winOptions: Win[] = ['30d', '90d', '365d', 'ytd', 'all'];
  const basePath = propertyId ? `/h/${propertyId}/revenue/cancellations` : '/revenue/cancellations';
  const hrefFor = (w: Win) => `${basePath}${w === DEFAULT_WIN ? '' : `?win=${w}`}`;

  const tiles: KpiTileProps[] = [
    { label: 'Cancellations',   value: cxlCount, size: 'sm',
      delta: sdlyCount > 0 ? { value: dCount.value, period: 'vs SDLY', direction: dCount.direction, isGoodWhenUp: false } : undefined,
      footnote: sdlyCount > 0 ? `SDLY ${sdlyCount}` : undefined },
    { label: `Cancel rate · ${cxlRateWinLabel}`, value: `${cxlRateHeadline.toFixed(1)}%`, size: 'sm',
      footnote: `${cxlRate30.toFixed(1)}% 30d · ${cxlRate90.toFixed(1)}% 90d` },
    { label: 'Lost revenue', value: Math.round(lostRev), currency: 'USD', size: 'sm',
      delta: sdlyLostRev > 0 ? { value: dLostRev.value, period: 'vs SDLY', direction: dLostRev.direction, isGoodWhenUp: false } : undefined,
      footnote: sdlyLostRev > 0 ? `SDLY ${fmt$(sdlyLostRev)}` : undefined },
    { label: 'Lost room nights', value: lostRn, size: 'sm',
      delta: sdlyLostRn > 0 ? { value: dLostRn.value, period: 'vs SDLY', direction: dLostRn.direction, isGoodWhenUp: false } : undefined,
      footnote: sdlyLostRn > 0 ? `SDLY ${sdlyLostRn}` : undefined },
    { label: 'Avg days to arrival', value: `${avgDta.toFixed(0)}d`, size: 'sm',
      delta: sdlyAvgDta > 0 ? { value: dDta.value, period: 'vs SDLY', direction: dDta.direction, isGoodWhenUp: true } : undefined,
      footnote: 'higher = more lead time to resell' },
  ];

  return (
    <DashboardPage
      title={`Revenue · Cancellations`}
      subtitle={`${WIN_LABEL[win]} · ${from} → ${to} · ${cxlCount} cancellations`}
      tabs={tabs}
    >
      {/* window picker */}
      <div style={{ gridColumn: '1 / -1', display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
        <span style={{ fontSize: 10, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#5A5A5A', marginRight: 4 }}>Window:</span>
        {winOptions.map(w => (
          <Link key={w} href={hrefFor(w)} style={pillStyle(w === win)}>{w === 'ytd' ? 'YTD' : w === 'all' ? 'All' : `Last ${w}`}</Link>
        ))}
      </div>

      {/* KPI strip */}
      <div style={{ gridColumn: '1 / -1', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 8 }}>
        {tiles.map((t, i) => <KpiTile key={i} {...t} />)}
      </div>

      {/* Three small charts */}
      <div style={{ gridColumn: '1 / -1', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 10 }}>
        <Container title="Cancellations by channel" subtitle={`top ${chartBySource.length} · ${cxlCount} total · line = share of total`} density="compact">
          <Chart variant="combo" data={chartBySource} xKey="source"
            series={[
              { key: 'cancels',      label: 'Cancellations', color: '#B03826', yAxisId: 'left',  type: 'bar' },
              { key: 'lost_usd',     label: 'Lost $',        color: '#B8542A', yAxisId: 'left',  type: 'bar' },
              { key: 'pct_of_total', label: '% of total',    color: '#B8A878', yAxisId: 'right', type: 'line' },
            ]}
            height={220}
            empty={{ title: 'No cancellations in window' }} />
        </Container>

        <Container title="Days-to-arrival buckets" subtitle="lead time until check-in when cancel hits · line = share of total" density="compact">
          <Chart variant="combo" data={chartByDta} xKey="bucket"
            series={[
              { key: 'cancels',      label: 'Cancellations', color: '#1F3A2E', yAxisId: 'left',  type: 'bar' },
              { key: 'lost_usd',     label: 'Lost $',        color: '#B8542A', yAxisId: 'left',  type: 'bar' },
              { key: 'pct_of_total', label: '% of total',    color: '#B8A878', yAxisId: 'right', type: 'line' },
            ]}
            height={220}
            empty={{ title: 'No cancellations in window' }} />
        </Container>

        <Container title="Bookings vs cancellations · monthly" subtitle="grouped by booking_date · cancel-rate line on right axis" density="compact">
          <Chart variant="combo" data={bookingsVsCancels} xKey="month"
            series={[
              { key: 'bookings_ok', label: 'Bookings kept', color: '#1F3A2E', yAxisId: 'left',  type: 'bar' },
              { key: 'cancels',     label: 'Cancellations', color: '#B03826', yAxisId: 'left',  type: 'bar' },
              { key: 'cancel_pct',  label: 'Cancel rate %', color: '#B8A878', yAxisId: 'right', type: 'line' },
            ]}
            height={220}
            empty={{ title: 'No monthly booking data' }} />
        </Container>
      </div>

      {/* Cancel rate by channel — where should we focus? */}
      <div style={{ gridColumn: '1 / -1' }}>
        <Container title={`Cancel rate by channel · ${WIN_LABEL[win]}`} subtitle={chanRateTotal.received > 0 ? `${chanRateTotal.received} bookings received · ${chanRateTotal.cancels} cancels · overall ${chanRateOverall.toFixed(1)}%` : 'no bookings in window'} density="compact">
          {chanRateRows.length === 0 ? (
            <div style={{ padding: '10px 12px', fontSize: 12, color: '#5A5A5A', fontStyle: 'italic' }}>No channel-rate data in window.</div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid #E6DFCC' }}>
                    <th style={th}>Channel</th>
                    <th style={{ ...th, textAlign: 'right' }}>Bookings received</th>
                    <th style={{ ...th, textAlign: 'right' }}>Cancellations</th>
                    <th style={{ ...th, textAlign: 'right' }}>Cancel rate</th>
                    <th style={{ ...th, textAlign: 'right' }}>vs overall</th>
                  </tr>
                </thead>
                <tbody>
                  {chanRateRows.map((c) => {
                    const dPP = c.rate_pct - chanRateOverall;
                    const color = dPP > 3 ? '#B03826' : dPP < -3 ? '#2E7D32' : '#5A5A5A';
                    return (
                      <tr key={c.channel} style={{ borderTop: '1px solid #E6DFCC' }}>
                        <td style={tdL}>{c.channel}</td>
                        <td style={tdR}>{c.received}</td>
                        <td style={tdR}>{c.cancels}</td>
                        <td style={{ ...tdR, fontWeight: 600 }}>{c.rate_pct.toFixed(1)}%</td>
                        <td style={{ ...tdR, color, fontWeight: 600 }}>{dPP >= 0 ? '+' : ''}{dPP.toFixed(1)}pp</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Container>
      </div>

      {/* Did cancelled guests rebook? */}
      <div style={{ gridColumn: '1 / -1' }}>
        <Container title={`Rebook after cancel · ${rebookedTotal} of ${cxlCount} cancels came back`} subtitle={cxlCount > 0 ? `overall ${rebookRateOverall.toFixed(1)}% rebook rate · matched on email or guest name · small gap = quick channel switch · large gap = trip re-planned later` : 'no cancellations in window'} density="compact">
          {rebookRowsAgg.length === 0 ? (
            <div style={{ padding: '10px 12px', fontSize: 12, color: '#5A5A5A', fontStyle: 'italic' }}>No rebookings detected for cancels in this window.</div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid #E6DFCC' }}>
                    <th style={th}>Cancelled from</th>
                    <th style={{ ...th, textAlign: 'right' }}>Cancels</th>
                    <th style={{ ...th, textAlign: 'right' }}>Rebooked</th>
                    <th style={{ ...th, textAlign: 'right' }}>Rebook rate</th>
                    <th style={{ ...th, textAlign: 'right' }}>Avg gap</th>
                    <th style={{ ...th, textAlign: 'right' }}>Avg CI shift</th>
                  </tr>
                </thead>
                <tbody>
                  {rebookRowsAgg.map((r) => (
                    <tr key={r.source} style={{ borderTop: '1px solid #E6DFCC' }}>
                      <td style={tdL}>{r.source}</td>
                      <td style={tdR}>{r.cancels}</td>
                      <td style={tdR}>{r.rebooked}</td>
                      <td style={{ ...tdR, fontWeight: 600 }}>{r.rebook_rate.toFixed(1)}%</td>
                      <td style={tdR}>{Math.round(r.avg_gap)}d</td>
                      <td style={tdR}>{r.avg_ci_shift >= 0 ? '+' : ''}{Math.round(r.avg_ci_shift)}d</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Container>
      </div>

      {/* Cancel rate by booking window (lead time bucket) */}
      <div style={{ gridColumn: '1 / -1' }}>
        <Container title={`Cancel rate by booking window · ${WIN_LABEL[win]}`} subtitle={receivedTotal > 0 ? `${receivedTotal} bookings received · ${cancelsTotal} cancels · overall ${overallRate.toFixed(1)}% · lead time = check-in − booking date` : 'no bookings in window'} density="compact">
          {bwinRows.length === 0 ? (
            <div style={{ padding: '10px 12px', fontSize: 12, color: '#5A5A5A', fontStyle: 'italic' }}>No bookings in window.</div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid #E6DFCC' }}>
                    <th style={th}>Lead time</th>
                    <th style={{ ...th, textAlign: 'right' }}>Bookings received</th>
                    <th style={{ ...th, textAlign: 'right' }}>Cancellations</th>
                    <th style={{ ...th, textAlign: 'right' }}>Cancel rate</th>
                    <th style={{ ...th, textAlign: 'right' }}>vs overall</th>
                  </tr>
                </thead>
                <tbody>
                  {bwinRows.map((b) => {
                    const dPP = b.rate_pct - overallRate;
                    const color = dPP > 3 ? '#B03826' : dPP < -3 ? '#2E7D32' : '#5A5A5A';
                    return (
                      <tr key={b.bucket} style={{ borderTop: '1px solid #E6DFCC' }}>
                        <td style={tdL}>{b.bucket}</td>
                        <td style={tdR}>{b.received}</td>
                        <td style={tdR}>{b.cancels}</td>
                        <td style={{ ...tdR, fontWeight: 600 }}>{b.rate_pct.toFixed(1)}%</td>
                        <td style={{ ...tdR, color, fontWeight: 600 }}>{dPP >= 0 ? '+' : ''}{dPP.toFixed(1)}pp</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Container>
      </div>

      {/* Source × booking-window cross-tab (cancel rate per cell) */}
      <div style={{ gridColumn: '1 / -1' }}>
        <Container title="Cancel rate · source × booking window" subtitle={`cell = cancels / bookings received · low-count cells (<${MIN_CELL_BOOKINGS}) muted grey · rows: top ${xtabRows.length} sources by volume · red = worse than overall (${overallRate.toFixed(1)}%), green = better`} density="compact">
          {xtabRows.length === 0 ? (
            <div style={{ padding: '10px 12px', fontSize: 12, color: '#5A5A5A', fontStyle: 'italic' }}>No bookings in window.</div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid #E6DFCC' }}>
                    <th style={th}>Source</th>
                    {BWIN_ORDER.map((b) => (
                      <th key={b} style={{ ...th, textAlign: 'right' }}>{b}</th>
                    ))}
                    <th style={{ ...th, textAlign: 'right', background: '#FAF8F1' }}>Overall</th>
                  </tr>
                </thead>
                <tbody>
                  {xtabRows.map((row) => {
                    const overall = row.total.received > 0 ? (row.total.cancels / row.total.received) * 100 : 0;
                    return (
                      <tr key={row.source} style={{ borderTop: '1px solid #E6DFCC' }}>
                        <td style={tdL}>{row.source}</td>
                        {row.cells.map((c, i) => {
                          const key = BWIN_ORDER[i];
                          if (c.received === 0) return <td key={key} style={{ ...tdR, color: '#C8C0A6' }}>—</td>;
                          if (c.received < MIN_CELL_BOOKINGS) return <td key={key} style={{ ...tdR, color: '#8A8A8A' }} title={`${c.cancels}/${c.received}`}>·</td>;
                          const rate = (c.cancels / c.received) * 100;
                          const dPP = rate - overallRate;
                          const bg = dPP > 8  ? '#F5D9D5'
                                   : dPP > 3  ? '#FBEDD8'
                                   : dPP < -8 ? '#D8E9DA'
                                   : dPP < -3 ? '#E8F0DE'
                                              : 'transparent';
                          const color = dPP > 3 ? '#8A2419' : dPP < -3 ? '#1F5C2C' : '#1B1B1B';
                          return (
                            <td key={key} style={{ ...tdR, background: bg, color, fontWeight: dPP > 8 || dPP < -8 ? 600 : 500 }} title={`${c.cancels}/${c.received} bookings`}>
                              {rate.toFixed(0)}%
                            </td>
                          );
                        })}
                        <td style={{ ...tdR, background: '#FAF8F1', fontWeight: 600 }} title={`${row.total.cancels}/${row.total.received}`}>{overall.toFixed(0)}%</td>
                      </tr>
                    );
                  })}
                  <tr style={{ borderTop: '2px solid #BDBDBD', background: '#FAFAF7', fontWeight: 700 }}>
                    <td style={tdL}>Column total</td>
                    {xtabColTotals.map((c, i) => {
                      const key = BWIN_ORDER[i];
                      const rate = c.received > 0 ? (c.cancels / c.received) * 100 : 0;
                      return (
                        <td key={key} style={{ ...tdR, fontWeight: 700 }} title={`${c.cancels}/${c.received}`}>
                          {c.received > 0 ? `${rate.toFixed(0)}%` : '—'}
                        </td>
                      );
                    })}
                    <td style={{ ...tdR, background: '#FAF8F1', fontWeight: 700 }}>{overallRate.toFixed(0)}%</td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}
        </Container>
      </div>

      {/* Two-column tables · country + room */}
      <div style={{ gridColumn: '1 / -1', display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 10 }}>
        <BreakdownTable title="By country" rows={byCountry.slice(0, 12)} totalCount={cxlCount} />
        <BreakdownTable title="By room type" rows={byRoom} totalCount={cxlCount} />
      </div>

      {/* Two-column tables · LOS + segment */}
      <div style={{ gridColumn: '1 / -1', display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 10 }}>
        <BreakdownTable title="By length of stay" rows={byLos} totalCount={cxlCount} />
        <BreakdownTable title="By market segment" rows={bySegment} totalCount={cxlCount} />
      </div>

      {/* Recent cancellations list */}
      <div style={{ gridColumn: '1 / -1' }}>
        <Container title={`Recent cancellations · ${Math.min(rows.length, 30)} of ${rows.length}`} subtitle="most recent first · lost value from per-night rate" density="compact">
          {rows.length === 0 ? (
            <div style={{ padding: '10px 12px', fontSize: 12, color: '#5A5A5A', fontStyle: 'italic' }}>No cancellations in window.</div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid #E6DFCC' }}>
                    <th style={th}>Cancelled</th>
                    <th style={th}>For CI</th>
                    <th style={{ ...th, textAlign: 'right' }}>DTA</th>
                    <th style={th}>Source</th>
                    <th style={th}>Country</th>
                    <th style={th}>Room</th>
                    <th style={{ ...th, textAlign: 'right' }}>LOS</th>
                    <th style={{ ...th, textAlign: 'right' }}>Lost $</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.slice(0, 30).map((r) => (
                    <tr key={r.reservation_id} style={{ borderTop: '1px solid #E6DFCC' }}>
                      <td style={tdL}>{r.cancellation_date?.slice(0, 10)}</td>
                      <td style={tdL}>{r.check_in_date?.slice(0, 10)}</td>
                      <td style={tdR}>{r.days_to_arrival ?? '—'}</td>
                      <td style={tdL}>{r.source_name}</td>
                      <td style={tdL}>{r.guest_country ?? '—'}</td>
                      <td style={tdL}>{r.room_type_name}</td>
                      <td style={tdR}>{r.nights}</td>
                      <td style={tdR}>{r.lost_revenue > 0 ? fmt$(r.lost_revenue) : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Container>
      </div>
    </DashboardPage>
  );
}

function BreakdownTable({ title, rows, totalCount }: { title: string; rows: Array<[string, { count: number; lostRev: number; lostRn: number }]>; totalCount: number }) {
  return (
    <Container title={`${title} · ${rows.length}`} subtitle={`cancels · lost $ · lost RN · share`} density="compact">
      {rows.length === 0 ? (
        <div style={{ padding: '10px 12px', fontSize: 12, color: '#5A5A5A', fontStyle: 'italic' }}>No data.</div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #E6DFCC' }}>
                <th style={th}>Bucket</th>
                <th style={{ ...th, textAlign: 'right' }}>Cancels</th>
                <th style={{ ...th, textAlign: 'right' }}>Lost $</th>
                <th style={{ ...th, textAlign: 'right' }}>Lost RN</th>
                <th style={{ ...th, textAlign: 'right' }}>Share</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(([k, v]) => (
                <tr key={k} style={{ borderTop: '1px solid #E6DFCC' }}>
                  <td style={tdL}>{k}</td>
                  <td style={tdR}>{v.count}</td>
                  <td style={tdR}>{v.lostRev > 0 ? `$${Math.round(v.lostRev).toLocaleString('en-US')}` : '—'}</td>
                  <td style={tdR}>{v.lostRn}</td>
                  <td style={tdR}>{totalCount > 0 ? `${((v.count / totalCount) * 100).toFixed(1)}%` : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Container>
  );
}

function losOrder(b: string): number { return ['1n','2-3n','4-7n','8+n'].indexOf(b); }
function dtaOrder(b: string): number { return ['0-1d','2-7d','8-30d','31-90d','90+d'].indexOf(b); }

function pillStyle(active: boolean): React.CSSProperties {
  return {
    fontFamily: 'inherit',
    fontSize: 11,
    padding: '4px 10px',
    borderRadius: 99,
    border: `1px solid ${active ? '#1F3A2E' : '#E6DFCC'}`,
    background: active ? '#1F3A2E' : '#FFFFFF',
    color: active ? '#FFFFFF' : '#5A5A5A',
    fontWeight: active ? 600 : 500,
    textDecoration: 'none',
  };
}

const th: React.CSSProperties = { padding: '6px 10px', fontSize: 10, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#000', textAlign: 'left' };
const tdL: React.CSSProperties = { padding: '5px 10px', fontSize: 12, color: '#1B1B1B', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 220 };
const tdR: React.CSSProperties = { padding: '5px 10px', fontSize: 12, textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: '#1B1B1B' };
