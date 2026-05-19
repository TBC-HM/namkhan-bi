// app/revenue/pace/page.tsx
// TRIAL refactor (brief: refactor-revenue-pace-to-primitives).
// Visual blocks now composed exclusively from @/app/(cockpit)/_design.
// Data fetchers + period/granularity logic are UNCHANGED — same v_otb_pace,
// v_pace_curve, mv_kpi_daily reads; same resolvePeriod / capacityRnRange.
//
// Note on the period/granularity strip: it is a URL-driven CONTROL, not a
// "visual block" (the brief's §1 carveout). Until the design system grows
// a PeriodSelector primitive, kept inline-styled using design tokens.
// Bespoke <PaceGraphs> and <PaceBucketsTable> are now stubs — every chart /
// table here is the design-system <Chart> primitive.

import {
  DashboardPage,
  Container,
  KpiTile,
  Chart,
  type ChartSeries,
  type DashboardTab,
  type KpiTileProps,
} from '@/app/(cockpit)/_design';
import { supabase, PROPERTY_ID } from '@/lib/supabase';
import { resolvePeriod, type WindowKey } from '@/lib/period';
import { capacityFor, capacityRnRange } from '@/lib/capacity';
import { getPaceCurve } from '@/lib/pulseData';
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
  const win = parseWin(searchParams.win);
  const gran = parseGran(searchParams.gran);
  const period = resolvePeriod({ win, cmp: searchParams.cmp });
  const fromIso = period.from;
  const toIso = period.to;

  const [rows, stlyMap, paceCurveRaw] = await Promise.all([
    getPace(fromIso, toIso, pid),
    getStlyActuals(fromIso, toIso, pid),
    getPaceCurve(30, 30, pid).catch(() => []),
  ]);

  const totalRns = rows.reduce((s, r) => s + (Number(r.confirmed_rooms) || 0), 0);
  const totalRev = rows.reduce((s, r) => s + (Number(r.confirmed_revenue) || 0), 0);
  const totalCxl = rows.reduce((s, r) => s + (Number(r.cancelled_rooms) || 0), 0);
  const adr = totalRns > 0 ? totalRev / totalRns : 0;
  const capacityRn = capacityRnRange(fromIso, toIso, pid);
  const occ = capacityRn > 0 ? (totalRns / capacityRn) * 100 : 0;
  const cxlRate = totalRns + totalCxl > 0 ? (totalCxl / (totalRns + totalCxl)) * 100 : 0;

  const buckets = bucketRows(rows, gran, stlyMap, fromIso, toIso, pid);
  const stlyRnTotal = buckets.reduce((s, b) => s + b.stlyRn, 0);
  const stlyPctOverall = stlyRnTotal > 0 ? (totalRns / stlyRnTotal) * 100 : 0;
  const cmpActive = period.cmp !== 'none' && stlyRnTotal > 0;
  const cmpLabel = period.cmpLabel ? period.cmpLabel.replace(/^vs\s+/i, '') : 'STLY';

  // ─── tiles ──────────────────────────────────────────────────────────────
  const pctChange = (cur: number, base: number) => (base > 0 ? ((cur - base) / base) * 100 : 0);
  const stlyAdr = stlyRnTotal > 0 ? buckets.reduce((s, b) => s + b.stlyRev, 0) / stlyRnTotal : 0;
  const stlyOcc = capacityRn > 0 ? (stlyRnTotal / capacityRn) * 100 : 0;

  const tiles: KpiTileProps[] = [
    {
      label: 'OTB Room Nights', value: totalRns, size: 'sm',
      delta: cmpActive ? { value: pctChange(totalRns, stlyRnTotal), period: cmpLabel,
        direction: totalRns >= stlyRnTotal ? 'up' : 'down' } : undefined,
      footnote: 'v_otb_pace',
    },
    {
      label: 'OTB Revenue', value: totalRev, currency: 'USD', size: 'sm',
      delta: cmpActive ? { value: pctChange(totalRev, buckets.reduce((s, b) => s + b.stlyRev, 0)), period: cmpLabel,
        direction: totalRev >= buckets.reduce((s, b) => s + b.stlyRev, 0) ? 'up' : 'down' } : undefined,
    },
    {
      label: 'OTB ADR', value: Math.round(adr), currency: 'USD', size: 'sm',
      delta: cmpActive && stlyAdr > 0 ? { value: pctChange(adr, stlyAdr), period: cmpLabel,
        direction: adr >= stlyAdr ? 'up' : 'down' } : undefined,
    },
    {
      label: 'OTB Occupancy', value: `${occ.toFixed(1)}%`, size: 'sm',
      delta: cmpActive ? { value: occ - stlyOcc, period: cmpLabel,
        direction: occ >= stlyOcc ? 'up' : 'down' } : undefined,
    },
    { label: 'Cancel Rate', value: `${cxlRate.toFixed(1)}%`, size: 'sm', footnote: 'cancelled / total reservations' },
    { label: 'vs STLY', value: `${stlyPctOverall.toFixed(0)}%`, size: 'sm', status: stlyPctOverall >= 100 ? 'green' : stlyPctOverall >= 80 ? 'amber' : 'red' },
  ];

  // ─── pace-curve data → primitive Chart ──────────────────────────────────
  const paceCurveData = (paceCurveRaw as PaceCurvePoint[]).map((r) => ({
    day:    r.day ?? r.stay_date ?? '',
    actual: r.rooms_actual ?? null,
    otb:    r.rooms_otb ?? null,
    stly:   r.rooms_stly_daily_avg ?? null,
    budget: r.rooms_budget_daily_avg ?? null,
  }));
  const paceSeries: ChartSeries[] = [
    { key: 'actual', label: 'Actual', color: 'var(--primary, #1F3A2E)' },
    { key: 'otb',    label: 'OTB',    color: 'var(--sand, #B8A878)' },
    { key: 'stly',   label: 'STLY',   color: 'var(--ink-soft, #5A5A5A)' },
    { key: 'budget', label: 'Budget', color: 'var(--terracotta, #B8542A)' },
  ];

  // ─── bucket data → primitive Charts ─────────────────────────────────────
  const formatLabel = (key: string) => (gran === 'month' ? fmtMonth(key) : key.slice(5));
  const bucketBar = buckets.map((b) => ({ bucket: formatLabel(b.key), rns: b.rns }));
  const stlyBar = buckets
    .filter((b) => b.stlyRn > 0)
    .map((b) => ({ bucket: formatLabel(b.key), stly_pct: Math.round((b.rns / b.stlyRn) * 100) }));
  const bucketTable = buckets.map((b) => ({
    bucket:   formatLabel(b.key),
    rns:      b.rns,
    rev:      Math.round(b.rev),
    occ:      b.capacity > 0 ? Math.round((b.rns / b.capacity) * 1000) / 10 : 0,
    cxl:      b.cxl,
    stly_pct: b.stlyRn > 0 ? Math.round((b.rns / b.stlyRn) * 100) : null,
  }));

  // ─── tabs (subpage strip via DashboardPage.tabs) ────────────────────────
  const basePath = propertyId ? `/h/${propertyId}/revenue` : '/revenue';
  const tabs: DashboardTab[] = REVENUE_SUBPAGES.map((s) => {
    const href = s.href.startsWith('/h/') || s.href === '/revenue' || s.href.startsWith('/revenue/')
      ? (propertyId ? s.href.replace(/^\/revenue/, basePath) : s.href)
      : s.href;
    return { key: s.href, label: s.label, href, active: s.href.endsWith('/pace') };
  });

  // ─── period + granularity control strip (URL-driven, not a card) ────────
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
      {/* KPIs */}
      <Container title="On-the-books snapshot" subtitle={period.label} density="compact">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 12 }}>
          {tiles.map((t, i) => <KpiTile key={i} {...t} />)}
        </div>
      </Container>

      {/* Period + granularity strip */}
      <Container title="Window & granularity" subtitle="URL-driven controls" density="compact">
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, alignItems: 'center' }}>
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
        </div>
      </Container>

      <Container title="Booking pace curve" subtitle="Actual · OTB · STLY · Budget — rooms occupied, −30d → +30d">
        <Chart
          variant="line"
          data={paceCurveData}
          xKey="day"
          series={paceSeries}
          height={240}
          empty={{ title: 'No pace-curve data', hint: 'v_pace_curve returned 0 rows for this property' }}
        />
      </Container>

      <Container title="OTB by stay-bucket" subtitle={`Confirmed room nights · ${gran}`}>
        <Chart
          variant="bar"
          data={bucketBar}
          xKey="bucket"
          series={[{ key: 'rns', label: 'Rooms', color: 'var(--primary, #1F3A2E)' }]}
          height={240}
          empty={{ title: 'No on-the-books in this window' }}
        />
      </Container>

      <Container title="STLY pace per bucket" subtitle="OTB ÷ STLY actuals · % at same lead time">
        <Chart
          variant="bar"
          data={stlyBar}
          xKey="bucket"
          series={[{ key: 'stly_pct', label: 'STLY %', color: 'var(--sand, #B8A878)' }]}
          height={220}
          formatY={(v) => `${v}%`}
          empty={{ title: 'No STLY actuals' }}
        />
      </Container>

      <Container title={`Pace by stay-bucket · ${buckets.length} ${gran}${buckets.length === 1 ? '' : 's'}`} subtitle="v_otb_pace · mv_kpi_daily">
        <Chart
          variant="table"
          data={bucketTable}
          xKey="bucket"
          series={[
            { key: 'rns',      label: 'RNs' },
            { key: 'rev',      label: 'Rev (USD)' },
            { key: 'occ',      label: 'Occ %' },
            { key: 'cxl',      label: 'Cxl' },
            { key: 'stly_pct', label: 'STLY %' },
          ]}
        />
      </Container>
    </DashboardPage>
  );
}

// ─── inline URL-control helpers (not visual blocks) ──────────────────────

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
    <a
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
    </a>
  );
}
