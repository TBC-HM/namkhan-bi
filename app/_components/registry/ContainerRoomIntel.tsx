// app/_components/registry/ContainerRoomIntel.tsx
// Handler for render_type='room_intel'. Renders per-room tiles for the
// selected period; expanding a tile opens the drawer drill (granular,
// history, source mix). Each tile also exposes a "Show Reservations"
// action which opens an inline reservations table below the grid.
//
// PBS 2026-05-28:
//   • Drawer "All" pill spans every month with data (Donna 2024-03+).
//   • Year pills derived from data — 2024 appears for Donna.
//   • Empty tiles hidden (no zero rows in active period).
//   • OTHER bucket excluded — data-quality noise, not a room.
//   • Each tile has Show Reservations button → URL param drives panel.
//
// State via URL: ?period=YYYY-MM, ?expand=<code>, ?reservations=<room>.

import Link from 'next/link';
import { Container, Chart, type ChartSeries } from '@/app/(cockpit)/_design';
import SideDrawer from '@/app/(cockpit)/_design/overlay/SideDrawer';
import { supabase } from '@/lib/supabase';
import { stripPublicPrefix, type ContainerRegistryRow } from './types';
import { formatValue } from './format';
import PeriodDropdown from './PeriodDropdown';
import CompareDropdown from './CompareDropdown';
import IcpSection from './IcpSection';

interface TileMetric {
  key: string;
  label: string;
  format: 'pct' | 'money' | 'int' | string;
  agg: 'sum' | 'max' | 'rev_over_nights' | 'rev_over_capacity' | 'nights_over_capacity';
}
interface DrillColumn { key: string; label: string; format: string }
interface RoomIntelSpec {
  group_by: string;
  period_field: string;
  period_picker?: { default?: string; position?: string };
  tile_metrics: TileMetric[];
  drill: { row_field: string; columns: DrillColumn[]; default_sort?: string };
}
interface DataRow extends Record<string, unknown> {
  period_yyyymm?: string;
  room_nights?: number;
  room_revenue?: number;
  canonical_capacity_nights?: number;
  canonical_sellable_units?: number;
  adr?: number;
  room_type_name?: string;
  canonical_room_type_code?: string;
}
interface Props {
  container: ContainerRegistryRow;
  propertyId: number;
  searchParams?: Record<string, string | string[] | undefined>;
}

const FRIENDLY: Record<string, string> = {
  DBL: 'Double', JR_SUITE: 'Junior Suite', SUITE: 'Suite',
  PENTHOUSE: 'Penthouse', VILLA: 'Villa', GLAMPING: 'Glamping',
};

function num(v: unknown): number {
  const n = Number(v ?? 0);
  return Number.isFinite(n) ? n : 0;
}

function totalCapacity(rows: DataRow[], useCanonical: boolean = false): number {
  const byPeriod = new Map<string, number>();
  for (const r of rows) {
    const p = String(r.period_yyyymm ?? '');
    if (byPeriod.has(p)) continue;
    if (useCanonical) {
      byPeriod.set(p, num(r.canonical_capacity_nights));
    } else {
      const perRoom = num(r.room_capacity_nights);
      byPeriod.set(p, perRoom > 0 ? perRoom : num(r.canonical_capacity_nights));
    }
  }
  let total = 0;
  for (const c of byPeriod.values()) total += c;
  return total;
}

function computeMetric(metric: TileMetric, rows: DataRow[], useCanonical: boolean = false): number | null {
  if (rows.length === 0) return null;
  switch (metric.agg) {
    case 'sum':
      return rows.reduce((s, r) => s + num(r[metric.key]), 0);
    case 'max':
      return Math.max(...rows.map((r) => num(r[metric.key])));
    case 'rev_over_nights': {
      const rev = rows.reduce((s, r) => s + num(r.room_revenue), 0);
      const nights = rows.reduce((s, r) => s + num(r.room_nights), 0);
      return nights > 0 ? rev / nights : 0;
    }
    case 'rev_over_capacity': {
      const rev = rows.reduce((s, r) => s + num(r.room_revenue), 0);
      const cap = totalCapacity(rows, useCanonical);
      return cap > 0 ? rev / cap : 0;
    }
    case 'nights_over_capacity': {
      const nights = rows.reduce((s, r) => s + num(r.room_nights), 0);
      const cap = totalCapacity(rows, useCanonical);
      return cap > 0 ? (nights / cap) * 100 : 0;
    }
    default:
      return null;
  }
}

// PBS 2026-05-28 — period code → [start, end] date range for SQL filters.
function periodToDates(period: string): { start: string; end: string } | null {
  const monthM = /^(\d{4})-(\d{2})$/.exec(period);
  if (monthM) {
    const y = Number(monthM[1]); const mm = Number(monthM[2]);
    const lastDay = new Date(y, mm, 0).getDate();
    return { start: `${monthM[1]}-${monthM[2]}-01`, end: `${monthM[1]}-${monthM[2]}-${String(lastDay).padStart(2, '0')}` };
  }
  if (period.startsWith('YTD-')) {
    const y = period.slice(4);
    return { start: `${y}-01-01`, end: new Date().toISOString().slice(0, 10) };
  }
  if (period.startsWith('FY-')) {
    const y = period.slice(3);
    return { start: `${y}-01-01`, end: `${y}-12-31` };
  }
  const qM = /^Q([1-4])-(\d{4})$/.exec(period);
  if (qM) {
    const q = Number(qM[1]); const y = qM[2];
    const sMonth = (q - 1) * 3 + 1; const eMonth = sMonth + 2;
    const lastDay = new Date(Number(y), eMonth, 0).getDate();
    return {
      start: `${y}-${String(sMonth).padStart(2, '0')}-01`,
      end: `${y}-${String(eMonth).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`,
    };
  }
  return null;
}

export default async function ContainerRoomIntel({ container, propertyId, searchParams }: Props) {
  const spec = (container.columns_spec as unknown) as RoomIntelSpec;
  const viewName = stripPublicPrefix(container.bound_views?.[0] ?? 'v_room_type_performance_monthly');
  const groupBy  = spec.group_by ?? 'canonical_room_type_code';
  const periodField = spec.period_field ?? 'period_yyyymm';
  const filterCol = container.primary_filter ?? 'property_id';

  const { data: allRows, error } = await supabase
    .from(viewName).select('*').eq(filterCol, propertyId);

  if (error || !allRows) {
    return (
      <Container title={container.container_name} subtitle="Query failed" status="red">
        <div style={{ padding: 14, fontSize: 12, color: 'var(--ink-soft, #5A5A5A)' }}>
          {error?.message ?? `No data returned from ${viewName}.`}
        </div>
      </Container>
    );
  }
  const { data: unitsRows } = await supabase
    .from('v_room_type_units').select('room_type_name, units').eq('property_id', propertyId);
  const unitsByName = new Map<string, number>(
    ((unitsRows ?? []) as Array<{ room_type_name: string; units: number }>).map((r) => [String(r.room_type_name), Number(r.units ?? 0)])
  );
  const daysInPeriod = (yyyymm: string): number => {
    if (!yyyymm || yyyymm.length < 7) return 30;
    const y = Number(yyyymm.slice(0, 4)); const m = Number(yyyymm.slice(5, 7));
    if (!Number.isFinite(y) || !Number.isFinite(m)) return 30;
    return new Date(y, m, 0).getDate();
  };
  const rows = (allRows as DataRow[])
    .filter((r) => !String(r.room_type_name ?? '').startsWith('[retired]'))
    .filter((r) => String(r.canonical_room_type_code ?? '') !== 'OTHER')
    .map((r) => {
      const u = unitsByName.get(String(r.room_type_name ?? '')) ?? 0;
      const d = daysInPeriod(String(r.period_yyyymm ?? ''));
      return { ...r, room_sellable_units: u, room_capacity_nights: u * d } as DataRow;
    });

  const { data: propRow } = await supabase
    .from('v_property_display')
    .select('display_symbol, display_currency').eq('property_id', propertyId).maybeSingle();
  const currencySymbol = String((propRow as { display_symbol?: string } | null)?.display_symbol ?? '$');

  const currentYearStr = new Date().toISOString().slice(0, 4);
  const { data: directRows } = await supabase
    .rpc('fn_room_direct_share', { p_property_id: propertyId, p_period_yyyymm: null, p_year: currentYearStr });
  const directByCanon = new Map<string, number>();
  for (const r of ((directRows ?? []) as Array<{ canonical_room_type_code: string; direct_share_pct: number }>)) {
    directByCanon.set(String(r.canonical_room_type_code), Number(r.direct_share_pct ?? 0));
  }

  const allPeriods = Array.from(new Set(rows.map((r) => String(r.period_yyyymm ?? '')).filter(Boolean))).sort().reverse();
  const currentYm = new Date().toISOString().slice(0, 7);
  const currentYear = currentYm.slice(0, 4);
  const HISTORICAL_FLOOR = '2024-03';
  const windowMonths = allPeriods.filter((p) => p >= HISTORICAL_FLOOR);
  const realisedMonths = windowMonths.filter((p) => p <= currentYm);
  const ytdKey = `YTD-${currentYear}`;
  const requested = String(searchParams?.period ?? '');
  const isYtd = requested === ytdKey;
  const AGGREGATE_YEARS = Array.from(new Set(allPeriods.map((p) => p.slice(0, 4))))
    .filter((y) => Boolean(y) && Number(y) >= 2024)
    .sort();
  const aggregatePeriods: string[] = [];
  for (const y of AGGREGATE_YEARS) {
    aggregatePeriods.push(`FY-${y}`, `Q1-${y}`, `Q2-${y}`, `Q3-${y}`, `Q4-${y}`);
  }
  const validPeriods = new Set([ytdKey, ...allPeriods, ...aggregatePeriods]);
  const activePeriod = validPeriods.has(requested) ? requested : (realisedMonths[0] ?? windowMonths[0] ?? allPeriods[0]);
  if (!activePeriod) {
    return (
      <Container title={container.container_name} subtitle="No data on file">
        <div style={{ padding: 14, fontSize: 12, color: 'var(--ink-soft, #5A5A5A)' }}>
          <code>{viewName}</code> has no rows for property <code>{propertyId}</code>.
        </div>
      </Container>
    );
  }

  function quarterMonths(qCode: string): string[] {
    const q = Number(qCode.charAt(1));
    const y = qCode.slice(3);
    const startMonth = (q - 1) * 3 + 1;
    return [0, 1, 2].map((i) => `${y}-${String(startMonth + i).padStart(2, '0')}`);
  }
  const isFY = activePeriod.startsWith('FY-');
  const isQ  = /^Q[1-4]-\d{4}$/.test(activePeriod);
  const periodRows = isFY
    ? rows.filter((r) => String(r.period_yyyymm ?? '').startsWith(`${activePeriod.slice(3)}-`))
    : isQ
    ? (() => { const qm = new Set(quarterMonths(activePeriod)); return rows.filter((r) => qm.has(String(r.period_yyyymm ?? ''))); })()
    : isYtd || activePeriod.startsWith('YTD-')
    ? rows.filter((r) => {
        const p = String(r.period_yyyymm ?? '');
        return p.startsWith(`${activePeriod.slice(4)}-`) && p <= currentYm;
      })
    : rows.filter((r) => String(r.period_yyyymm) === activePeriod);

  function lyOf(p: string): string {
    if (p.startsWith('YTD-')) { const y = Number(p.slice(4)); return Number.isFinite(y) ? `YTD-${y - 1}` : p; }
    if (p.startsWith('FY-'))  { const y = Number(p.slice(3)); return Number.isFinite(y) ? `FY-${y - 1}` : p; }
    if (/^Q[1-4]-\d{4}$/.test(p)) { const y = Number(p.slice(3)); return Number.isFinite(y) ? `${p.slice(0, 3)}${y - 1}` : p; }
    if (p.length >= 7) { const y = Number(p.slice(0, 4)); const mm = p.slice(5, 7); return Number.isFinite(y) ? `${y - 1}-${mm}` : p; }
    return p;
  }
  const lyPeriod = lyOf(activePeriod);
  const elapsedMm = currentYm.slice(5, 7);
  const cmpMode = String(searchParams?.cmp ?? 'sdly');
  const lyRows: DataRow[] = cmpMode === 'budget' ? [] :
    lyPeriod.startsWith('FY-')
      ? rows.filter((r) => String(r.period_yyyymm ?? '').startsWith(`${lyPeriod.slice(3)}-`))
    : /^Q[1-4]-\d{4}$/.test(lyPeriod)
      ? (() => { const qm = new Set(quarterMonths(lyPeriod)); return rows.filter((r) => qm.has(String(r.period_yyyymm ?? ''))); })()
    : lyPeriod.startsWith('YTD-')
    ? rows.filter((r) => {
        const p = String(r.period_yyyymm ?? '');
        return p.startsWith(`${lyPeriod.slice(4)}-`) && p.slice(5, 7) <= elapsedMm;
      })
    : rows.filter((r) => String(r.period_yyyymm) === lyPeriod);

  const REAL_CATEGORIES = new Set(['DBL','JR_SUITE','SUITE','PENTHOUSE','VILLA','GLAMPING']);
  const isCanonicalGrouping = groupBy === 'canonical_room_type_code';
  const allCategories = Array.from(new Set(
    rows.map((r) => String(r[groupBy] ?? '')).filter(Boolean)
  )).filter((c) => isCanonicalGrouping ? REAL_CATEGORIES.has(c) : true).sort();

  const rowsByCatActive = new Map<string, DataRow[]>();
  for (const r of periodRows) {
    const k = String(r[groupBy] ?? 'UNKNOWN');
    if (!rowsByCatActive.has(k)) rowsByCatActive.set(k, []);
    rowsByCatActive.get(k)!.push(r);
  }
  const rowsByCatLy = new Map<string, DataRow[]>();
  for (const r of lyRows) {
    const k = String(r[groupBy] ?? 'UNKNOWN');
    if (!rowsByCatLy.has(k)) rowsByCatLy.set(k, []);
    rowsByCatLy.get(k)!.push(r);
  }
  const taglineByCat = new Map<string, string>();
  for (const cat of allCategories) {
    const catRows = rows.filter((r) => r[groupBy] === cat);
    const top = [...catRows].sort((a, b) => num(b.room_revenue) - num(a.room_revenue))[0];
    taglineByCat.set(cat, String(top?.room_type_name ?? ''));
  }

  const activeExpand = String(searchParams?.expand ?? '');
  // PBS 2026-05-28: show-reservations panel state.
  const requestedRes = String(searchParams?.reservations ?? '');
  const showResRoom = allCategories.includes(requestedRes) ? requestedRes : '';

  function hrefPeriod(p: string): string {
    const params = new URLSearchParams();
    if (p !== realisedMonths[0]) params.set('period', p);
    if (activeExpand) params.set('expand', activeExpand);
    if (showResRoom) params.set('reservations', showResRoom);
    const qs = params.toString();
    return qs ? `?${qs}` : '';
  }
  function hrefExpand(cat: string): string {
    const params = new URLSearchParams();
    if (activePeriod !== realisedMonths[0]) params.set('period', activePeriod);
    if (cat !== activeExpand) params.set('expand', cat);
    if (showResRoom) params.set('reservations', showResRoom);
    const qs = params.toString();
    return qs ? `?${qs}` : '';
  }
  function hrefReservations(roomName: string): string {
    const params = new URLSearchParams();
    if (activePeriod !== realisedMonths[0]) params.set('period', activePeriod);
    if (activeExpand) params.set('expand', activeExpand);
    if (roomName !== showResRoom) params.set('reservations', roomName);
    const qs = params.toString();
    return qs ? `?${qs}` : '';
  }

  const futureMonths = windowMonths.filter((p) => p > currentYm);
  const periodPicker = (
    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
      <PeriodDropdown
        activePeriod={activePeriod}
        ytdKey={ytdKey}
        ytdLabel={`YTD ${currentYear}`}
        realisedMonths={realisedMonths}
        futureMonths={futureMonths}
        aggregatePeriods={aggregatePeriods}
        defaultPeriod={realisedMonths[0]}
        preserveParams={{ expand: activeExpand, cmp: cmpMode === 'sdly' ? undefined : cmpMode, reservations: showResRoom || undefined }}
      />
      <CompareDropdown
        activeCmp={cmpMode}
        preserveParams={{ expand: activeExpand, period: activePeriod === realisedMonths[0] ? undefined : activePeriod, reservations: showResRoom || undefined }}
      />
    </div>
  );

  return (
    <Container
      title={container.container_name}
      subtitle={`${container.subtitle ?? ''} · ${activePeriod}${activePeriod.startsWith('YTD-') ? ` · ${realisedMonths.filter((p) => p.startsWith(`${activePeriod.slice(4)}-`)).length} months` : ''} · click a tile to drill`.replace(/^ · /, '')}
      density="compact"
      action={periodPicker}
    >
      {(() => {
        const totalNights = periodRows.reduce((s, r) => s + num(r.room_nights), 0);
        const totalRev = periodRows.reduce((s, r) => s + num(r.room_revenue), 0);
        const avgAdr = totalNights > 0 ? totalRev / totalNights : 0;
        const seenCanonical = new Set<string>();
        let totalCap = 0;
        for (const r of periodRows) {
          const p = String(r.period_yyyymm ?? '');
          const code = String(r.canonical_room_type_code ?? '');
          const key = `${p}|${code}`;
          if (seenCanonical.has(key)) continue;
          seenCanonical.add(key);
          totalCap += num(r.canonical_capacity_nights);
        }
        const occ = totalCap > 0 ? (totalNights / totalCap) * 100 : 0;
        const tile = (label: string, value: string) => (
          <div key={label} style={{
            border: '1px solid var(--hairline, #E6DFCC)', borderRadius: 4,
            padding: '8px 12px', background: 'var(--paper, #FFFFFF)',
            display: 'flex', flexDirection: 'column', gap: 2,
          }}>
            <span style={{ fontSize: 10, color: 'var(--ink-soft, #5A5A5A)', letterSpacing: '0.04em', textTransform: 'uppercase' }}>{label}</span>
            <span style={{ fontSize: 16, fontWeight: 600, color: 'var(--ink, #1B1B1B)', fontVariantNumeric: 'tabular-nums' }}>{value}</span>
          </div>
        );
        return (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 8, marginBottom: 12 }}>
            {tile('Occupancy', `${occ.toFixed(1)}%`)}
            {tile('ADR', `${currencySymbol}${Math.round(avgAdr).toLocaleString()}`)}
            {tile('Room nights', totalNights.toLocaleString())}
            {tile('Room revenue', `${currencySymbol}${Math.round(totalRev).toLocaleString()}`)}
          </div>
        );
      })()}

      {(() => {
        const catChart = allCategories.map((code) => {
          const r = rowsByCatActive.get(code) ?? [];
          const friendly = FRIENDLY[code] ?? code;
          const rev = r.reduce((s, x) => s + num(x.room_revenue), 0);
          const nights = r.reduce((s, x) => s + num(x.room_nights), 0);
          const adr = nights > 0 ? rev / nights : 0;
          const seenP = new Set<string>();
          let cap = 0;
          for (const row of r) {
            const p = String(row.period_yyyymm ?? '');
            if (seenP.has(p)) continue;
            seenP.add(p);
            cap += num(row.canonical_capacity_nights);
          }
          const occ = cap > 0 ? (nights / cap) * 100 : 0;
          return { category: friendly, adr, revenue: rev, occ };
        }).filter((d) => d.adr > 0 || d.revenue > 0);

        if (catChart.length === 0) return null;
        return (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 12, marginBottom: 12 }}>
            <div style={chartFrameStyle}>
              <div style={chartTitleStyle}>ADR by category</div>
              <Chart variant="bar" data={catChart} xKey="category"
                series={[{ key: 'adr', label: 'ADR', color: 'var(--brass, #B8A878)' }]}
                height={180} empty={{ title: 'No ADR data' }} />
            </div>
            <div style={chartFrameStyle}>
              <div style={chartTitleStyle}>Revenue by category</div>
              <Chart variant="bar" data={catChart} xKey="category"
                series={[{ key: 'revenue', label: 'Revenue', color: 'var(--primary, #1F3A2E)' }]}
                height={180} empty={{ title: 'No revenue data' }} />
            </div>
            <div style={chartFrameStyle}>
              <div style={chartTitleStyle}>Occupancy by category</div>
              <Chart variant="bar" data={catChart} xKey="category"
                series={[{ key: 'occ', label: 'Occ %', color: 'var(--terracotta, #B8542A)' }]}
                height={180} empty={{ title: 'No occupancy data' }} />
            </div>
          </div>
        );
      })()}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 12 }}>
        {allCategories.filter((code) => (rowsByCatActive.get(code)?.length ?? 0) > 0).map((code) => {
          const catRows = rowsByCatActive.get(code) ?? [];
          const friendly = FRIENDLY[code] ?? code;
          const tagline = taglineByCat.get(code) ?? '';
          const isExpanded = code === activeExpand;
          const isShowingRes = code === showResRoom;
          const hasData = catRows.length > 0;
          const primaryMetric = spec.tile_metrics[0];
          const ownVal = primaryMetric ? computeMetric(primaryMetric, catRows, isCanonicalGrouping) : null;
          const peerVals = primaryMetric
            ? allCategories
                .map((c) => computeMetric(primaryMetric, rowsByCatActive.get(c) ?? [], isCanonicalGrouping))
                .filter((v): v is number => v != null && v > 0)
            : [];
          const avgVal = peerVals.length > 0 ? peerVals.reduce((a, b) => a + b, 0) / peerVals.length : null;
          const ratio = (ownVal != null && avgVal != null && avgVal > 0) ? ownVal / avgVal : null;
          let frameColor = 'var(--hairline, #E6DFCC)';
          if (isExpanded || isShowingRes) frameColor = 'var(--primary, #1F3A2E)';
          else if (ratio != null) {
            if (ratio > 1.05) frameColor = '#1F7A5B';
            else if (ratio < 0.85) frameColor = '#C0584C';
            else if (ratio < 0.95) frameColor = '#B8542A';
          }
          return (
            <div key={code} style={{
              border: `2px solid ${frameColor}`,
              borderRadius: 6, padding: 14, background: 'var(--paper, #FFFFFF)',
              display: 'flex', flexDirection: 'column', gap: 8,
              opacity: hasData ? 1 : 0.7,
            }}>
              <div>
                {isCanonicalGrouping && (
                  <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--ink-soft, #5A5A5A)' }}>{code}</div>
                )}
                <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--ink, #1B1B1B)' }}>
                  {isCanonicalGrouping ? `${friendly}${tagline && tagline !== friendly ? ` · ${tagline}` : ''}` : code}
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 6 }}>
                {spec.tile_metrics.map((m) => {
                  const v   = computeMetric(m, catRows, isCanonicalGrouping);
                  const lyV = computeMetric(m, rowsByCatLy.get(code) ?? [], isCanonicalGrouping);
                  const lyHasData = lyV != null && lyV !== 0;
                  const diff = v != null && lyV != null ? v - lyV : null;
                  const isPctMetric = m.format === 'pct';
                  let deltaTxt: string | null = null;
                  if (diff != null && lyHasData) {
                    if (isPctMetric) deltaTxt = `${diff.toFixed(1)}pp`;
                    else if (Math.abs(lyV!) > 0.01) deltaTxt = `${((diff / Math.abs(lyV!)) * 100).toFixed(0)}%`;
                  }
                  const deltaColor = diff == null ? 'var(--ink-soft, #5A5A5A)'
                    : diff > 0.01 ? '#1F7A5B'
                    : diff < -0.01 ? '#C0584C'
                    : 'var(--ink-soft, #5A5A5A)';
                  return (
                    <div key={m.key} style={{ display: 'flex', flexDirection: 'column' }}>
                      <span style={{ fontSize: 10, color: 'var(--ink-soft, #5A5A5A)', letterSpacing: '0.04em' }}>{m.label}</span>
                      <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink, #1B1B1B)', fontVariantNumeric: 'tabular-nums' }}>
                        {v == null ? '—' : formatValue(v, m.format as never, currencySymbol)}
                      </span>
                      <span style={{ fontSize: 9.5, color: 'var(--ink-soft, #5A5A5A)', fontVariantNumeric: 'tabular-nums', marginTop: 1 }}>
                        {lyHasData ? (
                          <>
                            LY {formatValue(lyV!, m.format as never, currencySymbol)}
                            {deltaTxt && (<span style={{ marginLeft: 6, color: deltaColor, fontWeight: 600 }}>{deltaTxt}</span>)}
                          </>
                        ) : 'LY —'}
                      </span>
                    </div>
                  );
                })}
              </div>
              {isCanonicalGrouping && (() => {
                const directPct = directByCanon.get(code);
                if (directPct == null) return null;
                return (
                  <div style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    fontSize: 10, color: 'var(--ink-soft, #5A5A5A)',
                    borderTop: '1px solid #E0E0E0',
                    paddingTop: 4, marginTop: 4, letterSpacing: '0.04em',
                  }}>
                    <span>Direct sales (YTD)</span>
                    <span style={{
                      fontWeight: 600,
                      color: directPct >= 30 ? '#1F7A5B' : directPct < 20 ? '#C0584C' : 'var(--ink, #1B1B1B)',
                      fontVariantNumeric: 'tabular-nums',
                    }}>{directPct.toFixed(1)}%</span>
                  </div>
                );
              })()}
              {/* PBS 2026-05-28: action row — explicit Show Reservations + Expand buttons (replaces whole-tile Link wrap to allow nested actions). */}
              <div style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                fontSize: 11, paddingTop: 6, marginTop: 2,
                borderTop: '1px solid #E0E0E0',
              }}>
                <Link href={hrefReservations(code)} style={{
                  textDecoration: 'none', fontWeight: 600,
                  color: isShowingRes ? 'var(--primary, #1F3A2E)' : 'var(--brass, #B8A878)',
                }}>
                  {isShowingRes ? '✕ Hide reservations' : 'Show reservations →'}
                </Link>
                <Link href={hrefExpand(code)} style={{
                  textDecoration: 'none', fontWeight: 500,
                  color: 'var(--ink-soft, #5A5A5A)',
                }}>
                  {isExpanded ? '↑ collapse' : 'expand ↓'}
                </Link>
              </div>
            </div>
          );
        })}
      </div>

      {/* PBS 2026-05-28: Show Reservations panel — inline below the tile grid. */}
      {showResRoom && (
        <ReservationsPanel
          propertyId={propertyId}
          roomTypeName={showResRoom}
          activePeriod={activePeriod}
          currencySymbol={currencySymbol}
          closeHref={hrefReservations(showResRoom)}
        />
      )}

      <SideDrawer
        open={!!activeExpand}
        closeHref={activeExpand ? hrefExpand(activeExpand) : ''}
        title={activeExpand ? `Room: ${isCanonicalGrouping ? (FRIENDLY[activeExpand] ?? activeExpand) : activeExpand}` : null}
      >
        {activeExpand && (
          <>
            <DrillPanel
              q={String(searchParams?.q ?? '')}
              rtList={String(searchParams?.rt ?? '').split(',').filter(Boolean)}
              yrFilter={String(searchParams?.yr ?? '')}
              code={activeExpand}
              friendly={isCanonicalGrouping ? (FRIENDLY[activeExpand] ?? activeExpand) : activeExpand}
              activePeriod={activePeriod}
              propertyId={propertyId}
              categoryRowsAllTime={rows.filter((r) => r[groupBy] === activeExpand)}
              categoryRowsActive={rowsByCatActive.get(activeExpand) ?? []}
              spec={spec}
              currencySymbol={currencySymbol}
            />
            <IcpSection category={activeExpand} />
          </>
        )}
      </SideDrawer>
    </Container>
  );
}

// ─── ReservationsPanel ──────────────────────────────────────────────────────
// PBS 2026-05-28 — inline table of reservations for the selected room+period.
interface ReservationsPanelProps {
  propertyId: number;
  roomTypeName: string;
  activePeriod: string;
  currencySymbol: string;
  closeHref: string;
}
async function ReservationsPanel({ propertyId, roomTypeName, activePeriod, currencySymbol, closeHref }: ReservationsPanelProps) {
  const dates = periodToDates(activePeriod);
  if (!dates) {
    return (
      <div style={{ marginTop: 12, ...panelStyle }}>
        <div style={panelHeader}>
          Reservations · {roomTypeName} <span style={panelHeaderSub}>· unsupported period: {activePeriod}</span>
          <Link href={closeHref} style={closeLinkStyle}>✕ close</Link>
        </div>
      </div>
    );
  }
  const { data: rows, error } = await supabase.rpc('fn_reservations_by_room_period', {
    p_property_id: propertyId,
    p_room_type_name: roomTypeName,
    p_start_date: dates.start,
    p_end_date: dates.end,
  });
  const reservations = (rows ?? []) as Array<{
    reservation_id: string; source_name: string; rate_plan: string;
    country: string; los: number; booking_window: number;
    check_in_date: string; check_out_date: string;
    total_amount: number; currency: string; status: string;
  }>;
  return (
    <div style={{ marginTop: 12, ...panelStyle }}>
      <div style={{ ...panelHeader, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          Reservations · <strong>{roomTypeName}</strong> <span style={panelHeaderSub}>· {activePeriod} · {reservations.length} booking{reservations.length === 1 ? '' : 's'}</span>
        </div>
        <Link href={closeHref} style={closeLinkStyle}>✕ close</Link>
      </div>
      {error ? (
        <div style={{ padding: 14, fontSize: 12, color: '#C0584C' }}>RPC error: {error.message}</div>
      ) : reservations.length === 0 ? (
        <div style={{ padding: 14, fontSize: 12, color: 'var(--ink-soft, #5A5A5A)', fontStyle: 'italic' }}>
          No reservations for {roomTypeName} in {activePeriod} (date range {dates.start} → {dates.end}).
        </div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr style={{ background: '#FFFFFF', borderBottom: '2px solid #000' }}>
                <th style={th}>Reservation</th>
                <th style={th}>Source</th>
                <th style={th}>Rate plan</th>
                <th style={th}>Country</th>
                <th style={{ ...th, textAlign: 'right' }}>LOS</th>
                <th style={{ ...th, textAlign: 'right' }}>BW d</th>
                <th style={th}>Check-in</th>
                <th style={th}>Check-out</th>
                <th style={{ ...th, textAlign: 'right' }}>Total</th>
                <th style={th}>Status</th>
              </tr>
            </thead>
            <tbody>
              {reservations.map((r) => (
                <tr key={r.reservation_id} style={{ borderTop: '1px solid #E0E0E0' }}>
                  <td style={tdLeft}>{r.reservation_id}</td>
                  <td style={tdLeft}>{r.source_name ?? '—'}</td>
                  <td style={tdLeft}>{r.rate_plan ?? '—'}</td>
                  <td style={tdLeft}>{r.country ?? '—'}</td>
                  <td style={tdRight}>{r.los}</td>
                  <td style={tdRight}>{r.booking_window}</td>
                  <td style={tdLeft}>{r.check_in_date}</td>
                  <td style={tdLeft}>{r.check_out_date}</td>
                  <td style={tdRight}>{currencySymbol}{Math.round(Number(r.total_amount ?? 0)).toLocaleString()}</td>
                  <td style={tdLeft}>{r.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─── DRILL ──────────────────────────────────────────────────────────────────
interface DrillProps {
  code: string;
  friendly: string;
  activePeriod: string;
  propertyId: number;
  categoryRowsAllTime: DataRow[];
  categoryRowsActive: DataRow[];
  spec: RoomIntelSpec;
  currencySymbol: string;
  q: string;
  rtList: string[];
  yrFilter: string;
}

async function DrillPanel({
  code, friendly, activePeriod, propertyId,
  categoryRowsAllTime, categoryRowsActive, spec, currencySymbol,
  q, rtList, yrFilter,
}: DrillProps) {
  const sortSpec = (spec.drill.default_sort ?? '').split(/\s+/);
  const sortCol = sortSpec[0] || 'room_revenue';
  const sortDesc = (sortSpec[1] ?? 'desc').toLowerCase() === 'desc';
  const sorted = [...categoryRowsActive].sort((a, b) => {
    const av = num(a[sortCol]); const bv = num(b[sortCol]);
    return sortDesc ? bv - av : av - bv;
  });

  const displayMonths: string[] = Array.from(new Set(
    categoryRowsAllTime.map((r) => String(r.period_yyyymm ?? ''))
  )).filter(Boolean).sort();
  const adrSeries: ChartSeries[] = [];
  const adrData: Array<Record<string, string | number>> = displayMonths.map((m) => ({ month: m }));
  const granularTypes = Array.from(new Set(categoryRowsAllTime.map((r) => String(r.room_type_name ?? '')))).sort();
  const PALETTE = ['#1F3A2E', '#B8542A', '#B8A878', '#5B7A5A', '#8A2A1D', '#3A7CA5'];
  granularTypes.forEach((rt, idx) => {
    adrSeries.push({ key: `t${idx}`, label: rt, color: PALETTE[idx % PALETTE.length] });
    displayMonths.forEach((m, mIdx) => {
      const row = categoryRowsAllTime.find((r) => r.room_type_name === rt && r.period_yyyymm === m);
      adrData[mIdx][`t${idx}`] = row ? num(row.adr) : 0;
      adrData[mIdx][`t${idx}_rn`] = row ? num(row.room_nights) : 0;
      adrData[mIdx][`t${idx}_los`] = row ? num(row.avg_los) : 0;
      adrData[mIdx][`t${idx}_bk`] = row ? num(row.bookings) : 0;
    });
  });
  const seriesLabelByKey: Record<string, string> = {};
  granularTypes.forEach((rt, idx) => { seriesLabelByKey[`t${idx}`] = rt; });

  const qLower = q.trim().toLowerCase();
  const granularTypesFiltered = granularTypes.filter((rt) =>
    (!qLower || rt.toLowerCase().includes(qLower)) &&
    (rtList.length === 0 || rtList.includes(rt))
  );
  const displayMonthsFiltered = yrFilter
    ? displayMonths.filter((m) => m.startsWith(yrFilter))
    : displayMonths;
  const adrDataFiltered = displayMonthsFiltered.map((m) => adrData.find((d) => d.month === m) ?? { month: m });
  const adrSeriesFiltered = adrSeries.filter((s) => granularTypesFiltered.some((rt) => seriesLabelByKey[String(s.key)] === rt));
  const sortedFiltered = sorted.filter((r) => granularTypesFiltered.includes(String(r.room_type_name ?? '')));

  const dataYears = Array.from(new Set(displayMonths.map((m) => m.slice(0, 4)))).sort();
  const yearPills: Array<{ k: string; label: string }> = [{ k: '', label: 'All' }, ...dataYears.map((y) => ({ k: y, label: y }))];
  const chartScopeLabel = yrFilter
    ? `· ${yrFilter}`
    : displayMonths.length > 0 ? `· since ${displayMonths[0]} (${displayMonths.length} months)` : '';

  function hrefDrillToggle(overrides: { q?: string | null; rt?: string | null; yr?: string | null }): string {
    const params = new URLSearchParams();
    if (code) params.set('expand', code);
    if (activePeriod) params.set('period', activePeriod);
    const nextQ  = 'q'  in overrides ? overrides.q  : q;
    const nextRt = 'rt' in overrides ? overrides.rt : (rtList.length > 0 ? rtList.join(',') : null);
    const nextYr = 'yr' in overrides ? overrides.yr : yrFilter;
    if (nextQ)  params.set('q',  String(nextQ));
    if (nextRt) params.set('rt', String(nextRt));
    if (nextYr) params.set('yr', String(nextYr));
    const qs = params.toString();
    return qs ? `?${qs}` : '';
  }

  const { data: sourceMixRows } = await supabase.rpc('fn_room_source_mix', {
    p_property_id: propertyId,
    p_period_yyyymm: activePeriod,
    p_canonical_code: code,
  });
  const sourceMix = (sourceMixRows ?? []) as Array<{ room_type_name: string; source_name: string; rn: number; rev: number }>;
  const roomTotals = new Map<string, { rev: number; rn: number }>();
  for (const r of sourceMix) {
    const t = roomTotals.get(r.room_type_name) ?? { rev: 0, rn: 0 };
    t.rev += Number(r.rev); t.rn += Number(r.rn);
    roomTotals.set(r.room_type_name, t);
  }

  return (
    <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={panelStyle}>
        <div style={{ padding: '10px 14px', display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center' }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--ink-soft, #5A5A5A)' }}>Year</div>
          {yearPills.map((y) => {
            const isActive = (y.k === '' && !yrFilter) || (y.k !== '' && yrFilter === y.k);
            return (
              <Link key={y.k || 'all'} href={hrefDrillToggle({ yr: y.k || null })} style={{
                fontSize: 12, padding: '4px 10px', borderRadius: 4,
                border: `1px solid ${isActive ? 'var(--primary, #1F3A2E)' : 'var(--hairline, #E6DFCC)'}`,
                background: isActive ? 'var(--primary, #1F3A2E)' : 'var(--paper, #FFFFFF)',
                color: isActive ? 'var(--paper, #FFFFFF)' : 'var(--ink, #1B1B1B)',
                textDecoration: 'none', fontWeight: isActive ? 600 : 400,
              }}>{y.label}</Link>
            );
          })}
          <form method="get" style={{ display: 'flex', alignItems: 'center', gap: 6, marginLeft: 'auto' }}>
            {code && <input type="hidden" name="expand" value={code} />}
            {activePeriod && <input type="hidden" name="period" value={activePeriod} />}
            {yrFilter && <input type="hidden" name="yr" value={yrFilter} />}
            {rtList.length > 0 && <input type="hidden" name="rt" value={rtList.join(',')} />}
            <label style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--ink-soft, #5A5A5A)' }}>Search</label>
            <input type="text" name="q" defaultValue={q} placeholder="room type..." style={{
              fontSize: 12, padding: '4px 8px', border: '1px solid var(--hairline, #E6DFCC)', borderRadius: 4,
              background: 'var(--paper, #FFFFFF)', color: 'var(--ink, #1B1B1B)', minWidth: 140,
            }} />
            {q && (<Link href={hrefDrillToggle({ q: null })} style={{ fontSize: 11, color: 'var(--ink-soft, #5A5A5A)', textDecoration: 'underline' }}>clear</Link>)}
          </form>
        </div>
        {granularTypes.length > 0 && (
          <div style={{ padding: '0 14px 12px', display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--ink-soft, #5A5A5A)', alignSelf: 'center', marginRight: 4 }}>Rooms</div>
            {granularTypes.map((rt) => {
              const isSelected = rtList.includes(rt);
              const nextList = isSelected ? rtList.filter((x) => x !== rt) : [...rtList, rt];
              return (
                <Link key={rt} href={hrefDrillToggle({ rt: nextList.length === 0 ? null : nextList.join(',') })} style={{
                  fontSize: 12, padding: '3px 8px', borderRadius: 4,
                  border: `1px solid ${isSelected ? 'var(--primary, #1F3A2E)' : 'var(--hairline, #E6DFCC)'}`,
                  background: isSelected ? 'var(--primary, #1F3A2E)' : 'var(--paper, #FFFFFF)',
                  color: isSelected ? 'var(--paper, #FFFFFF)' : 'var(--ink, #1B1B1B)',
                  textDecoration: 'none', fontWeight: isSelected ? 600 : 400,
                }}>{rt}</Link>
              );
            })}
            {rtList.length > 0 && (<Link href={hrefDrillToggle({ rt: null })} style={{ fontSize: 11, color: 'var(--ink-soft, #5A5A5A)', textDecoration: 'underline', alignSelf: 'center', marginLeft: 6 }}>clear</Link>)}
          </div>
        )}
      </div>

      <div style={panelStyle}>
        <div style={panelHeader}>
          Drill · {friendly} <span style={panelHeaderSub}>· {sorted.length} granular room type{sorted.length === 1 ? '' : 's'} · {activePeriod}</span>
        </div>
        {sortedFiltered.length === 0 ? (
          <div style={{ padding: 14, fontSize: 12, color: 'var(--ink-soft, #5A5A5A)', fontStyle: 'italic' }}>
            No granular rows for this category in {activePeriod}.
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr style={{ background: '#FFFFFF', borderBottom: '2px solid #000' }}>
                <th style={th}>Room type</th>
                <th style={th}>Month</th>
                <th style={{ ...th, textAlign: 'right' }}>RN</th>
                <th style={{ ...th, textAlign: 'right' }}>REV</th>
                <th style={{ ...th, textAlign: 'right' }}>OCC</th>
              </tr>
            </thead>
            <tbody>
              {sortedFiltered.map((r, i) => {
                const period = String(r.period_yyyymm ?? '');
                const lyP = period.length >= 7 ? `${Number(period.slice(0, 4)) - 1}-${period.slice(5, 7)}` : '';
                const ly = lyP ? categoryRowsAllTime.find((x) => x.room_type_name === r.room_type_name && String(x.period_yyyymm ?? '') === lyP) : null;
                const rn  = num(r.room_nights);
                const rev = num(r.room_revenue);
                const occ = num(r.occ_pct_of_canonical);
                const rnLy  = ly ? num(ly.room_nights) : null;
                const revLy = ly ? num(ly.room_revenue) : null;
                const occLy = ly ? num(ly.occ_pct_of_canonical) : null;
                const rowKey = `${String(r[spec.drill.row_field as keyof DataRow] ?? i)}|${period}`;
                return (
                  <tr key={rowKey} style={{ borderTop: '1px solid #E0E0E0' }}>
                    <td style={tdLeft}>{String(r[spec.drill.row_field as keyof DataRow] ?? '—')}</td>
                    <td style={tdLeft}>{period || '—'}</td>
                    <td style={tdRight}>
                      <div>{rn.toLocaleString()}</div>
                      {rnLy != null && rnLy > 0 && (<div style={lyCellStyle(rn - rnLy)}>LY {rnLy.toLocaleString()}  {formatVarPct(rn, rnLy)}</div>)}
                    </td>
                    <td style={tdRight}>
                      <div>{formatValue(rev, 'money', currencySymbol)}</div>
                      {revLy != null && revLy > 0 && (<div style={lyCellStyle(rev - revLy)}>LY {formatValue(revLy, 'money', currencySymbol)}  {formatVarPct(rev, revLy)}</div>)}
                    </td>
                    <td style={tdRight}>
                      <div>{occ.toFixed(1)}%</div>
                      {occLy != null && occLy > 0 && (<div style={lyCellStyle(occ - occLy)}>LY {occLy.toFixed(1)}%  {(occ - occLy).toFixed(1)}pp</div>)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {displayMonthsFiltered.length > 0 && (
        <div style={panelStyle}>
          <div style={panelHeader}>ADR <span style={panelHeaderSub}>{chartScopeLabel} · per granular room type</span></div>
          <div style={{ padding: 12 }}>
            <Chart variant="line" data={adrDataFiltered} xKey="month" series={adrSeriesFiltered} height={220} empty={{ title: 'No ADR history for this category' }} />
          </div>
        </div>
      )}

      {displayMonthsFiltered.length > 0 && (
        <div style={panelStyle}>
          <div style={panelHeader}>OCC <span style={panelHeaderSub}>{chartScopeLabel} · per granular room type · % of canonical capacity</span></div>
          <div style={{ padding: 12 }}>
            <Chart variant="line"
              data={displayMonthsFiltered.map((m) => {
                const row: Record<string, string | number> = { month: m };
                granularTypesFiltered.forEach((rt) => {
                  const idx = granularTypes.indexOf(rt);
                  const r = categoryRowsAllTime.find((x) => x.room_type_name === rt && x.period_yyyymm === m);
                  row[`t${idx}`] = r ? num(r.occ_pct_of_canonical) : 0;
                });
                return row;
              })}
              xKey="month" series={adrSeriesFiltered} height={220}
              empty={{ title: 'No OCC history for this category' }} />
          </div>
        </div>
      )}

      {sourceMix.length > 0 && (
        <div style={panelStyle}>
          <div style={panelHeader}>Source mix · {activePeriod} <span style={panelHeaderSub}>· share of revenue per room type</span></div>
          {Array.from(roomTotals.entries()).sort(([, a], [, b]) => b.rev - a.rev).map(([rt, total]) => {
            const rows = sourceMix.filter((r) => r.room_type_name === rt).sort((a, b) => Number(b.rev) - Number(a.rev));
            return (
              <div key={rt} style={{ padding: '10px 14px', borderTop: '1px solid #E0E0E0' }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink, #1B1B1B)', marginBottom: 6 }}>
                  {rt} <span style={{ color: 'var(--ink-soft, #5A5A5A)', fontWeight: 400 }}>· {currencySymbol}{Math.round(total.rev).toLocaleString('en-US')} · {total.rn} RN</span>
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {rows.map((r) => {
                    const sharePct = total.rev > 0 ? (Number(r.rev) / total.rev) * 100 : 0;
                    return (
                      <div key={`${rt}-${r.source_name}`} style={{
                        fontSize: 11, padding: '4px 10px', borderRadius: 99,
                        border: '1px solid var(--hairline, #E6DFCC)', background: 'var(--paper, #FFFFFF)',
                        color: 'var(--ink, #1B1B1B)', whiteSpace: 'nowrap',
                      }}>
                        {r.source_name} · <strong>{sharePct.toFixed(1)}%</strong>
                        <span style={{ color: 'var(--ink-soft, #5A5A5A)', fontWeight: 400 }}> ({Math.round(Number(r.rev)).toLocaleString('en-US')} · {r.rn}RN)</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── styles ─────────────────────────────────────────────────────────────────
const chartFrameStyle: React.CSSProperties = {
  border: '1px solid var(--hairline, #E6DFCC)', borderRadius: 6,
  background: 'var(--paper, #FFFFFF)', padding: 12,
  display: 'flex', flexDirection: 'column', gap: 6,
};
const chartTitleStyle: React.CSSProperties = {
  fontSize: 11, fontWeight: 600, letterSpacing: '0.06em',
  textTransform: 'uppercase', color: 'var(--ink-soft, #5A5A5A)',
};
function lyCellStyle(diff: number): React.CSSProperties {
  return {
    fontSize: 10,
    color: diff > 0.01 ? '#1F7A5B' : diff < -0.01 ? '#C0584C' : 'var(--ink-soft, #5A5A5A)',
    fontVariantNumeric: 'tabular-nums', marginTop: 2, fontWeight: 500,
  };
}
function formatVarPct(curr: number, ly: number): string {
  if (Math.abs(ly) < 0.01) return '';
  const pct = ((curr - ly) / Math.abs(ly)) * 100;
  return `${pct.toFixed(0)}%`;
}
const panelStyle: React.CSSProperties = {
  border: '1px solid var(--hairline, #E6DFCC)', borderRadius: 6,
  background: 'var(--paper, #FFFFFF)', overflow: 'hidden',
};
const panelHeader: React.CSSProperties = {
  padding: '8px 14px', borderBottom: '1px solid #E0E0E0',
  fontSize: 12, fontWeight: 600,
};
const panelHeaderSub: React.CSSProperties = { color: 'var(--ink-soft, #5A5A5A)', fontWeight: 400 };
const closeLinkStyle: React.CSSProperties = {
  fontSize: 11, color: 'var(--ink-soft, #5A5A5A)', textDecoration: 'none',
  fontWeight: 500, marginLeft: 'auto',
};
const th: React.CSSProperties = {
  padding: '7px 12px', fontSize: 10, fontWeight: 600, letterSpacing: '0.06em',
  textTransform: 'uppercase', color: 'var(--ink-soft, #5A5A5A)', textAlign: 'left',
  borderBottom: '1px solid #E0E0E0',
};
const tdLeft:  React.CSSProperties = { padding: '6px 12px', fontSize: 12, color: 'var(--ink, #1B1B1B)' };
const tdRight: React.CSSProperties = { padding: '6px 12px', fontSize: 12, textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: 'var(--ink, #1B1B1B)' };
