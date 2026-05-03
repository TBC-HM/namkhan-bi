'use client';

// app/operations/inventory/par/_ParTableClient.tsx
// Client wrapper around <DataTable> for the par-status grid.

import DataTable, { Column } from '@/components/ui/DataTable';
import StatusPill from '@/components/ui/StatusPill';
import { fmtTableUsd, EMPTY } from '@/lib/format';
import type { ParStatusRow } from '../_data';

const mono: React.CSSProperties = { fontFamily: 'var(--mono)', fontSize: 'var(--t-xs)' };

function fmtQty(n: number | null | undefined): string {
  if (n == null) return EMPTY;
  return Number.isInteger(n) ? String(n) : n.toFixed(1);
}

function statusToPill(s: string) {
  switch (s) {
    case 'out_of_stock':
    case 'below_min':
      return <StatusPill tone="expired">{s.replace(/_/g, ' ')}</StatusPill>;
    case 'below_par':
      return <StatusPill tone="pending">below par</StatusPill>;
    case 'at_par':
    case 'ok':
      return <StatusPill tone="active">{s.replace(/_/g, ' ')}</StatusPill>;
    case 'over_max':
    case 'overstocked':
      return <StatusPill tone="info">{s.replace(/_/g, ' ')}</StatusPill>;
    default:
      return <StatusPill tone="inactive">{s.replace(/_/g, ' ')}</StatusPill>;
  }
}

export default function ParTableClient({ rows }: { rows: ParStatusRow[] }) {
  const cols: Column<ParStatusRow>[] = [
    { key: 'sku', header: 'SKU', width: '110px',
      render: (r) => <span style={mono}>{r.sku}</span>, sortValue: (r) => r.sku },
    { key: 'item_name', header: 'Item',
      render: (r) => r.item_name, sortValue: (r) => r.item_name },
    { key: 'loc', header: 'Location', width: '160px',
      render: (r) => r.location_name, sortValue: (r) => r.location_name },
    { key: 'on_hand', header: 'On hand', numeric: true, width: '90px',
      render: (r) => <span style={mono}>{fmtQty(r.on_hand)}</span>, sortValue: (r) => r.on_hand },
    { key: 'par', header: 'Par', numeric: true, width: '70px',
      render: (r) => <span style={mono}>{fmtQty(r.par_quantity)}</span>, sortValue: (r) => r.par_quantity },
    { key: 'min', header: 'Min', numeric: true, width: '70px',
      render: (r) => <span style={mono}>{fmtQty(r.effective_min)}</span>, sortValue: (r) => r.effective_min ?? -1 },
    { key: 'max', header: 'Max', numeric: true, width: '70px',
      render: (r) => <span style={mono}>{fmtQty(r.effective_max)}</span>, sortValue: (r) => r.effective_max ?? -1 },
    { key: 'pct', header: '% of par', numeric: true, width: '90px',
      render: (r) => <span style={mono}>{r.pct_of_par != null ? `${Math.round(r.pct_of_par)}%` : EMPTY}</span>,
      sortValue: (r) => r.pct_of_par ?? -1 },
    { key: 'short', header: 'Short qty', numeric: true, width: '90px',
      render: (r) => <span style={mono}>{fmtQty(r.short_quantity)}</span>, sortValue: (r) => r.short_quantity ?? -1 },
    { key: 'reorder', header: 'Reorder $', numeric: true, width: '110px',
      render: (r) => fmtTableUsd(r.reorder_value_usd), sortValue: (r) => r.reorder_value_usd ?? -1 },
    { key: 'vendor', header: 'Primary vendor', width: '160px',
      render: (r) => r.primary_vendor_name ?? EMPTY, sortValue: (r) => r.primary_vendor_name ?? '' },
    { key: 'status', header: 'Status', align: 'center', width: '130px',
      render: (r) => statusToPill(r.par_status),
      sortValue: (r) => r.par_status },
  ];
  return (
    <DataTable
      columns={cols}
      rows={rows}
      rowKey={(r) => `${r.item_id}::${r.location_id}`}
      defaultSort={{ key: 'pct', dir: 'asc' }}
      emptyState="No par levels configured. Add rows to inv.par_levels to start tracking."
    />
  );
}
