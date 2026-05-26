// app/_components/registry/ContainerChart.tsx
// Renders a v_graph_registry row via Chart primitive.

import { Container, Chart, type ChartSeries, type ChartVariant } from '@/app/(cockpit)/_design';
import { supabase } from '@/lib/supabase';
import { stripPublicPrefix, type DataRow, type GraphRegistryRow } from './types';

interface Props { graph: GraphRegistryRow; propertyId: number }

const CHART_PALETTE = ['#1F3A2E', '#B8542A', '#B8A878', '#2E7D32', '#6E8B65', '#C8843E'];

export default async function ContainerChart({ graph, propertyId }: Props) {
  const view = stripPublicPrefix(graph.view_name);
  const filterCol = graph.primary_filter ?? 'property_id';

  const { data, error } = await supabase
    .from(view)
    .select('*')
    .eq(filterCol, propertyId)
    // PBS 2026-05-26: chronological sort for date/month label columns (time-series charts).
    // Non-date columns keep value-DESC top-12 semantic (revenue ranking, etc).
    .order(
      /^(.*_)?(month|date|day|month_label|night_date|ci_month)$/i.test(graph.label_col) ? graph.label_col : graph.value_col,
      { ascending: /^(.*_)?(month|date|day|month_label|night_date|ci_month)$/i.test(graph.label_col), nullsFirst: false }
    )
    .limit(120);

  const rows = (data ?? []) as DataRow[];
  if (error || rows.length === 0) {
    return (
      <Container title={graph.graph_name} subtitle={graph.description ?? `${graph.chart_type} · ${view}`}>
        <Chart variant="bar" data={[]} xKey={graph.label_col}
          series={[{ key: graph.value_col, label: graph.value_col }]}
          height={180}
          empty={{ title: 'No data for this property', hint: error?.message ?? view }}
        />
      </Container>
    );
  }

  const variant: ChartVariant =
    graph.chart_type === 'line' ? 'line' :
    graph.chart_type === 'pie'  ? 'donut' :
    'bar';

  // PBS 2026-05-26: include all extra numeric columns so tooltip surfaces them (sold_nights etc).
  const extraNumericCols = Object.keys(rows[0] ?? {}).filter((k) =>
    k !== graph.label_col && k !== filterCol && k !== 'property_id' && typeof rows[0]?.[k] === 'number'
  );
  const chartData = rows.map((r) => {
    const lbl = String(r[graph.label_col] ?? '—');
    const out: Record<string, string | number> = { [graph.label_col]: lbl };
    for (const k of extraNumericCols) {
      const n = Number(r[k] ?? 0);
      out[k] = Number.isFinite(n) ? Math.round(n) : 0;
    }
    // ensure primary value_col is present even if not numeric in source
    if (!(graph.value_col in out)) out[graph.value_col] = Math.round(Number(r[graph.value_col] ?? 0));
    return out;
  });

  // Primary series first (the synthesized value_col); secondaries auto-add from extras.
  const orderedSeriesKeys = [graph.value_col, ...extraNumericCols.filter((k) => k !== graph.value_col)];
  const series: ChartSeries[] = orderedSeriesKeys.map((k, i) => ({
    key: k,
    label: k,
    color: CHART_PALETTE[i % CHART_PALETTE.length],
  }));

  return (
    <Container title={graph.graph_name} subtitle={graph.description ?? view}>
      <Chart
        variant={variant}
        data={chartData}
        xKey={graph.label_col}
        series={series}
        height={320}
        empty={{ title: 'No data for this property' }}
      />
    </Container>
  );
}
