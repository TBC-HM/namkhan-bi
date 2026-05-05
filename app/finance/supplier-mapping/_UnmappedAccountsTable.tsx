'use client';

import DataTable, { type Column } from '@/components/ui/DataTable';
import { fmtTableUsd, fmtIsoDate, EMPTY } from '@/lib/format';

export interface AccountRow {
  account_id: string;
  account_name: string | null;
  qb_type: string | null;
  qb_detail_type: string | null;
  mapping_status: string | null;
  lines: number;
  spend_usd: number;
  last_txn_date: string | null;
}

export default function UnmappedAccountsTable({ rows }: { rows: AccountRow[] }) {
  const columns: Column<AccountRow>[] = [
    { key: 'id',    header: 'Account ID',   align: 'left', width: '10%',
      render: (r) => <span style={{ fontFamily: 'var(--mono)' }}>{r.account_id}</span>,
      sortValue: (r) => r.account_id },
    { key: 'name',  header: 'Account name', align: 'left', width: '32%',
      render: (r) => <strong>{r.account_name || EMPTY}</strong>,
      sortValue: (r) => r.account_name?.toLowerCase() ?? '' },
    { key: 'type',  header: 'QB type',      align: 'left', width: '14%',
      render: (r) => `${r.qb_type ?? EMPTY}${r.qb_detail_type ? ' / ' + r.qb_detail_type : ''}`,
      sortValue: (r) => `${r.qb_type ?? ''}/${r.qb_detail_type ?? ''}` },
    { key: 'status', header: 'Status',      align: 'left', width: '10%',
      render: (r) => r.mapping_status ?? EMPTY,
      sortValue: (r) => r.mapping_status ?? '' },
    { key: 'lines', header: 'Lines',        align: 'right', numeric: true, width: '7%',
      render: (r) => r.lines.toLocaleString('en-US'),
      sortValue: (r) => r.lines },
    { key: 'spend', header: 'Spend (USD)',  align: 'right', numeric: true, width: '10%',
      render: (r) => fmtTableUsd(r.spend_usd),
      sortValue: (r) => r.spend_usd },
    { key: 'last',  header: 'Last txn',     align: 'left', width: '12%',
      render: (r) => fmtIsoDate(r.last_txn_date),
      sortValue: (r) => r.last_txn_date ?? '' },
  ];

  return (
    <DataTable<AccountRow>
      columns={columns}
      rows={rows}
      rowKey={(r) => r.account_id}
      defaultSort={{ key: 'spend', dir: 'desc' }}
      emptyState="All GL accounts have a USALI line. ✅"
    />
  );
}
