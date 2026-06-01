// app/_components/registry/ContainerMonthTable.tsx
// render_type='month_table' — month <select> filters fetch.
// Client component: needs interactive state.

'use client';

import { useEffect, useMemo, useState } from 'react';
import { Container, Chart, type ChartSeries } from '@/app/(cockpit)/_design';
import { createClient } from '@/lib/supabase/client';
import { formatValue, safeText } from './format';
import ExpandableTableRows from './ExpandableTableRows';
import {
  parseSort, propertyCurrencySymbol, stripPublicPrefix,
  type ContainerRegistryRow, type DataRow,
} from './types';

interface Props { container: ContainerRegistryRow; propertyId: number }

function firstOfMonth(iso: string): string {
  return iso.slice(0, 7) + '-01';
}
function firstOfNextMonth(iso: string): string {
  const d = new Date(iso.slice(0, 7) + '-01T00:00:00Z');
  d.setUTCMonth(d.getUTCMonth() + 1);
  return d.toISOString().slice(0, 10);
}
function monthLabel(iso: string): string {
  const d = new Date(iso.slice(0, 7) + '-01T00:00:00Z');
  return d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}

export default function ContainerMonthTable({ container, propertyId }: Props) {
  const view = stripPublicPrefix(container.bound_views?.[0] ?? '');
  const monthField = container.month_field ?? 'month';
  const filterCol = container.primary_filter ?? 'property_id';
  const sort = useMemo(() => parseSort(container.default_sort), [container.default_sort]);
  const symbol = propertyCurrencySymbol(propertyId);
  const cols = container.columns_spec ?? [];
  const xKey = cols[0]?.key ?? 'id';
  const series: ChartSeries[] = cols.slice(1).map((c) => ({ key: c.key, label: c.label }));

  const [months, setMonths] = useState<string[]>([]);
  const [selectedMonth, setSelectedMonth] = useState<string | null>(null);
  const [rows, setRows] = useState<DataRow[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Step 1: fetch distinct months for this property + view
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!view) { setLoading(false); return; }
      const sb = createClient();
      const { data, error } = await sb
        .from(view)
        .select(monthField)
        .eq(filterCol, propertyId)
        .order(monthField, { ascending: false })
        .limit(5000);
      if (cancelled) return;
      if (error) { setError(error.message); setLoading(false); return; }
      const set = new Set<string>();
      for (const r of (data ?? []) as unknown as DataRow[]) {
        const v = r[monthField];
        if (typeof v === 'string' && v.length >= 7) set.add(firstOfMonth(v));
      }
      // PBS 2026-05-26: include current + next 18 calendar months so future-dated
      // reservations are pickable even when the underlying view is past-only.
      const today = new Date();
      for (let i = 0; i <= 18; i++) {
        const d = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() + i, 1));
        set.add(d.toISOString().slice(0, 10));
      }
      const list = Array.from(set).sort().reverse();
      setMonths(list);
      setSelectedMonth(list[0] ?? null);
      if (list.length === 0) { setRows([]); setLoading(false); }
    })();
    return () => { cancelled = true; };
  }, [view, monthField, filterCol, propertyId]);

  // Step 2: when a month is picked, refetch the rows
  useEffect(() => {
    if (!view || !selectedMonth) return;
    let cancelled = false;
    setLoading(true);
    (async () => {
      const sb = createClient();
      const from = firstOfMonth(selectedMonth);
      const to = firstOfNextMonth(selectedMonth);
      let q = sb.from(view).select('*')
        .eq(filterCol, propertyId)
        .gte(monthField, from)
        .lt(monthField, to);
      if (sort) q = q.order(sort.col, { ascending: sort.ascending });
      const { data, error } = await q;
      if (cancelled) return;
      if (error) { setError(error.message); setRows([]); setLoading(false); return; }
      setRows((data ?? []) as DataRow[]);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [view, monthField, filterCol, propertyId, selectedMonth, sort]);

  const formattedRows = useMemo(() => {
    if (!rows) return [];
    return rows.map((r) => {
      const out: Record<string, string | number> = {};
      for (const c of cols) {
        const v = r[c.key];
        out[c.key] = c.format === 'text' ? safeText(v) : formatValue(v, c.format, symbol);
      }
      return out;
    });
  }, [rows, cols, symbol]);

  const monthSelector = (
    <select
      value={selectedMonth ?? ''}
      onChange={(e) => setSelectedMonth(e.target.value)}
      disabled={months.length === 0}
      style={{
        padding: '4px 8px',
        border: '1px solid var(--hairline, #E6DFCC)',
        borderRadius: 4,
        background: 'var(--paper, #FFFFFF)',
        color: 'var(--ink, #1B1B1B)',
        fontSize: 12,
        fontFamily: 'inherit',
      }}
    >
      {months.length === 0 && <option value="">no months</option>}
      {months.map((m) => <option key={m} value={m}>{monthLabel(m)}</option>)}
    </select>
  );

  return (
    <Container
      title={container.container_name}
      subtitle={container.subtitle ?? undefined}
      action={monthSelector}
    >
      {loading && !rows ? (
        <div style={{ padding: 18, fontSize: 12, color: 'var(--ink-soft, #5A5A5A)' }}>Loading…</div>
      ) : error ? (
        <div style={{ padding: 18, fontSize: 12, color: 'var(--terracotta, #B8542A)' }}>Error: {error}</div>
      ) : formattedRows.length === 0 ? (
        <div style={{ padding: 18, fontSize: 12, color: 'var(--ink-soft, #5A5A5A)', fontStyle: 'italic' }}>
          No rows for {selectedMonth ? monthLabel(selectedMonth) : 'this property'}.
        </div>
      ) : (
        (container.max_rows ?? 0) > 0 ? (
          <ExpandableTableRows
            rows={formattedRows}
            cols={cols.map((c) => ({ key: c.key, label: c.label, align: c.align as 'left'|'right'|'center'|undefined }))}
            maxRows={container.max_rows ?? 5}
          />
        ) : (
          <Chart
            variant="table"
            data={formattedRows}
            xKey={xKey}
            series={series}
            empty={{ title: 'No rows' }}
          />
        )
      )}
    </Container>
  );
}
