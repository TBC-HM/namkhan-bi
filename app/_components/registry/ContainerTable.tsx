// app/_components/registry/ContainerTable.tsx
// render_type='table' — pre-format rows server-side; render via primitive table.

import { Container, Chart, type ChartSeries } from '@/app/(cockpit)/_design';
import { supabase } from '@/lib/supabase';
import { formatValue, safeText } from './format';
import {
  parseSort, propertyCurrencySymbol, stripPublicPrefix,
  type ContainerRegistryRow, type DataRow,
} from './types';

interface Props { container: ContainerRegistryRow; propertyId: number }

export default async function ContainerTable({ container, propertyId }: Props) {
  const view = stripPublicPrefix(container.bound_views?.[0] ?? '');
  if (!view) return <EmptyShell c={container} reason="no bound view configured" />;

  const filterCol = container.primary_filter ?? 'property_id';
  const sort = parseSort(container.default_sort);

  let q = supabase.from(view).select('*').eq(filterCol, propertyId);
  if (sort) q = q.order(sort.col, { ascending: sort.ascending });

  const { data, error } = await q;
  if (error) return <EmptyShell c={container} reason={`query error: ${error.message}`} />;
  const rows = (data ?? []) as DataRow[];
  if (rows.length === 0) return <EmptyShell c={container} reason="No data for this property" />;

  const symbol = propertyCurrencySymbol(propertyId);
  const cols = container.columns_spec ?? [];
  const xKey = cols[0]?.key ?? 'id';

  // Pre-format every cell (no functions cross server→client; Chart variant=table
  // renders strings as-is).
  const formattedRows = rows.map((r) => {
    const out: Record<string, string | number> = {};
    for (const c of cols) {
      const v = r[c.key];
      out[c.key] = c.format === 'text' ? safeText(v) : formatValue(v, c.format, symbol);
    }
    return out;
  });

  const series: ChartSeries[] = cols.slice(1).map((c) => ({ key: c.key, label: c.label }));

  return (
    <Container title={container.container_name} subtitle={container.subtitle ?? undefined}>
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
