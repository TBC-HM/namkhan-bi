'use client';

import { useMemo, useState } from 'react';
import DataTable, { type Column } from '@/components/ui/DataTable';
import { fmtTableUsd, fmtIsoDate, EMPTY } from '@/lib/format';

export interface VendorRow {
  vendor_name: string;
  total_spend_usd: number;
  total_lines: number;
  last_txn_date: string | null;
  distinct_depts: number;
  distinct_accounts: number;
  unmapped_acct_spend: number;
  no_class_spend: number;
  dirty_pct: number;
  primary_dept: string | null;
  primary_dept_spend: number;
  f_unmapped_account: boolean;
  f_no_class: boolean;
  f_multi_dept: boolean;
  suggested_action: string;
}

type Filter = 'all' | 'multi_dept' | 'unmapped_account' | 'no_class' | 'ok';

export default function VendorMappingTable({ rows }: { rows: VendorRow[] }) {
  const [filter, setFilter] = useState<Filter>('all');

  const filtered = useMemo(() => {
    if (filter === 'all') return rows;
    if (filter === 'multi_dept')        return rows.filter(r => r.f_multi_dept);
    if (filter === 'unmapped_account')  return rows.filter(r => r.f_unmapped_account);
    if (filter === 'no_class')          return rows.filter(r => r.f_no_class);
    if (filter === 'ok')                return rows.filter(r => !r.f_unmapped_account && !r.f_no_class && !r.f_multi_dept);
    return rows;
  }, [rows, filter]);

  const columns: Column<VendorRow>[] = [
    {
      key: 'vendor',
      header: 'Vendor',
      align: 'left',
      width: '24%',
      render: (r) => <strong>{r.vendor_name || EMPTY}</strong>,
      sortValue: (r) => r.vendor_name?.toLowerCase() ?? '',
    },
    {
      key: 'primary_dept',
      header: 'Primary dept',
      align: 'left',
      width: '12%',
      render: (r) => r.primary_dept || EMPTY,
      sortValue: (r) => r.primary_dept ?? '',
    },
    {
      key: 'distinct',
      header: 'Depts / accts',
      align: 'right',
      numeric: true,
      width: '10%',
      render: (r) => `${r.distinct_depts} / ${r.distinct_accounts}`,
      sortValue: (r) => r.distinct_depts * 100 + r.distinct_accounts,
    },
    {
      key: 'flags',
      header: 'Flags',
      align: 'left',
      width: '14%',
      render: (r) => (
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
          {r.f_no_class         && <Pill tone="bad">no class</Pill>}
          {r.f_unmapped_account && <Pill tone="bad">unmapped</Pill>}
          {r.f_multi_dept       && <Pill tone="warn">multi-dept</Pill>}
          {!r.f_no_class && !r.f_unmapped_account && !r.f_multi_dept && <Pill tone="ok">ok</Pill>}
        </div>
      ),
      sortValue: (r) =>
        (r.f_no_class ? 100 : 0) + (r.f_unmapped_account ? 10 : 0) + (r.f_multi_dept ? 1 : 0),
    },
    {
      key: 'spend',
      header: 'Spend (180d)',
      align: 'right',
      numeric: true,
      width: '10%',
      render: (r) => fmtTableUsd(r.total_spend_usd),
      sortValue: (r) => r.total_spend_usd,
    },
    {
      key: 'no_class_spend',
      header: 'No-class $',
      align: 'right',
      numeric: true,
      width: '9%',
      render: (r) => (
        <span style={{ color: r.no_class_spend > 0 ? 'var(--bad, #b53a2a)' : 'var(--ink-soft)' }}>
          {r.no_class_spend > 0 ? fmtTableUsd(r.no_class_spend) : EMPTY}
        </span>
      ),
      sortValue: (r) => r.no_class_spend,
    },
    {
      key: 'unmapped_spend',
      header: 'Unmapped $',
      align: 'right',
      numeric: true,
      width: '9%',
      render: (r) => (
        <span style={{ color: r.unmapped_acct_spend > 0 ? 'var(--bad, #b53a2a)' : 'var(--ink-soft)' }}>
          {r.unmapped_acct_spend > 0 ? fmtTableUsd(r.unmapped_acct_spend) : EMPTY}
        </span>
      ),
      sortValue: (r) => r.unmapped_acct_spend,
    },
    {
      key: 'last',
      header: 'Last bill',
      align: 'left',
      width: '8%',
      render: (r) => fmtIsoDate(r.last_txn_date),
      sortValue: (r) => r.last_txn_date ?? '',
    },
    {
      key: 'action',
      header: 'Suggested',
      align: 'left',
      width: '14%',
      render: (r) => (
        <span style={{
          fontFamily: 'var(--mono)',
          fontSize: 'var(--t-xs)',
          letterSpacing: 'var(--ls-extra)',
          textTransform: 'uppercase',
          color: 'var(--brass)',
        }}>{r.suggested_action}</span>
      ),
      sortValue: (r) => r.suggested_action,
    },
  ];

  return (
    <>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14, alignItems: 'center' }}>
        <span style={{ fontFamily: 'var(--mono)', fontSize: 'var(--t-xs)', letterSpacing: 'var(--ls-extra)', textTransform: 'uppercase', color: 'var(--brass)' }}>Filter:</span>
        {([
          ['all',              'All'],
          ['multi_dept',       'Multi-dept'],
          ['unmapped_account', 'Unmapped account'],
          ['no_class',         'No QB class'],
          ['ok',               'Clean'],
        ] as Array<[Filter, string]>).map(([k, label]) => (
          <button key={k} onClick={() => setFilter(k)} style={{
            padding: '4px 10px',
            border: '1px solid var(--rule, #e3dfd3)',
            background: filter === k ? 'var(--ink, #2c2a25)' : 'transparent',
            color: filter === k ? 'var(--paper, #fbf9f3)' : 'var(--ink, #2c2a25)',
            fontFamily: 'var(--mono)',
            fontSize: 'var(--t-xs)',
            letterSpacing: 'var(--ls-extra)',
            textTransform: 'uppercase',
            cursor: 'pointer',
          }}>{label}</button>
        ))}
      </div>

      <DataTable<VendorRow>
        columns={columns}
        rows={filtered}
        rowKey={(r, i) => `${r.vendor_name}|${i}`}
        defaultSort={{ key: 'spend', dir: 'desc' }}
        emptyState="No vendors match this filter."
      />
    </>
  );
}

function Pill({ children, tone }: { children: React.ReactNode; tone: 'bad' | 'warn' | 'ok' }) {
  const bg =
    tone === 'bad'  ? 'rgba(181, 58, 42, 0.12)' :
    tone === 'warn' ? 'rgba(180, 130, 40, 0.14)' :
                      'rgba(44, 122, 75, 0.12)';
  const fg =
    tone === 'bad'  ? 'var(--bad, #b53a2a)'  :
    tone === 'warn' ? 'var(--brass, #b48228)' :
                      'var(--good, #2c7a4b)';
  return (
    <span style={{
      padding: '1px 6px',
      background: bg,
      color: fg,
      fontFamily: 'var(--mono)',
      fontSize: 'var(--t-xs)',
      letterSpacing: 'var(--ls-extra)',
      textTransform: 'uppercase',
    }}>{children}</span>
  );
}
