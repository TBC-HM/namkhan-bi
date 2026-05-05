// app/operations/staff/_components/DeptBreakdown.tsx
// Department-level payroll breakdown for the last paid month.
// USD-primary with LAK in small parens per user request 2026-05-04.

'use client';

import DataTable, { type Column } from '@/components/ui/DataTable';
import { fmtTableUsd, EMPTY } from '@/lib/format';
import UsdLak from './UsdLak';

export type DeptRow = {
  dept_code: string;
  dept_name: string;
  headcount: number;
  total_base_lak: number | null;
  total_overtime_lak: number | null;
  total_sc_lak: number | null;
  total_allow_lak: number | null;
  total_sso_lak: number | null;
  total_tax_lak: number | null;
  total_net_lak: number | null;
  total_grand_usd: number | null;
  // Canonical (from v_payroll_dept_monthly post-migration 2026-05-04)
  total_canonical_net_lak: number | null;
  total_canonical_net_usd: number | null;
  total_canonical_cost_lak: number | null;
  total_canonical_cost_usd: number | null;
  total_benefits_lak: number | null;
};

interface Props {
  rows: DeptRow[];
  /** LAK per USD — used to convert LAK column totals into USD primary display. */
  fx: number;
}

export default function DeptBreakdown({ rows, fx }: Props) {
  const cell = (lak: number | null, tone: 'pos' | 'neg' | 'default' = 'default') => {
    if (lak == null || lak === 0) return <span style={{ color: 'var(--ink-faint)' }}>{EMPTY}</span>;
    return <UsdLak lak={Number(lak)} fx={fx} tone={tone} />;
  };

  const columns: Column<DeptRow>[] = [
    {
      key: 'dept',
      header: 'Department',
      sortValue: (r) => r.dept_name,
      render: (r) => <span style={{ color: 'var(--ink)', fontWeight: 500 }}>{r.dept_name}</span>,
    },
    {
      key: 'hc',
      header: 'HC',
      align: 'right',
      numeric: true,
      sortValue: (r) => r.headcount,
      render: (r) => r.headcount?.toLocaleString() ?? EMPTY,
    },
    {
      key: 'base',
      header: 'Base',
      align: 'right',
      numeric: true,
      sortValue: (r) => Number(r.total_base_lak ?? 0),
      render: (r) => cell(Number(r.total_base_lak)),
    },
    {
      key: 'ot',
      header: 'Overtime',
      align: 'right',
      numeric: true,
      sortValue: (r) => Number(r.total_overtime_lak ?? 0),
      render: (r) => cell(Number(r.total_overtime_lak)),
    },
    {
      key: 'benefits',
      header: 'Benefits',
      align: 'right',
      numeric: true,
      sortValue: (r) => Number(r.total_sc_lak ?? 0) + Number(r.total_allow_lak ?? 0),
      render: (r) => cell(Number(r.total_sc_lak ?? 0) + Number(r.total_allow_lak ?? 0), 'pos'),
    },
    {
      key: 'sso',
      header: 'SSO',
      align: 'right',
      numeric: true,
      sortValue: (r) => Number(r.total_sso_lak ?? 0),
      render: (r) => cell(Number(r.total_sso_lak), 'neg'),
    },
    {
      key: 'tax',
      header: 'Tax',
      align: 'right',
      numeric: true,
      sortValue: (r) => Number(r.total_tax_lak ?? 0),
      render: (r) => cell(Number(r.total_tax_lak), 'neg'),
    },
    {
      key: 'net',
      header: 'Net to employees',
      align: 'right',
      numeric: true,
      sortValue: (r) => Number(r.total_canonical_net_lak ?? r.total_net_lak ?? 0),
      render: (r) => cell(Number(r.total_canonical_net_lak ?? r.total_net_lak)),
    },
    {
      key: 'grand',
      header: 'Company cost (USD)',
      align: 'right',
      numeric: true,
      sortValue: (r) => Number(r.total_canonical_cost_usd ?? r.total_grand_usd ?? 0),
      render: (r) => (
        <span style={{ color: 'var(--ink)', fontWeight: 600 }}>
          {fmtTableUsd(Number(r.total_canonical_cost_usd ?? r.total_grand_usd))}
        </span>
      ),
    },
  ];

  return (
    <DataTable<DeptRow>
      columns={columns}
      rows={rows}
      rowKey={(r) => r.dept_code}
      defaultSort={{ key: 'grand', dir: 'desc' }}
      emptyState="No payroll has been calculated for this period."
    />
  );
}
