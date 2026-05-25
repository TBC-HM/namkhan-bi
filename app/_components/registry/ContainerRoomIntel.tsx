// app/_components/registry/ContainerRoomIntel.tsx
// Handler for render_type='room_intel'. Renders category KPI tiles
// (canonical_room_type_code) for the selected period; expanding a tile
// drills into (a) granular room_type_name table, (b) last-12-month ADR
// line chart per granular type, (c) source-mix breakdown per room.
//
// State via URL: ?period=YYYY-MM or ?period=YTD-YYYY, ?expand=<canonical>.
// Currency resolved per-property via public.v_property_display.

import Link from 'next/link';
import { Container, Chart, type ChartSeries } from '@/app/(cockpit)/_design';
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

/** Per-room capacity (prefer room_capacity_nights when present, else canonical fallback).
 *  Capacity repeats per row within a period — dedupe by period before summing. */
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

export default async function ContainerRoomIntel({ container, propertyId, searchParams }: Props) {
  const spec = (container.columns_spec as unknown) as RoomIntelSpec;
  const viewName = stripPublicPrefix(container.bound_views?.[0] ?? 'v_room_type_performance_monthly');
  const groupBy  = spec.group_by ?? 'canonical_room_type_code';
  const periodField = spec.period_field ?? 'period_yyyymm';
  const filterCol = container.primary_filter ?? 'property_id';

  // 1. All rows for this property
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
  // Per-room unit counts → enables per-room occ/revpar (canonical fallback when missing).
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
    .map((r) => {
      const u = unitsByName.get(String(r.room_type_name ?? '')) ?? 0;
      const d = daysInPeriod(String(r.period_yyyymm ?? ''));
      return { ...r, room_sellable_units: u, room_capacity_nights: u * d } as DataRow;
    });

  // 2. Currency
  const { data: propRow } = await supabase
    .from('v_property_display')
    .select('display_symbol, display_currency').eq('property_id', propertyId).maybeSingle();
  const currencySymbol = String((propRow as { display_symbol?: string } | null)?.display_symbol ?? '$');

  // 2b. Direct-sales share per canonical category (PBS 2026-05-22 task #87)
  // Always YTD scope for stability; could be parameterized to active period later.
  const currentYearStr = new Date().toISOString().slice(0, 4);
  const { data: directRows } = await supabase
    .rpc('fn_room_direct_share', { p_property_id: propertyId, p_period_yyyymm: null, p_year: currentYearStr });
  const directByCanon = new Map<string, number>();
  for (const r of ((directRows ?? []) as Array<{ canonical_room_type_code: string; direct_share_pct: number }>)) {
    directByCanon.set(String(r.canonical_room_type_code), Number(r.direct_share_pct ?? 0));
  }

  // 3. Periods — discrete months + a YTD pill for current year.
  // PBS 2026-05-22: future months (OTB) must be visible. Window = past 12
  // months + current + every future month the view has data for.
  const allPeriods = Array.from(new Set(rows.map((r) => String(r.period_yyyymm ?? '')).filter(Boolean))).sort().reverse();
  const currentYm = new Date().toISOString().slice(0, 7);
  const currentYear = currentYm.slice(0, 4);
  const past12Floor = (() => {
    const d = new Date(currentYm + '-01T00:00:00Z');
    d.setUTCMonth(d.getUTCMonth() - 11);
    return d.toISOString().slice(0, 7);
  })();
  const windowMonths = allPeriods.filter((p) => p >= past12Floor);
  const realisedMonths = windowMonths.filter((p) => p <= currentYm);
  const ytdKey = `YTD-${currentYear}`;
  const requested = String(searchParams?.period ?? '');
  const isYtd = requested === ytdKey;
  // USALI task #8: aggregate periods (FY + Q1-4) derived from every year in data
  const AGGREGATE_YEARS = Array.from(new Set(allPeriods.map((p) => p.slice(0, 4)))).filter(Boolean).sort();
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

  // 4. Filter rows to the active period (single month / YTD / FY / Q1-4)
  function quarterMonths(qCode: string): string[] {
    const q = Number(qCode.charAt(1));
    const y = qCode.slice(3);
    const startMonth = (q - 1) * 3 + 1;
    return [0, 1, 2].map((i) => `${y}-${String(startMonth + i).padStart(2, '0')}`);
  }
  const isFY = activePeriod.startsWith('FY-');
  const isQ  = /^Q[1-4]-\d{4}$/.test(activePeriod);
  const periodRows = isYtd || activePeriod.startsWith('YTD-')
    ? rows.filter((r) => {
        const p = String(r.period_yyyymm ?? '');
        return p.startsWith(`${activePeriod.slice(4)}-`) && p <= currentYm;
      })
    : isFY
    ? rows.filter((r) => String(r.period_yyyymm ?? '').startsWith(`${activePeriod.slice(3)}-`))
    : isQ
    ? (() => { const qm = new Set(quarterMonths(activePeriod)); return rows.filter((r) => qm.has(String(r.period_yyyymm ?? ''))); })()
    : rows.filter((r) => String(r.period_yyyymm) === activePeriod);

  // 4b. PBS 2026-05-22: same-time-last-year rows for LY comparison per tile.
  function lyOf(p: string): string {
    if (p.startsWith('YTD-')) {
      const y = Number(p.slice(4));
      return Number.isFinite(y) ? `YTD-${y - 1}` : p;
    }
    if (p.startsWith('FY-')) {
      const y = Number(p.slice(3));
      return Number.isFinite(y) ? `FY-${y - 1}` : p;
    }
    if (/^Q[1-4]-\d{4}$/.test(p)) {
      const y = Number(p.slice(3));
      return Number.isFinite(y) ? `${p.slice(0, 3)}${y - 1}` : p;
    }
    if (p.length >= 7) {
      const y = Number(p.slice(0, 4));
      const mm = p.slice(5, 7);
      return Number.isFinite(y) ? `${y - 1}-${mm}` : p;
    }
    return p;
  }
  // USALI task #9 — comparison source (SDLY default | BUDGET stub; BUDGET → empty LY rows until per-cat budget view ships)
  const cmpMode = String(searchParams?.cmp ?? 'sdly');
  const lyPeriod = lyOf(activePeriod);
  const elapsedMm = currentYm.slice(5, 7);
  const lyRows: DataRow[] = cmpMode === 'budget' ? [] : lyPeriod.startsWith('YTD-')
    ? rows.filter((r) => {
        const p = String(r.period_yyyymm ?? '');
        return p.startsWith(`${lyPeriod.slice(4)}-`) && p.slice(5, 7) <= elapsedMm;
      })
    : lyPeriod.startsWith('FY-')
    ? rows.filter((r) => String(r.period_yyyymm ?? '').startsWith(`${lyPeriod.slice(3)}-`))
    : /^Q[1-4]-\d{4}$/.test(lyPeriod)
    ? (() => { const qm = new Set(quarterMonths(lyPeriod)); return rows.filter((r) => qm.has(String(r.period_yyyymm ?? ''))); })()
    : rows.filter((r) => String(r.period_yyyymm) === lyPeriod);

  // 5. Build category index — every REAL canonical code the property has had.
  //    Junk buckets like 'OTHER' (1-row uncategorised fallback) are excluded so
  //    the tile grid only shows actual room categories.
  // Tile categories: when grouping by canonical, keep only real codes (strip OTHER junk).
  // When grouping granular (room_type_name), keep every non-empty distinct value.
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
  // Build label tagline from any row in this category (top revenue subtype)
  const taglineByCat = new Map<string, string>();
  for (const cat of allCategories) {
    const catRows = rows.filter((r) => r[groupBy] === cat);
    const top = [...catRows].sort((a, b) => num(b.room_revenue) - num(a.room_revenue))[0];
    taglineByCat.set(cat, String(top?.room_type_name ?? ''));
  }

  // 6. Active expand
  const activeExpand = String(searchParams?.expand ?? '');

  // 7. Period picker href helpers
  function hrefPeriod(p: string): string {
    const params = new URLSearchParams();
    if (p !== realisedMonths[0]) params.set('period', p);
    if (activeExpand) params.set('expand', activeExpand);
    const qs = params.toString();
    return qs ? `?${qs}` : '';
  }
  function hrefExpand(cat: string): string {
    const params = new URLSearchParams();
    if (activePeriod !== realisedMonths[0]) params.set('period', activePeriod);
    if (cat !== activeExpand) params.set('expand', cat);
    const qs = params.toString();
    return qs ? `?${qs}` : '';
  }

  // PBS 2026-05-22: switched 24-pill bar → compact <select> dropdown.
  // PeriodDropdown is a client component that pushes period into URL while
  // preserving ?expand=. Default = realisedMonths[0] (latest realised month).
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
        preserveParams={{ expand: activeExpand, cmp: cmpMode === 'sdly' ? undefined : cmpMode }}
      />
      <CompareDropdown
        activeCmp={cmpMode}
        preserveParams={{ expand: activeExpand, period: activePeriod === realisedMonths[0] ? undefined : activePeriod }}
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
      {/* PBS 2026-05-22: 4 headline KPIs aggregated across all categories. */}
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
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
            gap: 8, marginBottom: 12,
          }}>
            {tile('Occupancy', `${occ.toFixed(1)}%`)}
            {tile('ADR', `${currencySymbol}${Math.round(avgAdr).toLocaleString()}`)}
            {tile('Room nights', totalNights.toLocaleString())}
            {tile('Room revenue', `${currencySymbol}${Math.round(totalRev).toLocaleString()}`)}
          </div>
        );
      })()}

      {/* PBS 2026-05-22 task #84: 3 graphs (ADR bar + REV bar + OCC donut) */}
      {(() => {
        const catChart = allCategories.map((code) => {
          const r = rowsByCatActive.get(code) ?? [];
          const friendly = FRIENDLY[code] ?? code;
          const rev = r.reduce((s, x) => s + num(x.room_revenue), 0);
          const nights = r.reduce((s, x) => s + num(x.room_nights), 0);
          const adr = nights > 0 ? rev / nights : 0;
          // canonical capacity = first row per period (canonical_capacity_nights is identical across granular rows in the same category/month)
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
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
            gap: 12, marginBottom: 12,
          }}>
            <div style={chartFrameStyle}>
              <div style={chartTitleStyle}>ADR by category</div>
              <Chart variant="bar" data={catChart} xKey="category"
                series={[{ key: 'adr', label: 'ADR', color: 'var(--brass, #B8A878)' }]}
                height={180}
                empty={{ title: 'No ADR data' }} />
            </div>
            <div style={chartFrameStyle}>
              <div style={chartTitleStyle}>Revenue by category</div>
              <Chart variant="bar" data={catChart} xKey="category"
                series={[{ key: 'revenue', label: 'Revenue', color: 'var(--primary, #1F3A2E)' }]}
                height={180}
                empty={{ title: 'No revenue data' }} />
            </div>
            <div style={chartFrameStyle}>
              <div style={chartTitleStyle}>Occupancy by category</div>
              {/* USALI task #7: donut → bar (axis read beats sector arcs for cross-category compare) */}
              <Chart variant="bar" data={catChart} xKey="category"
                series={[{ key: 'occ', label: 'Occ %', color: 'var(--terracotta, #B8542A)' }]}
                height={180}
                empty={{ title: 'No occupancy data' }} />
            </div>
          </div>
        );
      })()}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 12 }}>
        {allCategories.map((code) => {
          const catRows = rowsByCatActive.get(code) ?? [];
          const friendly = FRIENDLY[code] ?? code;
          const tagline = taglineByCat.get(code) ?? '';
          const isExpanded = code === activeExpand;
          const hasData = catRows.length > 0;
          return (
            <Link key={code} href={hrefExpand(code)} style={{ textDecoration: 'none', color: 'inherit' }}>
              <div style={{
                border: `1px solid ${isExpanded ? 'var(--primary, #1F3A2E)' : 'var(--hairline, #E6DFCC)'}`,
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
                      if (isPctMetric) {
                        deltaTxt = `${diff.toFixed(1)}pp`;
                      } else if (Math.abs(lyV!) > 0.01) {
                        deltaTxt = `${((diff / Math.abs(lyV!)) * 100).toFixed(0)}%`;
                      }
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
                              {deltaTxt && (
                                <span style={{ marginLeft: 6, color: deltaColor, fontWeight: 600 }}>{deltaTxt}</span>
                              )}
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
                      borderTop: '1px solid var(--hairline, #E6DFCC)',
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
                <div style={{ fontSize: 10, color: 'var(--ink-soft, #5A5A5A)', textAlign: 'right' }}>
                  {!hasData ? 'no data this period · click for history' : isExpanded ? '↑ collapse' : 'expand ↓'}
                </div>
              </div>
            </Link>
          );
        })}
      </div>

      {/* PBS #145 hotfix: DrillPanel's internal Chart uses tooltipFormatter (a function), which can't be serialised across server→client when wrapped inside the client DrillDrawer. Reverting to inline render. IcpSection renders as a sibling below. */}
      {activeExpand && (
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
      )}
      {activeExpand && <IcpSection category={activeExpand} />}
    </Container>
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
  // USALI task #6: drill filters (server-side, URL-driven)
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

  // 12-month ADR series per granular room_type_name from the all-time rows
  const last12Months: string[] = (() => {
    const months = Array.from(new Set(categoryRowsAllTime.map((r) => String(r.period_yyyymm ?? ''))))
      .filter(Boolean).sort();
    return months.slice(-12);
  })();
  const adrSeries: ChartSeries[] = [];
  const adrData: Array<Record<string, string | number>> = last12Months.map((m) => ({ month: m }));
  const granularTypes = Array.from(new Set(categoryRowsAllTime.map((r) => String(r.room_type_name ?? '')))).sort();
  const PALETTE = ['#1F3A2E', '#B8542A', '#B8A878', '#5B7A5A', '#8A2A1D', '#3A7CA5'];
  granularTypes.forEach((rt, idx) => {
    adrSeries.push({ key: `t${idx}`, label: rt, color: PALETTE[idx % PALETTE.length] });
    last12Months.forEach((m, mIdx) => {
      const row = categoryRowsAllTime.find((r) => r.room_type_name === rt && r.period_yyyymm === m);
      adrData[mIdx][`t${idx}`] = row ? num(row.adr) : 0;
      adrData[mIdx][`t${idx}_rn`] = row ? num(row.room_nights) : 0;
      // task #96: LOS now sourced from view's avg_los column (nights / bookings)
      adrData[mIdx][`t${idx}_los`] = row ? num(row.avg_los) : 0;
      adrData[mIdx][`t${idx}_bk`] = row ? num(row.bookings) : 0;
    });
  });
  // labels for tooltip lookup
  const seriesLabelByKey: Record<string, string> = {};
  granularTypes.forEach((rt, idx) => { seriesLabelByKey[`t${idx}`] = rt; });

  // USALI task #6 — derived filter state (search · multi-select · year)
  const qLower = q.trim().toLowerCase();
  const granularTypesFiltered = granularTypes.filter((rt) =>
    (!qLower || rt.toLowerCase().includes(qLower)) &&
    (rtList.length === 0 || rtList.includes(rt))
  );
  const last12MonthsFiltered = yrFilter
    ? last12Months.filter((m) => m.startsWith(yrFilter))
    : last12Months;
  const adrDataFiltered = last12MonthsFiltered.map((m) => adrData.find((d) => d.month === m) ?? { month: m });
  const adrSeriesFiltered = adrSeries.filter((s) => granularTypesFiltered.some((rt) => seriesLabelByKey[String(s.key)] === rt));
  const sortedFiltered = sorted.filter((r) => granularTypesFiltered.includes(String(r.room_type_name ?? '')));
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

  // Source mix per granular room_type (RPC call)
  const { data: sourceMixRows } = await supabase.rpc('fn_room_source_mix', {
    p_property_id: propertyId,
    p_period_yyyymm: activePeriod,
    p_canonical_code: code,
  });
  const sourceMix = (sourceMixRows ?? []) as Array<{ room_type_name: string; source_name: string; rn: number; rev: number }>;
  // Per-room totals + per-source share
  const roomTotals = new Map<string, { rev: number; rn: number }>();
  for (const r of sourceMix) {
    const t = roomTotals.get(r.room_type_name) ?? { rev: 0, rn: 0 };
    t.rev += Number(r.rev); t.rn += Number(r.rn);
    roomTotals.set(r.room_type_name, t);
  }

  return (
    <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* Granular table */}
      {/* USALI task #6 — drill filter toolbar (year · search · multi-select chips) */}
      <div style={panelStyle}>
        <div style={{ padding: '10px 14px', display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center' }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--ink-soft, #5A5A5A)' }}>Year</div>
          {[{ k: '', label: 'All' }, { k: '2025', label: '2025' }, { k: '2026', label: '2026' }, { k: '2027', label: '2027' }].map((y) => {
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
              fontSize: 12, padding: '4px 8px',
              border: '1px solid var(--hairline, #E6DFCC)', borderRadius: 4,
              background: 'var(--paper, #FFFFFF)', color: 'var(--ink, #1B1B1B)', minWidth: 140,
            }} />
            {q && (
              <Link href={hrefDrillToggle({ q: null })} style={{ fontSize: 11, color: 'var(--ink-soft, #5A5A5A)', textDecoration: 'underline' }}>clear</Link>
            )}
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
            {rtList.length > 0 && (
              <Link href={hrefDrillToggle({ rt: null })} style={{ fontSize: 11, color: 'var(--ink-soft, #5A5A5A)', textDecoration: 'underline', alignSelf: 'center', marginLeft: 6 }}>clear</Link>
            )}
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
              <tr style={{ background: '#FAFAF7' }}>
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
                const ly = lyP
                  ? categoryRowsAllTime.find((x) =>
                      x.room_type_name === r.room_type_name &&
                      String(x.period_yyyymm ?? '') === lyP)
                  : null;
                const rn  = num(r.room_nights);
                const rev = num(r.room_revenue);
                const occ = num(r.occ_pct_of_canonical);
                const rnLy  = ly ? num(ly.room_nights) : null;
                const revLy = ly ? num(ly.room_revenue) : null;
                const occLy = ly ? num(ly.occ_pct_of_canonical) : null;
                const rowKey = `${String(r[spec.drill.row_field as keyof DataRow] ?? i)}|${period}`;
                return (
                  <tr key={rowKey} style={{ borderTop: '1px solid var(--hairline, #E6DFCC)' }}>
                    <td style={tdLeft}>{String(r[spec.drill.row_field as keyof DataRow] ?? '—')}</td>
                    <td style={tdLeft}>{period || '—'}</td>
                    <td style={tdRight}>
                      <div>{rn.toLocaleString()}</div>
                      {rnLy != null && rnLy > 0 && (
                        <div style={lyCellStyle(rn - rnLy)}>
                          LY {rnLy.toLocaleString()}  {formatVarPct(rn, rnLy)}
                        </div>
                      )}
                    </td>
                    <td style={tdRight}>
                      <div>{formatValue(rev, 'money', currencySymbol)}</div>
                      {revLy != null && revLy > 0 && (
                        <div style={lyCellStyle(rev - revLy)}>
                          LY {formatValue(revLy, 'money', currencySymbol)}  {formatVarPct(rev, revLy)}
                        </div>
                      )}
                    </td>
                    <td style={tdRight}>
                      <div>{occ.toFixed(1)}%</div>
                      {occLy != null && occLy > 0 && (
                        <div style={lyCellStyle(occ - occLy)}>
                          LY {occLy.toFixed(1)}%  {(occ - occLy).toFixed(1)}pp
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* 12-month ADR rollup */}
      {last12MonthsFiltered.length > 0 && (
        <div style={panelStyle}>
          <div style={panelHeader}>
            ADR · last 12 months <span style={panelHeaderSub}>· per granular room type</span>
          </div>
          <div style={{ padding: 12 }}>
            {/* PBS #145 hotfix-2: tooltipFormatter (a function) crashes server→client into the DashboardPage ('use client') boundary. Drop the custom formatter — default tooltip shows key/value pairs. Custom hover detail returns once Chart accepts a string enum for format. */}
            <Chart variant="line" data={adrDataFiltered} xKey="month" series={adrSeriesFiltered} height={220}
              empty={{ title: 'No ADR history for this category' }} />
          </div>
        </div>
      )}

      {/* USALI task #5 — OCC line chart per granular room type (sibling of ADR rollup, no shared state) */}
      {last12MonthsFiltered.length > 0 && (
        <div style={panelStyle}>
          <div style={panelHeader}>
            OCC · last 12 months <span style={panelHeaderSub}>· per granular room type · % of canonical capacity</span>
          </div>
          <div style={{ padding: 12 }}>
            <Chart
              variant="line"
              data={last12MonthsFiltered.map((m) => {
                const row: Record<string, string | number> = { month: m };
                granularTypesFiltered.forEach((rt) => {
                  const idx = granularTypes.indexOf(rt);
                  const r = categoryRowsAllTime.find((x) => x.room_type_name === rt && x.period_yyyymm === m);
                  row[`t${idx}`] = r ? num(r.occ_pct_of_canonical) : 0;
                });
                return row;
              })}
              xKey="month"
              series={adrSeriesFiltered}
              height={220}
              empty={{ title: 'No OCC history for this category' }}
            />
          </div>
        </div>
      )}

      {/* Source mix per granular room type */}
      {sourceMix.length > 0 && (
        <div style={panelStyle}>
          <div style={panelHeader}>
            Source mix · {activePeriod} <span style={panelHeaderSub}>· share of revenue per room type</span>
          </div>
          {Array.from(roomTotals.entries())
            .sort(([, a], [, b]) => b.rev - a.rev)
            .map(([rt, total]) => {
              const rows = sourceMix
                .filter((r) => r.room_type_name === rt)
                .sort((a, b) => Number(b.rev) - Number(a.rev));
              return (
                <div key={rt} style={{ padding: '10px 14px', borderTop: '1px solid var(--hairline, #E6DFCC)' }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink, #1B1B1B)', marginBottom: 6 }}>
                    {rt} <span style={{ color: 'var(--ink-soft, #5A5A5A)', fontWeight: 400 }}>· {currencySymbol}{Math.round(total.rev).toLocaleString('en-US')} · {total.rn} RN</span>
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {rows.map((r) => {
                      const sharePct = total.rev > 0 ? (Number(r.rev) / total.rev) * 100 : 0;
                      return (
                        <div key={`${rt}-${r.source_name}`} style={{
                          fontSize: 11, padding: '4px 10px', borderRadius: 99,
                          border: '1px solid var(--hairline, #E6DFCC)',
                          background: 'var(--paper, #FFFFFF)', color: 'var(--ink, #1B1B1B)',
                          whiteSpace: 'nowrap',
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
    fontVariantNumeric: 'tabular-nums',
    marginTop: 2,
    fontWeight: 500,
  };
}
function formatVarPct(curr: number, ly: number): string {
  if (Math.abs(ly) < 0.01) return '';
  const pct = ((curr - ly) / Math.abs(ly)) * 100;
  return `${pct.toFixed(0)}%`;
}
function pillStyle(active: boolean, ytd: boolean, future: boolean = false): React.CSSProperties {
  const borderColor = active ? 'var(--primary, #1F3A2E)'
    : ytd ? 'var(--terracotta, #B8542A)'
    : future ? 'var(--brass, #B8A878)'
    : 'var(--hairline, #E6DFCC)';
  const fg = active ? '#FFFFFF'
    : ytd ? 'var(--terracotta, #B8542A)'
    : future ? 'var(--brass, #B8A878)'
    : 'var(--ink, #1B1B1B)';
  return {
    fontSize: 11, letterSpacing: '0.04em',
    padding: '4px 10px', borderRadius: 99,
    border: `1px solid ${borderColor}`,
    background:  active ? 'var(--primary, #1F3A2E)' : 'var(--paper, #FFFFFF)',
    color:       fg,
    fontWeight: active || ytd || future ? 600 : 500, textDecoration: 'none',
    fontVariantNumeric: 'tabular-nums',
  };
}
const panelStyle: React.CSSProperties = {
  border: '1px solid var(--hairline, #E6DFCC)', borderRadius: 6,
  background: 'var(--paper, #FFFFFF)', overflow: 'hidden',
};
const panelHeader: React.CSSProperties = {
  padding: '8px 14px', borderBottom: '1px solid var(--hairline, #E6DFCC)',
  fontSize: 12, fontWeight: 600,
};
const panelHeaderSub: React.CSSProperties = { color: 'var(--ink-soft, #5A5A5A)', fontWeight: 400 };
const th: React.CSSProperties = {
  padding: '7px 12px', fontSize: 10, fontWeight: 600, letterSpacing: '0.06em',
  textTransform: 'uppercase', color: 'var(--ink-soft, #5A5A5A)', textAlign: 'left',
  borderBottom: '1px solid var(--hairline, #E6DFCC)',
};
const tdLeft:  React.CSSProperties = { padding: '6px 12px', fontSize: 12, color: 'var(--ink, #1B1B1B)' };
const tdRight: React.CSSProperties = { padding: '6px 12px', fontSize: 12, textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: 'var(--ink, #1B1B1B)' };
