// app/_components/registry/ContainerTable.tsx
// render_type='table' — pre-format rows server-side; render via primitive table.
// PBS 2026-05-26 (#249): per-container year filter via columns_spec[].year_filter flag
// + URL param yr_<container_code>=YYYY. Renders pill strip above the table.

import { Container, Chart, type ChartSeries } from '@/app/(cockpit)/_design';
import { supabase } from '@/lib/supabase';
import { formatValue, safeText } from './format';
import {
  parseSort, propertyCurrencySymbol, stripPublicPrefix,
  type ContainerRegistryRow, type DataRow,
} from './types';

interface Props {
  container: ContainerRegistryRow;
  propertyId: number;
  searchParams?: Record<string, string | string[] | undefined>;
}

export default async function ContainerTable({ container, propertyId, searchParams }: Props) {
  const view = stripPublicPrefix(container.bound_views?.[0] ?? '');
  if (!view) return <EmptyShell c={container} reason="no bound view configured" />;

  const filterCol = container.primary_filter ?? 'property_id';
  const sort = parseSort(container.default_sort);
  const cols = container.columns_spec ?? [];

  // PBS 2026-05-26: year filter discovery — find a column declaring year_filter: true.
  // URL param key: yr_<container_code>. When set + valid 4-digit year, filter via gte/lt.
  const yearFilterCol = (cols.find((c) => (c as { year_filter?: boolean }).year_filter) as { key: string } | undefined)?.key;
  const yrParamKey = `yr_${container.container_code}`;
  const yrRaw = String(searchParams?.[yrParamKey] ?? '');
  const yr = /^20\d{2}$/.test(yrRaw) ? Number(yrRaw) : null;

  let q = supabase.from(view).select('*').eq(filterCol, propertyId);
  if (yearFilterCol && yr) {
    q = q.gte(yearFilterCol, `${yr}-01-01`).lt(yearFilterCol, `${yr + 1}-01-01`);
  }
  if (sort) q = q.order(sort.col, { ascending: sort.ascending });

  const { data, error } = await q;
  if (error) return <EmptyShell c={container} reason={`query error: ${error.message}`} />;
  const rows = (data ?? []) as DataRow[];

  const symbol = propertyCurrencySymbol(propertyId);
  const xKey = cols[0]?.key ?? 'id';

  const formattedRows = rows.map((r) => {
    const out: Record<string, string | number> = {};
    for (const c of cols) {
      const v = r[c.key];
      out[c.key] = c.format === 'text' ? safeText(v) : formatValue(v, c.format, symbol);
    }
    return out;
  });

  const series: ChartSeries[] = cols.slice(1).map((c) => ({ key: c.key, label: c.label }));

  // Year pill strip — built only when this container declares year_filter
  const yearPills = yearFilterCol ? (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 4px', flexWrap: 'wrap' }}>
      <span style={{ fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--ink-soft, #5A5A5A)' }}>Year:</span>
      {(['all', '2024', '2025', '2026'] as const).map((y) => {
        const isActive = (y === 'all' && !yr) || String(yr) === y;
        const sp = new URLSearchParams();
        for (const [k, v] of Object.entries(searchParams ?? {})) {
          if (k === yrParamKey) continue;
          if (typeof v === 'string') sp.set(k, v);
        }
        if (y !== 'all') sp.set(yrParamKey, y);
        const href = sp.toString() ? `?${sp.toString()}` : '?';
        return (
          <a key={y} href={href} style={{
            padding: '2px 9px', borderRadius: 999, border: '1px solid var(--hairline, #E6DFCC)',
            textDecoration: 'none', fontSize: 11,
            color: isActive ? 'var(--paper, #FFFFFF)' : 'var(--ink, #1B1B1B)',
            background: isActive ? 'var(--primary, #1F3A2E)' : 'transparent',
            fontWeight: isActive ? 600 : 400,
          }}>{y === 'all' ? 'All' : y}</a>
        );
      })}
    </div>
  ) : null;

  if (rows.length === 0) {
    return (
      <Container title={container.container_name} subtitle={container.subtitle ?? undefined}>
        {yearPills}
        <div style={{ padding: 18, fontSize: 12, color: 'var(--ink-soft, #5A5A5A)', fontStyle: 'italic' }}>
          {yr ? `No rows for ${yr}.` : 'No data for this property'}
        </div>
      </Container>
    );
  }

  return (
    <Container title={container.container_name} subtitle={container.subtitle ?? undefined}>
      {yearPills}
      <Chart
        variant="table"
        data={formattedRows}
        xKey={xKey}
        series={series}
        empty={{ title: 'No rows', hint: view }}
      />
    </Container>
  );
}

function EmptyShell({ c, reason }: { c: ContainerRegistryRow; reason: string }) {
  return (
    <Container title={c.container_name} subtitle={c.subtitle ?? undefined}>
      <div style={{ padding: 18, fontSize: 12, color: 'var(--ink-soft, #5A5A5A)', fontStyle: 'italic' }}>
        {reason}
      </div>
    </Container>
  );
}
