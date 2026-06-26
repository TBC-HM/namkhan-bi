// app/revenue/pace/page.tsx
// TRIAL refactor (brief: refactor-revenue-pace-to-primitives).
// Visual blocks now composed exclusively from @/app/(cockpit)/_design.
// Data fetchers + period/granularity logic are UNCHANGED — same v_otb_pace,
// v_pace_curve, mv_kpi_daily reads; same resolvePeriod / capacityRnRange.
//
// PRIMITIVE GAP noted for pair-Claude:
//   <Chart formatY={(v) => ...}> is a function prop. Because Chart is a
//   'use client' primitive and this page is a server component, passing a
//   function across the boundary throws "Functions cannot be passed to
//   Client Components from Server Components" at runtime. Worked around
//   below by pre-formatting numeric data into string columns and dropping
//   formatY. Recommend Chart accept a string enum (e.g. valueAxisFormat:
//   'integer' | 'percent' | 'currency') alongside formatY so server pages
//   can opt into common formats without crossing the boundary.

import {
  DashboardPage,
  Container,
  KpiTile,
  Chart,
  type ChartSeries,
  type DashboardTab,
  type KpiTileProps,
} from '@/app/(cockpit)/_design';
import Link from 'next/link';
import { supabase, PROPERTY_ID } from '@/lib/supabase';
import { resolvePeriod, type WindowKey } from '@/lib/period';
import { capacityFor, capacityRnRange } from '@/lib/capacity';
import { getPaceCurve } from '@/lib/pulseData';
import { getPaceOtb } from '@/lib/data';
import { REVENUE_SUBPAGES } from '../_subpages';

export const dynamic = 'force-dynamic';
export const revalidate = 60;

interface PaceRow {
  night_date: string;
  confirmed_rooms: number;
  confirmed_revenue: number;
  cancelled_rooms: number;
}

interface SearchParams { win?: string; gran?: string; cmp?: string }

const VALID_FWD: WindowKey[] = ['next7', 'next30', 'next90', 'next180', 'next365'];

function parseWin(raw: string | undefined): WindowKey {
  return (VALID_FWD.includes(raw as WindowKey) ? raw : 'next90') as WindowKey;
}
function parseGran(raw: string | undefined): 'day' | 'week' | 'month' {
  if (raw === 'day' || raw === 'week' || raw === 'month') return raw;
  return 'month';
}

async function getPace(fromDate: string, toDate: string, pid: number): Promise<PaceRow[]> {
  const { data, error } = await supabase
    .from('v_otb_pace')
    .select('night_date, confirmed_rooms, confirmed_revenue, cancelled_rooms')
    .eq('property_id', pid)
    .gte('night_date', fromDate)
    .lte('night_date', toDate)
    .order('night_date');
  if (error) { console.error('[pace] error', error); return []; }
  return (data ?? []) as PaceRow[];
}

async function getStlyActuals(fromDate: string, toDate: string, pid: number): Promise<Map<string, { rns: number; rev: number }>> {
  const shift = (iso: string) => {
    const d = new Date(iso + 'T00:00:00Z');
    d.setUTCFullYear(d.getUTCFullYear() - 1);
    return d.toISOString().slice(0, 10);
  };
  const { data } = await supabase
    .from('mv_kpi_daily')
    .select('night_date, rooms_sold, rooms_revenue')
    .eq('property_id', pid)
    .gte('night_date', shift(fromDate))
    .lte('night_date', shift(toDate));
  const out = new Map<string, { rns: number; rev: number }>();
  for (const r of ((data ?? []) as Array<{ night_date: string; rooms_sold: number | null; rooms_revenue: number | null }>)) {
    out.set(String(r.night_date), { rns: Number(r.rooms_sold ?? 0), rev: Number(r.rooms_revenue ?? 0) });
  }
  return out;
}

interface BucketRow {
  key: string; rns: number; rev: number; cxl: number; days: number; capacity: number; stlyRn: number; stlyRev: number;
}

function bucketRows(
  rows: PaceRow[],
  gran: 'day' | 'week' | 'month',
  stlyByDate: Map<string, { rns: number; rev: number }>,
  fromIso: string,
  toIso: string,
  pid: number,
): BucketRow[] {
  const buckets = new Map<string, { rns: number; rev: number; cxl: number; days: number; stlyRn: number; stlyRev: number }>();
  for (const r of rows) {
    const d = new Date(r.night_date);
    let key: string;
    if (gran === 'month') key = r.night_date.slice(0, 7);
    else if (gran === 'week') {
      const dow = d.getUTCDay();
      const diff = (dow + 6) % 7;
      const monday = new Date(d.getTime() - diff * 86400000);
      key = monday.toISOString().slice(0, 10);
    } else key = r.night_date;
    const cur = buckets.get(key) ?? { rns: 0, rev: 0, cxl: 0, days: 0, stlyRn: 0, stlyRev: 0 };
    cur.rns += Number(r.confirmed_rooms) || 0;
    cur.rev += Number(r.confirmed_revenue) || 0;
    cur.cxl += Number(r.cancelled_rooms) || 0;
    cur.days += 1;
    const shifted = (() => {
      const t = new Date(r.night_date + 'T00:00:00Z');
      t.setUTCFullYear(t.getUTCFullYear() - 1);
      return t.toISOString().slice(0, 10);
    })();
    const stly = stlyByDate.get(shifted);
    if (stly) { cur.stlyRn += stly.rns; cur.stlyRev += stly.rev; }
    buckets.set(key, cur);
  }
  return Array.from(buckets.entries()).map(([key, v]) => {
    let cap = 0;
    if (gran === 'month') {
      const monthStart = key + '-01';
      const next = new Date(key + '-01T00:00:00Z'); next.setUTCMonth(next.getUTCMonth() + 1);
      const monthEnd = new Date(next.getTime() - 86400000).toISOString().slice(0, 10);
      const winFrom = monthStart < fromIso ? fromIso : monthStart;
      const winTo = monthEnd > toIso ? toIso : monthEnd;
      cap = capacityRnRange(winFrom, winTo, pid);
    } else if (gran === 'week') {
      const winFrom = key < fromIso ? fromIso : key;
      const weekEnd = new Date(key + 'T00:00:00Z'); weekEnd.setUTCDate(weekEnd.getUTCDate() + 6);
      const weTo = weekEnd.toISOString().slice(0, 10) > toIso ? toIso : weekEnd.toISOString().slice(0, 10);
      cap = capacityRnRange(winFrom, weTo, pid);
    } else {
      cap = capacityFor(key, pid);
    }
    return { key, ...v, capacity: cap };
  }).sort((a, b) => a.key.localeCompare(b.key));
}

function fmtMonth(yyyymm: string) {
  const [y, m] = yyyymm.split('-');
  const d = new Date(Number(y), Number(m) - 1, 1);
  return d.toLocaleString('en-US', { month: 'short', year: '2-digit' });
}

interface PaceCurvePoint {
  day?: string;
  stay_date?: string;
  rooms_actual?: number | null;
  rooms_otb?: number | null;
  rooms_stly_daily_avg?: number | null;
  rooms_budget_daily_avg?: number | null;
}

export default async function PacePage({
  searchParams,
  propertyId,
}: {
  searchParams: SearchParams;
  propertyId?: number;
}) {
  const pid = propertyId ?? PROPERTY_ID;
  const PROPERTY_ID_DONNA = 1000001;
  const sym: string = pid === PROPERTY_ID_DONNA ? '€' : '$';
  const moneyCurrency: 'USD' | 'EUR' = pid === PROPERTY_ID_DONNA ? 'EUR' : 'USD';
  const win = parseWin(searchParams.win);
  const gran = parseGran(searchParams.gran);
  const period = resolvePeriod({ win, cmp: searchParams.cmp });
  const fromIso = period.from;
  const toIso = period.to;

  // PBS #200: pull totals from the same source /demand uses (mv_pace_otb via getPaceOtb) so the KPI tile MATCHES /demand's "OTB Revenue".
  const [rows, stlyMap, paceCurveRaw, demandRows] = await Promise.all([
    getPace(fromIso, toIso, pid),
    getStlyActuals(fromIso, toIso, pid),
    getPaceCurve(30, 30, pid).catch(() => []),
    getPaceOtb(period, pid).catch(() => [] as Array<Record<string, unknown>>),
  ]);

  // #106: pace by check-in month — separate fetch from public.v_pace_by_ci_month (Jan-2025 onwards, with LY pair)
  const paceCiMonthRes = await supabase
    .from('v_pace_by_ci_month')
    .select('ci_month, ci_month_start, ci_year, ci_mm, room_nights, revenue, rooms_revenue, adr, ly_room_nights, ly_revenue, ly_rooms_revenue, ly_adr, rn_var_pct, rev_var_pct')
    .eq('property_id', pid)
    .order('ci_month', { ascending: true });
  const paceCiMonthRows = ((paceCiMonthRes.data ?? []) as Array<{
    ci_month: string; ci_month_start: string; ci_year: number; ci_mm: number;
    room_nights: number; revenue: number; rooms_revenue: number; adr: number | null;
    ly_room_nights: number | null; ly_revenue: number | null; ly_rooms_revenue: number | null; ly_adr: number | null;
    rn_var_pct: number | null; rev_var_pct: number | null;
  }>);
  // Aggregate /demand-equivalent totals (ci_month grain)
  const demandTotal = (demandRows as Array<{ otb_roomnights: number; otb_revenue: number; stly_roomnights: number; stly_revenue: number }>).reduce(
    (s, r) => ({ otb: s.otb + Number(r.otb_roomnights || 0), rev: s.rev + Number(r.otb_revenue || 0), stly: s.stly + Number(r.stly_roomnights || 0), stlyRev: s.stlyRev + Number(r.stly_revenue || 0) }),
    { otb: 0, rev: 0, stly: 0, stlyRev: 0 },
  );

  const totalRns = rows.reduce((s, r) => s + (Number(r.confirmed_rooms) || 0), 0);
  const totalRev = rows.reduce((s, r) => s + (Number(r.confirmed_revenue) || 0), 0);
  const totalCxl = rows.reduce((s, r) => s + (Number(r.cancelled_rooms) || 0), 0);
  const adr = totalRns > 0 ? totalRev / totalRns : 0;
  const capacityRn = capacityRnRange(fromIso, toIso, pid);
  const occ = capacityRn > 0 ? (totalRns / capacityRn) * 100 : 0;
  const cxlRate = totalRns + totalCxl > 0 ? (totalCxl / (totalRns + totalCxl)) * 100 : 0;

  const buckets = bucketRows(rows, gran, stlyMap, fromIso, toIso, pid);
  const stlyRnTotal = buckets.reduce((s, b) => s + b.stlyRn, 0);
  const stlyRevTotal = buckets.reduce((s, b) => s + b.stlyRev, 0);
  const stlyPctOverall = stlyRnTotal > 0 ? (totalRns / stlyRnTotal) * 100 : 0;
  const cmpActive = period.cmp !== 'none' && stlyRnTotal > 0;
  const cmpLabel = period.cmpLabel ? period.cmpLabel.replace(/^vs\s+/i, '') : 'STLY';

  const pctChange = (cur: number, base: number) => (base > 0 ? ((cur - base) / base) * 100 : 0);
  const stlyAdr = stlyRnTotal > 0 ? stlyRevTotal / stlyRnTotal : 0;
  const stlyOcc = capacityRn > 0 ? (stlyRnTotal / capacityRn) * 100 : 0;

  // PBS 2026-06-08 — window-correct: when window is sub-month (7d / 30d), demandTotal.otb (whole-month from mv_pace_otb) over-counts the numerator, so OCC = 106/168 looked like 63.1% on 7d. Use totalRns/totalRev which are summed from v_otb_pace for the actual window.
  const tileRns  = totalRns;
  const tileRev  = totalRev;
  const tileStly = stlyRnTotal;
  const tileStlyRev = stlyRevTotal;
  const tileAdr  = tileRns > 0 ? tileRev / tileRns : 0;
  const tileStlyAdr = tileStly > 0 ? tileStlyRev / tileStly : 0;
  const tileOcc  = capacityRn > 0 ? (tileRns / capacityRn) * 100 : 0;
  const tileStlyOcc = capacityRn > 0 ? (tileStly / capacityRn) * 100 : 0;
  const tileStlyPct = tileStly > 0 ? (tileRns / tileStly) * 100 : 0;
  const tiles: KpiTileProps[] = [
    {
      label: 'OTB Room Nights', value: tileRns, size: 'sm',
      delta: cmpActive && tileStly > 0 ? { value: pctChange(tileRns, tileStly), period: cmpLabel,
        direction: tileRns >= tileStly ? 'up' : 'down' } : undefined,
      footnote: period.label,
    },
    {
      label: 'OTB Revenue', value: tileRev, currency: moneyCurrency, size: 'sm',
      delta: cmpActive && tileStlyRev > 0 ? { value: pctChange(tileRev, tileStlyRev), period: cmpLabel,
        direction: tileRev >= tileStlyRev ? 'up' : 'down' } : undefined,
      footnote: period.label,
    },
    {
      label: 'OTB ADR', value: Math.round(tileAdr), currency: moneyCurrency, size: 'sm',
      delta: cmpActive && tileStlyAdr > 0 ? { value: pctChange(tileAdr, tileStlyAdr), period: cmpLabel,
        direction: tileAdr >= tileStlyAdr ? 'up' : 'down' } : undefined,
    },
    {
      label: 'OTB Occupancy', value: `${tileOcc.toFixed(1)}%`, size: 'sm',
      delta: cmpActive && tileStly > 0 ? { value: tileOcc - tileStlyOcc, period: cmpLabel,
        direction: tileOcc >= tileStlyOcc ? 'up' : 'down' } : undefined,
    },
    { label: 'Cancel Rate', value: `${cxlRate.toFixed(1)}%`, size: 'sm', footnote: 'cancelled / total reservations' },
    { label: 'vs STLY', value: `${tileStlyPct.toFixed(0)}%`, size: 'sm', status: tileStlyPct >= 100 ? 'green' : tileStlyPct >= 80 ? 'amber' : 'red' },
  ];

  // ─── data prep (no functions cross server→client boundary) ─────────────
  // note#11: shorten x-axis labels (MM-DD on daily, "MMM yy" on monthly) to stop date overlap
  const paceCurveData = (paceCurveRaw as PaceCurvePoint[]).map((r) => {
    const raw = (r.day ?? r.stay_date ?? '').slice(0, 10);
    const short = raw.length >= 10
      ? (gran === 'month' ? raw.slice(0, 7) : raw.slice(5))
      : raw;
    return {
      day:    short,
      actual: r.rooms_actual ?? null,
      otb:    r.rooms_otb ?? null,
      stly:   r.rooms_stly_daily_avg ?? null,
      budget: r.rooms_budget_daily_avg ?? null,
    };
  });
  const paceSeries: ChartSeries[] = [
    { key: 'actual', label: 'Actual', color: '#1F3A2E' },
    { key: 'otb',    label: 'OTB',    color: '#B8A878' },
    { key: 'stly',   label: 'STLY',   color: '#5A5A5A' },
    { key: 'budget', label: 'Budget', color: '#B8542A' },
  ];

  const formatLabel = (key: string) => (gran === 'month' ? fmtMonth(key) : key.slice(5));
  // note#12: combined OTB + STLY overlay — one bar per bucket with both rns + stly_pct
  const bucketBar = buckets.map((b) => ({
    bucket: formatLabel(b.key),
    rns: b.rns,
    stly_pct: b.stlyRn > 0 ? Math.round((b.rns / b.stlyRn) * 100) : null,
  }));
  // kept for backwards-compat / table only — not used in JSX anymore
  const stlyBar = buckets
    .filter((b) => b.stlyRn > 0)
    .map((b) => ({ bucket: formatLabel(b.key), stly_pct: Math.round((b.rns / b.stlyRn) * 100) }));
  // Pre-format numeric table cells (Chart variant='table' is in a client comp
  // — formatY can't cross the boundary, so we format here).
  const bucketTable = buckets.map((b) => ({
    bucket:   formatLabel(b.key),
    rns:      b.rns.toLocaleString('en-US'),
    rev:      `${sym}${Math.round(b.rev).toLocaleString('en-US')}`,
    occ:      b.capacity > 0 ? `${((b.rns / b.capacity) * 100).toFixed(1)}%` : '—',
    cxl:      b.cxl,
    stly_pct: b.stlyRn > 0 ? `${Math.round((b.rns / b.stlyRn) * 100)}%` : '—',
  }));

  const basePath = propertyId ? `/h/${propertyId}/revenue` : '/revenue';
  const tabs: DashboardTab[] = REVENUE_SUBPAGES.map((s) => {
    const href = propertyId && (s.href.startsWith('/revenue/') || s.href === '/revenue')
      ? s.href.replace(/^\/revenue/, basePath)
      : s.href;
    return { key: s.href, label: s.label, href, active: s.href.endsWith('/pace') };
  });

  const granOptions: Array<{ k: 'day' | 'week' | 'month'; label: string }> = [
    { k: 'day', label: 'Day' }, { k: 'week', label: 'Week' }, { k: 'month', label: 'Month' },
  ];
  const winOptions: Array<{ k: WindowKey; label: string }> = [
    { k: 'next7', label: '7d' }, { k: 'next30', label: '30d' }, { k: 'next90', label: '90d' },
    { k: 'next180', label: '180d' }, { k: 'next365', label: '365d' },
  ];
  const hrefFor = (overrides: { win?: WindowKey; gran?: 'day' | 'week' | 'month' }) => {
    const params = new URLSearchParams();
    const nextWin = overrides.win ?? win;
    const nextGran = overrides.gran ?? gran;
    if (nextWin !== 'next90') params.set('win', nextWin);
    if (nextGran !== 'month') params.set('gran', nextGran);
    if (period.cmp && period.cmp !== 'none') params.set('cmp', period.cmp);
    const qs = params.toString();
    return `${basePath}/pace${qs ? '?' + qs : ''}`;
  };

  return (
    <DashboardPage
      title="Revenue · Pace"
      subtitle={`What's on the books ahead. ${period.label}.`}
      tabs={tabs}
    >
      {/* PBS #188 (2026-05-24): KPI stripe at the top is a raw row — NOT a Container box.
          Controls (Forward window · Granularity) sit on row 1, KPI tiles on row 2. */}
      <div style={{ gridColumn: '1 / -1', display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center', marginBottom: 8 }}>
        <ControlGroup label="Forward window">
          {winOptions.map((o) => (
            <PillLink key={o.k} active={o.k === win} href={hrefFor({ win: o.k })}>{o.label}</PillLink>
          ))}
        </ControlGroup>
        <ControlGroup label="Granularity">
          {granOptions.map((o) => (
            <PillLink key={o.k} active={o.k === gran} href={hrefFor({ gran: o.k })}>{o.label}</PillLink>
          ))}
        </ControlGroup>
        <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--ink-soft, #5A5A5A)' }}>{period.label}</span>
      </div>
      <div style={{ gridColumn: '1 / -1', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 12, marginBottom: 4 }}>
        {tiles.map((t, i) => <KpiTile key={i} {...t} />)}
      </div>

      <div style={{ gridColumn: '1 / -1', display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 10, alignItems: 'stretch' }}>
      <Container title="Booking pace curve" subtitle="Daily rooms occupied · −30d to +30d window">
        <Chart
          variant="line"
          data={paceCurveData}
          xKey="day"
          series={paceSeries}
          height={240}
          empty={{ title: 'No pace-curve data', hint: 'v_pace_curve returned 0 rows for this property' }}
        />
      </Container>

      <Container title="OTB by stay-bucket · with STLY % overlay" subtitle={`Forward-only · TY counts only nights ≥ today (so current month is partial — use /demand Pace table for whole-month totals) · Bars = TY confirmed RN · Line = TY ÷ STLY at same lead time · per ${gran}`}>
        <Chart
          variant="combo"
          data={bucketBar}
          xKey="bucket"
          series={[
            { key: 'rns',      label: 'Rooms',  color: '#1F3A2E', yAxisId: 'left',  type: 'bar' },
            { key: 'stly_pct', label: 'STLY %', color: '#B8A878', yAxisId: 'right', type: 'line' },
          ]}
          height={260}
          empty={{ title: 'No on-the-books in this window' }}
        />
      </Container>

      <Container title={`Pace by stay-bucket · ${buckets.length} ${gran}${buckets.length === 1 ? '' : 's'}`} subtitle={`forward-only · from today onward · for current month, only nights ≥ today are counted (use /demand Pace table for whole-month totals) · grouped per ${gran}`}>
        <Chart
          variant="table"
          data={bucketTable}
          xKey="bucket"
          series={[
            { key: 'rns',      label: 'RNs' },
            { key: 'rev',      label: 'Revenue' },
            { key: 'occ',      label: 'Occ %' },
            { key: 'cxl',      label: 'Cxl' },
            { key: 'stly_pct', label: 'STLY %' },
          ]}
        />
      </Container>
      </div>
      {/* #106 — Pace by check-in month (Jan-2025 → forward); RN bar + LY overlay + variance table */}
      <div style={{ gridColumn: '1 / -1', marginTop: 8 }}>
        <Container title="Pace by check-in month · Room Nights" subtitle={`Source: gl.pl_section_monthly section=income (matches /finance/pnl, ${moneyCurrency}) · falls back to PMS reservation total for future periods without GL coverage · RN = night-stayed (rooms_sold per month) · variance vs LY · click a year to expand`}>
          {paceCiMonthRows.length === 0 ? (
            <div style={{ padding: 14, fontSize: 12, color: 'var(--ink-soft, #5A5A5A)', fontStyle: 'italic' }}>
              No data on file for property {pid}.
            </div>
          ) : (
            <div style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 12 }}>
              <Chart variant="bar" data={paceCiMonthRows.map((r) => ({
                month: r.ci_month,
                rn:    Number(r.room_nights ?? 0),
                ly_rn: Number(r.ly_room_nights ?? 0),
              }))} xKey="month"
                series={[
                  { key: 'rn',    label: 'Room Nights',    color: 'var(--primary, #1F3A2E)' },
                  { key: 'ly_rn', label: 'LY Room Nights', color: 'var(--hairline, #C8C0A6)' },
                ]}
                height={220}
                empty={{ title: 'No pace data' }} />
              {(() => {
                const curY = new Date().getUTCFullYear();
                // PBS 2026-06-19 #236: include current+future years even if no rows yet (e.g. 2027 = all 12 months even if 0)
                const allYears = new Set(paceCiMonthRows.map((r) => String(r.ci_month).slice(0, 4)));
                allYears.add(String(curY));
                allYears.add(String(curY + 1));
                return Array.from(allYears).sort();
              })().map((yr) => {
              const curY = new Date().getUTCFullYear();
              const yearRowsRaw = paceCiMonthRows.filter((r) => String(r.ci_month).startsWith(yr));
              // For current+future years, pad to all 12 months so future planning shows the full year
              const yearRows = Number(yr) >= curY
                ? Array.from({ length: 12 }, (_, i) => {
                    const mm = String(i + 1).padStart(2, '0');
                    const ci = yr + '-' + mm;
                    const found = yearRowsRaw.find((r) => r.ci_month === ci);
                    return found ?? {
                      ci_month: ci, ci_month_start: ci + '-01', ci_year: Number(yr), ci_mm: i + 1,
                      room_nights: 0, revenue: 0, rooms_revenue: 0, adr: null,
                      ly_room_nights: null, ly_revenue: null, ly_rooms_revenue: null, ly_adr: null,
                      rn_var_pct: null, rev_var_pct: null,
                    } as typeof yearRowsRaw[number];
                  })
                : yearRowsRaw;
              const sumRn         = yearRows.reduce((s, r) => s + Number(r.room_nights ?? 0), 0);
              const sumLyRn       = yearRows.reduce((s, r) => s + Number(r.ly_room_nights ?? 0), 0);
              const sumRev        = yearRows.reduce((s, r) => s + Number(r.revenue ?? 0), 0);
              const sumLyRev      = yearRows.reduce((s, r) => s + Number(r.ly_revenue ?? 0), 0);
              const sumRoomsRev   = yearRows.reduce((s, r) => s + Number(r.rooms_revenue ?? 0), 0);
              const sumLyRoomsRev = yearRows.reduce((s, r) => s + Number(r.ly_rooms_revenue ?? 0), 0);
              const totalAdr      = sumRn   > 0 ? sumRoomsRev   / sumRn   : null;
              const totalLyAdr    = sumLyRn > 0 ? sumLyRoomsRev / sumLyRn : null;
              const rnPct   = sumLyRn  > 0 ? ((sumRn  - sumLyRn ) / sumLyRn ) * 100 : null;
              const revPct  = sumLyRev > 0 ? ((sumRev - sumLyRev) / sumLyRev) * 100 : null;
              const curY    = new Date().getUTCFullYear();
              const openByDefault = Number(yr) >= curY;
              const sumPctStyle = (p: number | null): React.CSSProperties => p == null ? {} : { color: p > 0 ? 'var(--status-green, #2E7D32)' : p < 0 ? 'var(--terracotta, #B8542A)' : 'var(--ink-soft, #5A5A5A)', fontWeight: 600 };
              return (
                <details key={yr} open={openByDefault} style={{ border: '1px solid #E0E0E0', borderRadius: 4, background: 'var(--paper, #FFFFFF)' }}>
                  <summary style={{ cursor: 'pointer', padding: '8px 12px', fontSize: 12, color: 'var(--ink, #1B1B1B)', background: '#FFFFFF', borderBottom: '2px solid #BDBDBD' }}>
                    <strong style={{ marginRight: 12 }}>{yr}</strong>
                    <span style={{ color: 'var(--ink-soft, #5A5A5A)' }}>{yearRows.length} mo</span>
                    <span style={{ marginLeft: 12 }}>RN {sumRn.toLocaleString('en-US')}</span>
                    {rnPct != null && <span style={{ marginLeft: 6, ...sumPctStyle(rnPct) }}>({rnPct > 0 ? '+' : ''}{rnPct.toFixed(1)}%)</span>}
                    <span style={{ marginLeft: 12 }}>Total Revenue {sym}{Math.round(sumRev).toLocaleString('en-US')}</span>
                    {revPct != null && <span style={{ marginLeft: 6, ...sumPctStyle(revPct) }}>({revPct > 0 ? '+' : ''}{revPct.toFixed(1)}%)</span>}
                  </summary>
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                      <thead>
                        <tr style={{ background: '#FFFFFF' }}>
                      <th style={{ padding: '5px 10px', textAlign: 'left', fontSize: 10, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--ink-soft, #5A5A5A)', borderBottom: '2px solid #BDBDBD' }}>Month</th>
                      <th style={{ padding: '5px 10px', textAlign: 'right', fontSize: 10, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--ink-soft, #5A5A5A)', borderBottom: '2px solid #BDBDBD' }}>RN</th>
                      <th style={{ padding: '5px 10px', textAlign: 'right', fontSize: 10, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--ink-soft, #5A5A5A)', borderBottom: '2px solid #BDBDBD' }}>LY RN</th>
                      <th style={{ padding: '5px 10px', textAlign: 'right', fontSize: 10, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--ink-soft, #5A5A5A)', borderBottom: '2px solid #BDBDBD' }}>RN var %</th>
                      <th style={{ padding: '5px 10px', textAlign: 'right', fontSize: 10, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--ink-soft, #5A5A5A)', borderBottom: '2px solid #BDBDBD' }}>ADR</th>
                      <th style={{ padding: '5px 10px', textAlign: 'right', fontSize: 10, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--ink-soft, #5A5A5A)', borderBottom: '2px solid #BDBDBD' }}>LY ADR</th>
                      <th style={{ padding: '5px 10px', textAlign: 'right', fontSize: 10, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--ink-soft, #5A5A5A)', borderBottom: '2px solid #BDBDBD' }}>Room Rev</th>
                      <th style={{ padding: '5px 10px', textAlign: 'right', fontSize: 10, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--ink-soft, #5A5A5A)', borderBottom: '2px solid #BDBDBD' }}>LY Room Rev</th>
                      <th style={{ padding: '5px 10px', textAlign: 'right', fontSize: 10, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--ink-soft, #5A5A5A)', borderBottom: '2px solid #BDBDBD' }}>Total Revenue</th>
                      <th style={{ padding: '5px 10px', textAlign: 'right', fontSize: 10, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--ink-soft, #5A5A5A)', borderBottom: '2px solid #BDBDBD' }}>LY Total Revenue</th>
                      <th style={{ padding: '5px 10px', textAlign: 'right', fontSize: 10, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--ink-soft, #5A5A5A)', borderBottom: '2px solid #BDBDBD' }}>Rev var %</th>
                    </tr>
                      </thead>
                      <tbody>
                        {yearRows.map((r) => {
                      const rnVar = r.rn_var_pct == null ? null : Number(r.rn_var_pct);
                      const revVar = r.rev_var_pct == null ? null : Number(r.rev_var_pct);
                      const rnColor = rnVar == null ? 'var(--ink-soft, #5A5A5A)' : rnVar > 0 ? 'var(--status-green, #2E7D32)' : rnVar < 0 ? 'var(--terracotta, #B8542A)' : 'var(--ink-soft, #5A5A5A)';
                      const revColor = revVar == null ? 'var(--ink-soft, #5A5A5A)' : revVar > 0 ? 'var(--status-green, #2E7D32)' : revVar < 0 ? 'var(--terracotta, #B8542A)' : 'var(--ink-soft, #5A5A5A)';
                      const tdN: React.CSSProperties = { padding: '4px 10px', fontSize: 11, color: 'var(--ink, #1B1B1B)', textAlign: 'right', fontVariantNumeric: 'tabular-nums', borderTop: '1px solid #E0E0E0' };
                      return (
                        <tr key={r.ci_month}>
                          <td style={{ padding: '4px 10px', fontSize: 11, color: 'var(--ink, #1B1B1B)', borderTop: '1px solid #E0E0E0' }}>{r.ci_month}</td>
                          <td style={tdN}>{Number(r.room_nights ?? 0).toLocaleString('en-US')}</td>
                          <td style={tdN}>{r.ly_room_nights == null ? '—' : Number(r.ly_room_nights).toLocaleString('en-US')}</td>
                          <td style={{ ...tdN, color: rnColor, fontWeight: 600 }}>{rnVar == null ? '—' : `${rnVar > 0 ? '+' : ''}${rnVar.toFixed(1)}%`}</td>
                          <td style={tdN}>{r.adr == null ? '—' : `${sym}${Math.round(Number(r.adr)).toLocaleString('en-US')}`}</td>
                          <td style={tdN}>{r.ly_adr == null ? '—' : `${sym}${Math.round(Number(r.ly_adr)).toLocaleString('en-US')}`}</td>
                          <td style={tdN}>{sym}{Math.round(Number(r.rooms_revenue ?? 0)).toLocaleString('en-US')}</td>
                          <td style={tdN}>{r.ly_rooms_revenue == null ? '—' : `${sym}${Math.round(Number(r.ly_rooms_revenue)).toLocaleString('en-US')}`}</td>
                          <td style={tdN}>{sym}{Math.round(Number(r.revenue ?? 0)).toLocaleString('en-US')}</td>
                          <td style={tdN}>{r.ly_revenue == null ? '—' : `${sym}${Math.round(Number(r.ly_revenue)).toLocaleString('en-US')}`}</td>
                          <td style={{ ...tdN, color: revColor, fontWeight: 600 }}>{revVar == null ? '—' : `${revVar > 0 ? '+' : ''}${revVar.toFixed(1)}%`}</td>
                        </tr>
                      );
                    })}
                        {/* PBS 2026-06-19 #236: sum row */}
                        <tr style={{ background: '#FAFAF7', borderTop: '2px solid #BDBDBD', fontWeight: 700 }}>
                          <td style={{ padding: '5px 10px', fontSize: 11, color: 'var(--ink, #1B1B1B)' }}>TOTAL</td>
                          <td style={{ padding: '5px 10px', fontSize: 11, color: 'var(--ink, #1B1B1B)', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{sumRn.toLocaleString('en-US')}</td>
                          <td style={{ padding: '5px 10px', fontSize: 11, color: 'var(--ink, #1B1B1B)', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{sumLyRn > 0 ? sumLyRn.toLocaleString('en-US') : '—'}</td>
                          <td style={{ padding: '5px 10px', fontSize: 11, color: 'var(--ink, #1B1B1B)', textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontWeight: 700, ...sumPctStyle(rnPct) }}>{rnPct == null ? '—' : `${rnPct > 0 ? '+' : ''}${rnPct.toFixed(1)}%`}</td>
                          <td style={{ padding: '5px 10px', fontSize: 11, color: 'var(--ink, #1B1B1B)', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{totalAdr == null ? '—' : `${sym}${Math.round(totalAdr).toLocaleString('en-US')}`}</td>
                          <td style={{ padding: '5px 10px', fontSize: 11, color: 'var(--ink, #1B1B1B)', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{totalLyAdr == null ? '—' : `${sym}${Math.round(totalLyAdr).toLocaleString('en-US')}`}</td>
                          <td style={{ padding: '5px 10px', fontSize: 11, color: 'var(--ink, #1B1B1B)', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{sym}{Math.round(sumRoomsRev).toLocaleString('en-US')}</td>
                          <td style={{ padding: '5px 10px', fontSize: 11, color: 'var(--ink, #1B1B1B)', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{sumLyRoomsRev > 0 ? `${sym}${Math.round(sumLyRoomsRev).toLocaleString('en-US')}` : '—'}</td>
                          <td style={{ padding: '5px 10px', fontSize: 11, color: 'var(--ink, #1B1B1B)', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{sym}{Math.round(sumRev).toLocaleString('en-US')}</td>
                          <td style={{ padding: '5px 10px', fontSize: 11, color: 'var(--ink, #1B1B1B)', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{sumLyRev > 0 ? `${sym}${Math.round(sumLyRev).toLocaleString('en-US')}` : '—'}</td>
                          <td style={{ padding: '5px 10px', fontSize: 11, color: 'var(--ink, #1B1B1B)', textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontWeight: 700, ...sumPctStyle(revPct) }}>{revPct == null ? '—' : `${revPct > 0 ? '+' : ''}${revPct.toFixed(1)}%`}</td>
                        </tr>
                        </tbody>
                      </table>
                    </div>
                  </details>
                );
              })}
            </div>
          )}
        </Container>
      </div>

    </DashboardPage>
  );
}

function ControlGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
      <span style={{ fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--ink-soft, #5A5A5A)', marginRight: 4 }}>{label}:</span>
      {children}
    </div>
  );
}

function PillLink({ href, active, children }: { href: string; active: boolean; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      style={{
        fontFamily: 'inherit',
        fontSize: 11,
        letterSpacing: '0.06em',
        textTransform: 'uppercase',
        padding: '4px 10px',
        borderRadius: 99,
        border: `1px solid ${active ? 'var(--primary, #1F3A2E)' : 'var(--hairline, #E6DFCC)'}`,
        background: active ? 'var(--primary, #1F3A2E)' : 'var(--paper, #FFFFFF)',
        color: active ? '#FFFFFF' : 'var(--ink-soft, #5A5A5A)',
        fontWeight: active ? 600 : 500,
        textDecoration: 'none',
      }}
    >
      {children}
    </Link>
  );
}
