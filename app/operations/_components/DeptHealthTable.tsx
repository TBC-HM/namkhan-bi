'use client';

// Client wrapper for the canonical DataTable used on /operations.
// Column render functions can't cross the server→client boundary, so all
// column definitions live in this client component.

import DataTable, { type Column } from '@/components/ui/DataTable';
import { fmtTableUsd, EMPTY } from '@/lib/format';

export interface DeptPayrollRow {
  period_month: string;
  dept_code: string | null;
  dept_name: string | null;
  headcount: number | null;
  total_days_worked: number | null;
  total_grand_usd: number | null;
}

interface Props {
  rows: DeptPayrollRow[];
}

export default function DeptHealthTable({ rows }: Props) {
  const totalUsd = rows.reduce((s, r) => s + Number(r.total_grand_usd || 0), 0);

  const cols: Column<DeptPayrollRow>[] = [
    {
      key: 'dept', header: 'Department',
      render: (r) => <strong>{r.dept_name || r.dept_code || EMPTY}</strong>,
      sortValue: (r) => (r.dept_name || r.dept_code || '') as string,
    },
    {
      key: 'headcount', header: 'Headcount', align: 'right', numeric: true,
      render: (r) => r.headcount ?? EMPTY,
      sortValue: (r) => Number(r.headcount || 0),
    },
    {
      key: 'days', header: 'Days worked', align: 'right', numeric: true,
      render: (r) => r.total_days_worked ?? EMPTY,
      sortValue: (r) => Number(r.total_days_worked || 0),
    },
    {
      key: 'usd', header: 'Payroll', align: 'right', numeric: true,
      render: (r) => fmtTableUsd(r.total_grand_usd),
      sortValue: (r) => Number(r.total_grand_usd || 0),
    },
    {
      key: 'usd_per_head', header: '$ / staff', align: 'right', numeric: true,
      render: (r) => {
        const v = (r.headcount && Number(r.headcount) > 0)
          ? Number(r.total_grand_usd || 0) / Number(r.headcount)
          : null;
        return fmtTableUsd(v);
      },
      sortValue: (r) => {
        if (!r.headcount || Number(r.headcount) === 0) return 0;
        return Number(r.total_grand_usd || 0) / Number(r.headcount);
      },
    },
    {
      key: 'share', header: 'Share', align: 'right', numeric: true,
      render: (r) => {
        if (totalUsd <= 0) return EMPTY;
        return `${(Number(r.total_grand_usd || 0) / totalUsd * 100).toFixed(1)}%`;
      },
      sortValue: (r) => Number(r.total_grand_usd || 0),
    },
  ];

  return (
    <DataTable<DeptPayrollRow>
      rows={rows}
      columns={cols}
      rowKey={(r) => r.dept_code || r.dept_name || ''}
      defaultSort={{ key: 'usd', dir: 'desc' }}
    />
  );
}
