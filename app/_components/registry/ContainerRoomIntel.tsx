// app/_components/registry/ContainerRoomIntel.tsx
// Handler for render_type='room_intel'. Renders category KPI tiles
// (canonical_room_type_code) for the selected period; expanding a tile drills
// into the granular room_type_name table within that category.
//
// Period + expand state via URL (?period= and ?expand=) — server component,
// no client hydration needed. Currency resolved per-property via
// public.v_property_display (money format token).

import Link from 'next/link';
import { Container, KpiTile, type KpiTileProps } from '@/app/(cockpit)/_design';
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
  group_by: string;                       // canonical_room_type_code
  period_field: string;                   // period_yyyymm
  period_picker?: { default?: string; position?: string };
  tile_metrics: TileMetric[];
  drill: { row_field: string; columns: DrillColumn[]; default_sort?: string };
}

interface DataRow extends Record<string, unknown> {
  room_nights?: number;
  room_revenue?: number;
  canonical_capacity_nights?: number;
  canonical_sellable_units?: number;
  adr?: number;
}

interface Props {
  container: ContainerRegistryRow;
  propertyId: number;
  searchParams?: Record<string, string | string[] | undefined>;
}

// Friendly labels per canonical code — generic, not property-specific.
const FRIENDLY: Record<string, string> = {
  DBL:       'Double',
  JR_SUITE:  'Junior Suite',
  SUITE:     'Suite',
  PENTHOUSE: 'Penthouse',
  VILLA:     'Villa',
  GLAMPING:  'Glamping',
};

function num(v: unknown): number {
  const n = Number(v ?? 0);
  return Number.isFinite(n) ? n : 0;
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
      const cap = num(rows[0]?.canonical_capacity_nights);
      return cap > 0 ? rev / cap : 0;
    }
    case 'nights_over_capacity': {
      const nights = rows.reduce((s, r) => s + num(r.room_nights), 0);
      const cap = num(rows[0]?.canonical_capacity_nights);
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

  // 1. Pull every row for this property (cheap; <1k rows per property)
  const { data: allRows, error } = await supabase
    .from(viewName)
    .select('*')
    .eq(filterCol, propertyId);

  if (error || !allRows) {
    return (
      <Container title={container.container_name} subtitle="Query failed" status="red">
        <div style={{ padding: 14, fontSize: 12, color: 'var(--ink-soft, #5A5A5A)' }}>
          {error?.message ?? 'No data returned from ' + viewName + '. Check the registry binding.'}
        </div>
      </Container>
    );
  }

  const rows = allRows as DataRow[];

  // 2. Resolve currency display
  const { data: propRow } = await supabase
    .from('v_property_display')
    .select('display_symbol, display_currency')
    .eq('property_id', propertyId)
    .maybeSingle();
  const currencySymbol = String((propRow as { display_symbol?: string } | null)?.display_symbol ?? '$');

  // 3. Distinct periods (descending) — default to latest
  const allPeriods = Array.from(new Set(rows.map((r) => String(r[periodField] ?? '')).filter(Boolean))).sort().reverse();
  // Default: most-recent REALISED period (≤ current YYYY-MM) so the page
  // lands on a month with broad coverage, not a sparse forward month with
  // a single advance booking.
  const currentYm = new Date().toISOString().slice(0, 7);
  const realised = allPeriods.filter((p) => p <= currentYm);
  const periods = allPeriods;
  const requested = String(searchParams?.period ?? '');
  const fallback = realised[0] ?? allPeriods[0];
  const activePeriod = periods.includes(requested) ? requested : fallback;
  if (!activePeriod) {
    return (
      <Container title={container.container_name} subtitle="No months on file for this property">
        <div style={{ padding: 14, fontSize: 12, color: 'var(--ink-soft, #5A5A5A)' }}>
          <code>{viewName}</code> has no rows for property <code>{propertyId}</code>.
        </div>
      </Container>
    );
  }

  // 4. Filter to the active period; group by canonical code
  const periodRows = rows.filter((r) => String(r[periodField]) === activePeriod);
  const byCat = new Map<string, DataRow[]>();
  for (const r of periodRows) {
    const k = String(r[groupBy] ?? 'UNKNOWN');
    if (!byCat.has(k)) byCat.set(k, []);
    byCat.get(k)!.push(r);
  }
  const categories = Array.from(byCat.entries()).sort(([a], [b]) => a.localeCompare(b));

  // 5. Build href helpers (preserving the other axis of state)
  const activeExpand = String(searchParams?.expand ?? '');
  function hrefPeriod(p: string): string {
    const params = new URLSearchParams();
    if (p !== periods[0]) params.set('period', p);
    if (activeExpand) params.set('expand', activeExpand);
    const qs = params.toString();
    return `?${qs}`;
  }
  function hrefExpand(cat: string): string {
    const params = new URLSearchParams();
    if (activePeriod !== periods[0]) params.set('period', activePeriod);
    if (cat !== activeExpand) params.set('expand', cat);
    const qs = params.toString();
    return qs ? `?${qs}` : '';
  }

  // 6. Render period picker as the Container action
  const periodPicker = (
    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
      {periods.slice(0, 12).map((p) => {
        const active = p === activePeriod;
        return (
          <Link key={p} href={hrefPeriod(p)} style={{
            fontSize: 11, letterSpacing: '0.04em',
            padding: '4px 10px', borderRadius: 99,
            border: `1px solid ${active ? 'var(--primary, #1F3A2E)' : 'var(--hairline, #E6DFCC)'}`,
            background:  active ? 'var(--primary, #1F3A2E)' : 'var(--paper, #FFFFFF)',
            color:       active ? '#FFFFFF' : 'var(--ink, #1B1B1B)',
            fontWeight: active ? 600 : 500, textDecoration: 'none',
            fontVariantNumeric: 'tabular-nums',
          }}>{p}</Link>
        );
      })}
    </div>
  );

  // 7. Build tiles per category
  return (
    <Container
      title={container.container_name}
      subtitle={`${container.subtitle ?? ''} · ${activePeriod} · click a tile to drill into granular room types`.replace(/^ · /, '')}
      density="compact"
      action={periodPicker}
    >
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 12 }}>
        {categories.map(([code, catRows]) => {
          const friendly = FRIENDLY[code] ?? code;
          // Use the highest-revenue room_type_name as a tagline
          const topName = [...catRows].sort((a, b) => num(b.room_revenue) - num(a.room_revenue))[0]?.room_type_name ?? '';
          const tagline = friendly === code ? '' : `${friendly}${topName && String(topName) !== friendly ? ` · ${topName}` : ''}`;
          return (
            <Link
              key={code}
              href={hrefExpand(code)}
              style={{ textDecoration: 'none', color: 'inherit' }}
              aria-label={`Drill into ${friendly}`}
            >
              <div style={{
                border: `1px solid ${code === activeExpand ? 'var(--primary, #1F3A2E)' : 'var(--hairline, #E6DFCC)'}`,
                borderRadius: 6, padding: 14,
                background: 'var(--paper, #FFFFFF)',
                display: 'flex', flexDirection: 'column', gap: 8,
              }}>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--ink-soft, #5A5A5A)' }}>
                    {code}
                  </div>
                  <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--ink, #1B1B1B)' }}>
                    {tagline || friendly}
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 6 }}>
                  {spec.tile_metrics.map((m) => {
                    const v = computeMetric(m, catRows);
                    return (
                      <div key={m.key} style={{ display: 'flex', flexDirection: 'column' }}>
                        <span style={{ fontSize: 10, color: 'var(--ink-soft, #5A5A5A)', letterSpacing: '0.04em' }}>
                          {m.label}
                        </span>
                        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink, #1B1B1B)', fontVariantNumeric: 'tabular-nums' }}>
                          {v == null ? '—' : formatValue(v, m.format as never, currencySymbol)}
                        </span>
                      </div>
                    );
                  })}
                </div>
                <div style={{ fontSize: 10, color: 'var(--ink-soft, #5A5A5A)', textAlign: 'right' }}>
                  {code === activeExpand ? '↑ collapse' : 'expand ↓'}
                </div>
              </div>
            </Link>
          );
        })}
      </div>

      {/* Drill panel — inlined under the tile grid */}
      {activeExpand && byCat.has(activeExpand) && (
        <DrillPanel
          code={activeExpand}
          friendly={FRIENDLY[activeExpand] ?? activeExpand}
          rows={byCat.get(activeExpand)!}
          spec={spec}
          currencySymbol={currencySymbol}
        />
      )}
    </Container>
  );
}

interface DrillProps {
  code: string;
  friendly: string;
  rows: DataRow[];
  spec: RoomIntelSpec;
  currencySymbol: string;
}

function DrillPanel({ code, friendly, rows, spec, currencySymbol }: DrillProps) {
  const sortSpec = (spec.drill.default_sort ?? '').split(/\s+/);
  const sortCol = sortSpec[0] || 'room_revenue';
  const sortDesc = (sortSpec[1] ?? 'desc').toLowerCase() === 'desc';
  const sorted = [...rows].sort((a, b) => {
    const av = num(a[sortCol]); const bv = num(b[sortCol]);
    return sortDesc ? bv - av : av - bv;
  });

  return (
    <div style={{
      marginTop: 6,
      border: '1px solid var(--hairline, #E6DFCC)',
      borderRadius: 6,
      background: 'var(--paper, #FFFFFF)',
      overflow: 'hidden',
    }}>
      <div style={{ padding: '8px 14px', borderBottom: '1px solid var(--hairline, #E6DFCC)', fontSize: 12, fontWeight: 600 }}>
        Drill · {friendly} <span style={{ color: 'var(--ink-soft, #5A5A5A)', fontWeight: 400 }}>· {rows.length} granular room type{rows.length === 1 ? '' : 's'}</span>
      </div>
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
            <tr key={String(r[spec.drill.row_field] ?? i)} style={{ borderTop: '1px solid var(--hairline, #E6DFCC)' }}>
              <td style={tdLeft}>{String(r[spec.drill.row_field] ?? '—')}</td>
              {spec.drill.columns.map((c) => (
                <td key={c.key} style={tdRight}>
                  {formatValue(r[c.key], c.format as never, currencySymbol)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const th: React.CSSProperties = {
  padding: '7px 12px', fontSize: 10, fontWeight: 600, letterSpacing: '0.06em',
  textTransform: 'uppercase', color: 'var(--ink-soft, #5A5A5A)', textAlign: 'left',
  borderBottom: '1px solid var(--hairline, #E6DFCC)',
};
const tdLeft:  React.CSSProperties = { padding: '6px 12px', fontSize: 12, color: 'var(--ink, #1B1B1B)' };
const tdRight: React.CSSProperties = { padding: '6px 12px', fontSize: 12, textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: 'var(--ink, #1B1B1B)' };

// Required by KpiTile re-export from primitives barrel — silence the unused warning.
export type _KpiTileShape = KpiTileProps;
