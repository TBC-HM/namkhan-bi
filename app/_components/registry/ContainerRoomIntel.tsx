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

/** Sum canonical_capacity_nights deduped on period (capacity repeats per granular row in the same period). */
function totalCapacity(rows: DataRow[]): number {
  const byPeriod = new Map<string, number>();
  for (const r of rows) {
    const p = String(r.period_yyyymm ?? '');
    const cap = num(r.canonical_capacity_nights);
    if (!byPeriod.has(p)) byPeriod.set(p, cap);
  }
  let total = 0;
  for (const c of byPeriod.values()) total += c;
  return total;
}

function computeMetric(metric: TileMetric, rows: DataRow[]): number | null {
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
      const cap = totalCapacity(rows);
      return cap > 0 ? rev / cap : 0;
    }
    case 'nights_over_capacity': {
      const nights = rows.reduce((s, r) => s + num(r.room_nights), 0);
      const cap = totalCapacity(rows);
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
  const rows = allRows as DataRow[];

  // 2. Currency
  const { data: propRow } = await supabase
    .from('v_property_display')
    .select('display_symbol, display_currency').eq('property_id', propertyId).maybeSingle();
  const currencySymbol = String((propRow as { display_symbol?: string } | null)?.display_symbol ?? '$');

  // 3. Periods — discrete months + a YTD pill for current year
  const allPeriods = Array.from(new Set(rows.map((r) => String(r.period_yyyymm ?? '')).filter(Boolean))).sort().reverse();
  const currentYm = new Date().toISOString().slice(0, 7);
  const currentYear = currentYm.slice(0, 4);
  const realisedMonths = allPeriods.filter((p) => p <= currentYm);
  const ytdKey = `YTD-${currentYear}`;
  const requested = String(searchParams?.period ?? '');
  const isYtd = requested === ytdKey;
  const validPeriods = new Set([ytdKey, ...allPeriods]);
  const activePeriod = validPeriods.has(requested) ? requested : (realisedMonths[0] ?? allPeriods[0]);
  if (!activePeriod) {
    return (
      <Container title={container.container_name} subtitle="No data on file">
        <div style={{ padding: 14, fontSize: 12, color: 'var(--ink-soft, #5A5A5A)' }}>
          <code>{viewName}</code> has no rows for property <code>{propertyId}</code>.
        </div>
      </Container>
    );
  }

  // 4. Filter rows to the active period (single month or YTD)
  const periodRows = isYtd || activePeriod.startsWith('YTD-')
    ? rows.filter((r) => String(r.period_yyyymm ?? '').startsWith(`${activePeriod.slice(4)}-`))
    : rows.filter((r) => String(r.period_yyyymm) === activePeriod);

  // 5. Build category index — every canonical code the property has EVER had,
  //    so all categories surface even if the active period has zero rows for them.
  const allCategories = Array.from(new Set(
    rows.map((r) => String(r[groupBy] ?? '')).filter(Boolean)
  )).sort();

  const rowsByCatActive = new Map<string, DataRow[]>();
  for (const r of periodRows) {
    const k = String(r[groupBy] ?? 'UNKNOWN');
    if (!rowsByCatActive.has(k)) rowsByCatActive.set(k, []);
    rowsByCatActive.get(k)!.push(r);
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

  const periodPicker = (
    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', alignItems: 'center' }}>
      <Link href={hrefPeriod(ytdKey)} style={pillStyle(activePeriod === ytdKey, true)}>YTD {currentYear}</Link>
      {realisedMonths.slice(0, 12).map((p) => (
        <Link key={p} href={hrefPeriod(p)} style={pillStyle(activePeriod === p, false)}>{p}</Link>
      ))}
    </div>
  );

  return (
    <Container
      title={container.container_name}
      subtitle={`${container.subtitle ?? ''} · ${activePeriod}${activePeriod.startsWith('YTD-') ? ` · ${realisedMonths.filter((p) => p.startsWith(`${activePeriod.slice(4)}-`)).length} months` : ''} · click a tile to drill`.replace(/^ · /, '')}
      density="compact"
      action={periodPicker}
    >
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
                  <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--ink-soft, #5A5A5A)' }}>{code}</div>
                  <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--ink, #1B1B1B)' }}>
                    {friendly}{tagline && tagline !== friendly ? ` · ${tagline}` : ''}
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 6 }}>
                  {spec.tile_metrics.map((m) => {
                    const v = computeMetric(m, catRows);
                    return (
                      <div key={m.key} style={{ display: 'flex', flexDirection: 'column' }}>
                        <span style={{ fontSize: 10, color: 'var(--ink-soft, #5A5A5A)', letterSpacing: '0.04em' }}>{m.label}</span>
                        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink, #1B1B1B)', fontVariantNumeric: 'tabular-nums' }}>
                          {v == null ? '—' : formatValue(v, m.format as never, currencySymbol)}
                        </span>
                      </div>
                    );
                  })}
                </div>
                <div style={{ fontSize: 10, color: 'var(--ink-soft, #5A5A5A)', textAlign: 'right' }}>
                  {!hasData ? 'no data this period · click for history' : isExpanded ? '↑ collapse' : 'expand ↓'}
                </div>
              </div>
            </Link>
          );
        })}
      </div>

      {activeExpand && (
        <DrillPanel
          code={activeExpand}
          friendly={FRIENDLY[activeExpand] ?? activeExpand}
          activePeriod={activePeriod}
          propertyId={propertyId}
          categoryRowsAllTime={rows.filter((r) => r[groupBy] === activeExpand)}
          categoryRowsActive={rowsByCatActive.get(activeExpand) ?? []}
          spec={spec}
          currencySymbol={currencySymbol}
        />
      )}
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
}

async function DrillPanel({
  code, friendly, activePeriod, propertyId,
  categoryRowsAllTime, categoryRowsActive, spec, currencySymbol,
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
    });
  });

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
      <div style={panelStyle}>
        <div style={panelHeader}>
          Drill · {friendly} <span style={panelHeaderSub}>· {sorted.length} granular room type{sorted.length === 1 ? '' : 's'} · {activePeriod}</span>
        </div>
        {sorted.length === 0 ? (
          <div style={{ padding: 14, fontSize: 12, color: 'var(--ink-soft, #5A5A5A)', fontStyle: 'italic' }}>
            No granular rows for this category in {activePeriod}.
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr style={{ background: '#FAFAF7' }}>
                <th style={th}>{spec.drill.row_field === 'room_type_name' ? 'Room type' : spec.drill.row_field}</th>
                {spec.drill.columns.map((c) => (
                  <th key={c.key} style={{ ...th, textAlign: 'right' }}>{c.label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sorted.map((r, i) => (
                <tr key={String(r[spec.drill.row_field as keyof DataRow] ?? i)} style={{ borderTop: '1px solid var(--hairline, #E6DFCC)' }}>
                  <td style={tdLeft}>{String(r[spec.drill.row_field as keyof DataRow] ?? '—')}</td>
                  {spec.drill.columns.map((c) => (
                    <td key={c.key} style={tdRight}>
                      {formatValue(r[c.key as keyof DataRow], c.format as never, currencySymbol)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* 12-month ADR rollup */}
      {last12Months.length > 0 && (
        <div style={panelStyle}>
          <div style={panelHeader}>
            ADR · last 12 months <span style={panelHeaderSub}>· per granular room type</span>
          </div>
          <div style={{ padding: 12 }}>
            <Chart variant="line" data={adrData} xKey="month" series={adrSeries} height={220}
              empty={{ title: 'No ADR history for this category' }} />
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
function pillStyle(active: boolean, ytd: boolean): React.CSSProperties {
  return {
    fontSize: 11, letterSpacing: '0.04em',
    padding: '4px 10px', borderRadius: 99,
    border: `1px solid ${active ? 'var(--primary, #1F3A2E)' : ytd ? 'var(--terracotta, #B8542A)' : 'var(--hairline, #E6DFCC)'}`,
    background:  active ? 'var(--primary, #1F3A2E)' : 'var(--paper, #FFFFFF)',
    color:       active ? '#FFFFFF' : ytd ? 'var(--terracotta, #B8542A)' : 'var(--ink, #1B1B1B)',
    fontWeight: active || ytd ? 600 : 500, textDecoration: 'none',
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
