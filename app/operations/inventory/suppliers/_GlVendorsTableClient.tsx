'use client';

// app/operations/inventory/suppliers/_GlVendorsTableClient.tsx
// Client wrapper around <DataTable> for the gl-driven vendors register.
// Routing key is encodeURIComponent(vendor_name).

import Link from 'next/link';
import DataTable, { Column } from '@/components/ui/DataTable';
import StatusPill from '@/components/ui/StatusPill';
import { fmtTableUsd, fmtIsoDate, EMPTY } from '@/lib/format';
import type { GlVendorOverviewRow } from '../_data';

const mono: React.CSSProperties = { fontFamily: 'var(--mono)', fontSize: 'var(--t-xs)' };

export default function GlVendorsTableClient({ rows }: { rows: GlVendorOverviewRow[] }) {
  const cols: Column<GlVendorOverviewRow>[] = [
    {
      key: 'vendor_name', header: 'Vendor',
      render: (r) => (
        <Link
          href={`/operations/inventory/suppliers/${encodeURIComponent(r.vendor_name)}`}
          style={{ color: 'var(--ink)', textDecoration: 'none' }}
        >{r.vendor_name}</Link>
      ),
      sortValue: (r) => r.vendor_name,
    },
    {
      key: 'category', header: 'Category', width: '160px',
      render: (r) => r.category ?? EMPTY, sortValue: (r) => r.category ?? '',
    },
    {
      key: 'currency', header: 'Curr', width: '70px', align: 'center',
      render: (r) => <span style={mono}>{r.currency_guess ?? r.vendor_is_active === null ? EMPTY : (r.currency_guess ?? EMPTY)}</span>,
      sortValue: (r) => r.currency_guess ?? '',
    },
    {
      key: 'gross', header: 'Gross spend', numeric: true, width: '120px',
      render: (r) => fmtTableUsd(r.gross_spend_usd), sortValue: (r) => r.gross_spend_usd,
    },
    {
      key: 'net', header: 'Net', numeric: true, width: '110px',
      render: (r) => fmtTableUsd(r.net_amount_usd), sortValue: (r) => r.net_amount_usd,
    },
    {
      key: 'lines', header: 'Lines', numeric: true, width: '70px',
      render: (r) => <span style={mono}>{r.line_count}</span>, sortValue: (r) => r.line_count,
    },
    {
      key: 'accts', header: 'Accts', numeric: true, width: '70px',
      render: (r) => <span style={mono}>{r.distinct_accounts}</span>, sortValue: (r) => r.distinct_accounts,
    },
    {
      key: 'periods', header: 'Periods', numeric: true, width: '80px',
      render: (r) => <span style={mono}>{r.active_periods}</span>, sortValue: (r) => r.active_periods,
    },
    {
      key: 'first', header: 'First txn', width: '110px',
      render: (r) => <span style={mono}>{fmtIsoDate(r.first_txn_date)}</span>,
      sortValue: (r) => r.first_txn_date ?? '',
    },
    {
      key: 'last', header: 'Last txn', width: '110px',
      render: (r) => <span style={mono}>{fmtIsoDate(r.last_txn_date)}</span>,
      sortValue: (r) => r.last_txn_date ?? '',
    },
    {
      key: 'terms', header: 'Terms', width: '100px',
      render: (r) => r.terms ? <span style={mono}>{r.terms}</span> : EMPTY,
      sortValue: (r) => r.terms ?? '',
    },
    {
      key: 'status', header: 'Active', align: 'center', width: '100px',
      render: (r) => r.is_active_recent
        ? <StatusPill tone="active">Recent</StatusPill>
        : <StatusPill tone="inactive">Dormant</StatusPill>,
      sortValue: (r) => (r.is_active_recent ? 'a' : 'b'),
    },
  ];
  return (
    <DataTable
      columns={cols}
      rows={rows}
      rowKey={(r) => r.vendor_name}
      defaultSort={{ key: 'gross', dir: 'desc' }}
      emptyState="No vendor activity in gl.v_supplier_overview yet."
    />
  );
}
