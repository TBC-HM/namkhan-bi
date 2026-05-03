'use client';

// app/operations/inventory/stock/_StockTablesClient.tsx
//
// Client wrapper around <DataTable> for the three stock-page tables.
// DataTable column render/sortValue fns can't cross the server→client boundary,
// so they live here.

import DataTable, { Column } from '@/components/ui/DataTable';
import StatusPill from '@/components/ui/StatusPill';
import { fmtTableUsd, fmtIsoDate, EMPTY } from '@/lib/format';
import type { StockOnHandRow, DaysOfCoverRow, SlowMoverRow, ExpiringRow } from '../_data';

const mono: React.CSSProperties = { fontFamily: 'var(--mono)', fontSize: 'var(--t-xs)' };

function fmtQty(n: number | null | undefined): string {
  if (n == null) return EMPTY;
  // Show 0–2 dp. Whole-number qty → no decimals. Fractional → 1dp.
  return Number.isInteger(n) ? String(n) : n.toFixed(1);
}

function fmtDays(n: number | null | undefined): string {
  if (n == null) return EMPTY;
  if (n >= 999) return '∞';
  return `${Math.round(n)}d`;
}

// ---------- Stock on hand ----------

export function StockOnHandTable({ rows }: { rows: StockOnHandRow[] }) {
  const cols: Column<StockOnHandRow>[] = [
    { key: 'sku', header: 'SKU', width: '110px',
      render: (r) => <span style={mono}>{r.sku}</span>, sortValue: (r) => r.sku },
    { key: 'item_name', header: 'Item',
      render: (r) => r.item_name, sortValue: (r) => r.item_name },
    { key: 'cat', header: 'Category', width: '160px',
      render: (r) => r.category_name ?? EMPTY, sortValue: (r) => r.category_name ?? '' },
    { key: 'on_hand', header: 'On hand', numeric: true, width: '90px',
      render: (r) => <span style={mono}>{fmtQty(r.total_on_hand)}</span>, sortValue: (r) => r.total_on_hand },
    { key: 'locs', header: 'Locs', numeric: true, width: '60px',
      render: (r) => <span style={mono}>{r.locations_with_stock}</span>, sortValue: (r) => r.locations_with_stock },
    { key: 'value', header: 'Value', numeric: true, width: '110px',
      render: (r) => fmtTableUsd(r.value_usd_estimate), sortValue: (r) => r.value_usd_estimate ?? -1 },
    { key: 'last_mv', header: 'Last move', width: '110px',
      render: (r) => <span style={mono}>{fmtIsoDate(r.last_movement_at)}</span>, sortValue: (r) => r.last_movement_at ?? '' },
    { key: 'last_count', header: 'Last count', width: '110px',
      render: (r) => <span style={mono}>{fmtIsoDate(r.last_count_at)}</span>, sortValue: (r) => r.last_count_at ?? '' },
  ];
  return (
    <DataTable
      columns={cols}
      rows={rows}
      rowKey={(r) => r.item_id}
      defaultSort={{ key: 'value', dir: 'desc' }}
      emptyState="No SKUs with stock yet."
    />
  );
}

// ---------- Days of cover ----------

function dayPill(days: number | null | undefined) {
  if (days == null) return <StatusPill tone="info">No burn</StatusPill>;
  if (days <= 0) return <StatusPill tone="expired">Out</StatusPill>;
  if (days <= 7) return <StatusPill tone="expired">{`${Math.round(days)}d`}</StatusPill>;
  if (days <= 14) return <StatusPill tone="pending">{`${Math.round(days)}d`}</StatusPill>;
  if (days >= 999) return <StatusPill tone="info">Slow</StatusPill>;
  return <StatusPill tone="active">{`${Math.round(days)}d`}</StatusPill>;
}

export function DaysOfCoverTable({ rows }: { rows: DaysOfCoverRow[] }) {
  const cols: Column<DaysOfCoverRow>[] = [
    { key: 'sku', header: 'SKU', width: '110px',
      render: (r) => <span style={mono}>{r.sku}</span>, sortValue: (r) => r.sku },
    { key: 'item_name', header: 'Item',
      render: (r) => r.item_name, sortValue: (r) => r.item_name },
    { key: 'on_hand', header: 'On hand', numeric: true, width: '90px',
      render: (r) => <span style={mono}>{fmtQty(r.on_hand)}</span>, sortValue: (r) => r.on_hand },
    { key: 'burn', header: 'Burn /day', numeric: true, width: '110px',
      render: (r) => <span style={mono}>{fmtQty(r.burn_per_day)}</span>, sortValue: (r) => r.burn_per_day ?? -1 },
    { key: 'doc', header: 'Days cover', align: 'center', width: '110px',
      render: (r) => dayPill(r.days_of_cover),
      sortValue: (r) => r.days_of_cover ?? 999999 },
    { key: 'par', header: 'Par', numeric: true, width: '70px',
      render: (r) => <span style={mono}>{fmtQty(r.par_quantity)}</span>, sortValue: (r) => r.par_quantity ?? -1 },
    { key: 'd_par', header: 'Days→par', numeric: true, width: '90px',
      render: (r) => <span style={mono}>{fmtDays(r.days_until_par)}</span>, sortValue: (r) => r.days_until_par ?? 999999 },
    { key: 'reorder', header: 'Reorder pt', numeric: true, width: '90px',
      render: (r) => <span style={mono}>{fmtQty(r.reorder_point)}</span>, sortValue: (r) => r.reorder_point ?? -1 },
    { key: 'd_re', header: 'Days→reorder', numeric: true, width: '110px',
      render: (r) => <span style={mono}>{fmtDays(r.days_until_reorder)}</span>, sortValue: (r) => r.days_until_reorder ?? 999999 },
  ];
  return (
    <DataTable
      columns={cols}
      rows={rows}
      rowKey={(r) => r.item_id}
      defaultSort={{ key: 'doc', dir: 'asc' }}
      emptyState="No movements yet — burn rate not computable."
    />
  );
}

// ---------- Slow movers ----------

export function SlowMoversTable({ rows }: { rows: SlowMoverRow[] }) {
  const cols: Column<SlowMoverRow>[] = [
    { key: 'sku', header: 'SKU', width: '110px',
      render: (r) => <span style={mono}>{r.sku}</span>, sortValue: (r) => r.sku },
    { key: 'item_name', header: 'Item',
      render: (r) => r.item_name, sortValue: (r) => r.item_name },
    { key: 'cat', header: 'Category', width: '160px',
      render: (r) => r.category_name ?? EMPTY, sortValue: (r) => r.category_name ?? '' },
    { key: 'u90', header: '90d units', numeric: true, width: '90px',
      render: (r) => <span style={mono}>{fmtQty(r.units_90d)}</span>, sortValue: (r) => r.units_90d },
    { key: 'uw', header: '/wk', numeric: true, width: '70px',
      render: (r) => <span style={mono}>{fmtQty(r.units_per_week)}</span>, sortValue: (r) => r.units_per_week ?? -1 },
    { key: 'oh', header: 'On hand', numeric: true, width: '90px',
      render: (r) => <span style={mono}>{fmtQty(r.total_on_hand)}</span>, sortValue: (r) => r.total_on_hand },
    { key: 'cost', header: 'Unit cost', numeric: true, width: '100px',
      render: (r) => fmtTableUsd(r.last_unit_cost_usd), sortValue: (r) => r.last_unit_cost_usd ?? -1 },
    { key: 'val', header: 'Tied-up $', numeric: true, width: '110px',
      render: (r) => fmtTableUsd(r.value_usd_estimate), sortValue: (r) => r.value_usd_estimate ?? -1 },
  ];
  return (
    <DataTable
      columns={cols}
      rows={rows}
      rowKey={(r) => r.item_id}
      defaultSort={{ key: 'val', dir: 'desc' }}
      emptyState="No slow movers — every SKU has moved in the last 90 days."
    />
  );
}

// ---------- Expiring soon ----------

function expiryPill(days: number | null | undefined) {
  if (days == null) return <StatusPill tone="info">No date</StatusPill>;
  if (days <= 0) return <StatusPill tone="expired">Expired</StatusPill>;
  if (days <= 7) return <StatusPill tone="expired">{`${days}d`}</StatusPill>;
  if (days <= 14) return <StatusPill tone="pending">{`${days}d`}</StatusPill>;
  return <StatusPill tone="active">{`${days}d`}</StatusPill>;
}

export function ExpiringTable({ rows }: { rows: ExpiringRow[] }) {
  const cols: Column<ExpiringRow>[] = [
    { key: 'sku', header: 'SKU', width: '110px',
      render: (r) => <span style={mono}>{r.sku}</span>, sortValue: (r) => r.sku },
    { key: 'item_name', header: 'Item',
      render: (r) => r.item_name, sortValue: (r) => r.item_name },
    { key: 'loc', header: 'Location', width: '160px',
      render: (r) => r.location_name ?? EMPTY, sortValue: (r) => r.location_name ?? '' },
    { key: 'batch', header: 'Batch', width: '120px',
      render: (r) => <span style={mono}>{r.batch_code ?? EMPTY}</span>, sortValue: (r) => r.batch_code ?? '' },
    { key: 'exp', header: 'Expiry', width: '110px',
      render: (r) => <span style={mono}>{fmtIsoDate(r.expiry_date)}</span>, sortValue: (r) => r.expiry_date ?? '' },
    { key: 'days', header: 'Days', align: 'center', width: '90px',
      render: (r) => expiryPill(r.days_until_expiry), sortValue: (r) => r.days_until_expiry ?? 9999 },
    { key: 'oh', header: 'On hand', numeric: true, width: '90px',
      render: (r) => <span style={mono}>{fmtQty(r.current_on_hand)}</span>, sortValue: (r) => r.current_on_hand },
    { key: 'risk', header: 'At-risk $', numeric: true, width: '110px',
      render: (r) => fmtTableUsd(r.at_risk_value_usd), sortValue: (r) => r.at_risk_value_usd ?? -1 },
  ];
  return (
    <DataTable
      columns={cols}
      rows={rows}
      rowKey={(r) => `${r.item_id}::${r.batch_code ?? ''}::${r.expiry_date ?? ''}`}
      defaultSort={{ key: 'days', dir: 'asc' }}
      emptyState="Nothing expiring in the next 30 days."
    />
  );
}
