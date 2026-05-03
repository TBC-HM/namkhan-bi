'use client';

// app/operations/inventory/suppliers/[id]/_GlDetailTablesClient.tsx
// Client wrappers for the three gl-driven supplier-detail tables:
//   - Account splits (v_supplier_vendor_account)
//   - Anomalies (v_supplier_account_anomalies)
//   - Recent transactions (v_supplier_transactions)

import DataTable, { Column } from '@/components/ui/DataTable';
import StatusPill from '@/components/ui/StatusPill';
import { fmtTableUsd, fmtIsoDate, EMPTY } from '@/lib/format';
import type {
  GlVendorAccountSplit,
  GlVendorAnomaly,
  GlVendorTransaction,
} from '../../_data';

const mono: React.CSSProperties = { fontFamily: 'var(--mono)', fontSize: 'var(--t-xs)' };

// ---------- Account splits (per period × account) ----------

export function AccountSplitsTable({ rows }: { rows: GlVendorAccountSplit[] }) {
  const cols: Column<GlVendorAccountSplit>[] = [
    { key: 'period', header: 'Period', width: '90px',
      render: (r) => <span style={mono}>{r.period_yyyymm ?? EMPTY}</span>,
      sortValue: (r) => r.period_yyyymm ?? '' },
    { key: 'account', header: 'Account',
      render: (r) => <span>{r.account_name ?? EMPTY}{r.account_id && <span style={{ ...mono, color: 'var(--ink-mute)', marginLeft: 6 }}>{r.account_id}</span>}</span>,
      sortValue: (r) => r.account_name ?? '' },
    { key: 'usali_dept', header: 'USALI dept', width: '140px',
      render: (r) => r.usali_department ? <span style={mono}>{r.usali_department}</span> : EMPTY,
      sortValue: (r) => r.usali_department ?? '' },
    { key: 'usali_sub', header: 'Subcategory', width: '160px',
      render: (r) => r.usali_subcategory ? <span style={mono}>{r.usali_subcategory}</span> : EMPTY,
      sortValue: (r) => r.usali_subcategory ?? '' },
    { key: 'lines', header: 'Lines', numeric: true, width: '70px',
      render: (r) => <span style={mono}>{r.line_count}</span>,
      sortValue: (r) => r.line_count },
    { key: 'gross', header: 'Gross $', numeric: true, width: '120px',
      render: (r) => fmtTableUsd(r.gross_amount_usd),
      sortValue: (r) => r.gross_amount_usd },
    { key: 'net', header: 'Net $', numeric: true, width: '110px',
      render: (r) => fmtTableUsd(r.net_amount_usd),
      sortValue: (r) => r.net_amount_usd },
    { key: 'first', header: 'First', width: '100px',
      render: (r) => <span style={mono}>{fmtIsoDate(r.first_txn)}</span>,
      sortValue: (r) => r.first_txn ?? '' },
    { key: 'last', header: 'Last', width: '100px',
      render: (r) => <span style={mono}>{fmtIsoDate(r.last_txn)}</span>,
      sortValue: (r) => r.last_txn ?? '' },
  ];
  return (
    <DataTable
      columns={cols}
      rows={rows}
      rowKey={(r, i) => `${r.period_yyyymm ?? 'na'}::${r.account_id ?? 'na'}::${i}`}
      defaultSort={{ key: 'gross', dir: 'desc' }}
      emptyState="No account splits yet — vendor has no GL lines."
    />
  );
}

// ---------- Anomalies ----------

function severityPill(share: number) {
  // share is 0–1
  const pct = share * 100;
  if (pct >= 50) return <StatusPill tone="expired">{`${pct.toFixed(0)}%`}</StatusPill>;
  if (pct >= 25) return <StatusPill tone="pending">{`${pct.toFixed(0)}%`}</StatusPill>;
  return <StatusPill tone="info">{`${pct.toFixed(0)}%`}</StatusPill>;
}

export function AnomaliesTable({ rows }: { rows: GlVendorAnomaly[] }) {
  const cols: Column<GlVendorAnomaly>[] = [
    { key: 'account', header: 'Account',
      render: (r) => (
        <span>
          {r.account_name ?? EMPTY}
          {r.account_id && <span style={{ ...mono, color: 'var(--ink-mute)', marginLeft: 6 }}>{r.account_id}</span>}
        </span>
      ),
      sortValue: (r) => r.account_name ?? '' },
    { key: 'amt', header: 'Gross $', numeric: true, width: '120px',
      render: (r) => fmtTableUsd(r.gross_amount),
      sortValue: (r) => r.gross_amount },
    { key: 'share', header: '% of vendor spend', align: 'center', width: '160px',
      render: (r) => severityPill(r.share_of_vendor_spend),
      sortValue: (r) => r.share_of_vendor_spend },
  ];
  return (
    <DataTable
      columns={cols}
      rows={rows}
      rowKey={(r, i) => `${r.account_id ?? 'na'}::${i}`}
      defaultSort={{ key: 'share', dir: 'desc' }}
      emptyState="No account anomalies — every account split looks normal for this vendor."
    />
  );
}

// ---------- Recent transactions ----------

export function TransactionsTable({ rows }: { rows: GlVendorTransaction[] }) {
  const cols: Column<GlVendorTransaction>[] = [
    { key: 'date', header: 'Date', width: '110px',
      render: (r) => <span style={mono}>{fmtIsoDate(r.txn_date)}</span>,
      sortValue: (r) => r.txn_date ?? '' },
    { key: 'type', header: 'Type', width: '110px',
      render: (r) => r.qb_txn_type ? <span style={mono}>{r.qb_txn_type}</span> : EMPTY,
      sortValue: (r) => r.qb_txn_type ?? '' },
    { key: 'num', header: 'QB #', width: '110px',
      render: (r) => r.qb_txn_number ? <span style={mono}>{r.qb_txn_number}</span> : EMPTY,
      sortValue: (r) => r.qb_txn_number ?? '' },
    { key: 'account', header: 'Account',
      render: (r) => (
        <span>
          {r.account_name ?? EMPTY}
          {r.account_id && <span style={{ ...mono, color: 'var(--ink-mute)', marginLeft: 6 }}>{r.account_id}</span>}
        </span>
      ),
      sortValue: (r) => r.account_name ?? '' },
    { key: 'usali', header: 'USALI', width: '160px',
      render: (r) => r.usali_subcategory ? <span style={mono}>{r.usali_subcategory}</span> : EMPTY,
      sortValue: (r) => r.usali_subcategory ?? '' },
    { key: 'memo', header: 'Memo',
      render: (r) => r.memo ?? EMPTY },
    { key: 'native', header: 'Native', numeric: true, width: '120px',
      render: (r) => r.txn_amount_native != null
        ? <span style={mono}>{`${(r.txn_currency ?? '').padEnd(0)} ${r.txn_amount_native.toLocaleString('en-US')}`}</span>
        : EMPTY,
      sortValue: (r) => r.txn_amount_native ?? -1 },
    { key: 'usd', header: 'USD', numeric: true, width: '120px',
      render: (r) => fmtTableUsd(r.amount_usd),
      sortValue: (r) => r.amount_usd },
  ];
  return (
    <DataTable
      columns={cols}
      rows={rows}
      rowKey={(r) => r.entry_id}
      defaultSort={{ key: 'date', dir: 'desc' }}
      emptyState="No transactions on file for this vendor."
    />
  );
}
