'use client';

import DataTable, { type Column } from '@/components/ui/DataTable';
import { fmtIsoDate, EMPTY } from '@/lib/format';

export interface StaffRow {
  staff_id: string;
  full_name: string | null;
  position_title: string | null;
  dept_code: string | null;
  dept_name: string | null;
  employment_type: string | null;
  monthly_salary: number | null;
  salary_currency: string | null;
  hire_date: string | null;
  is_active: boolean | null;
  contract_hours_pw: number | null;
  skills: string[] | null;
}

const fmtSalary = (n: number | null, cur: string | null) =>
  n == null ? EMPTY : `${cur ?? 'LAK'} ${n.toLocaleString('en-US', { maximumFractionDigits: 0 })}`;

export default function RosterTable({ rows }: { rows: StaffRow[] }) {
  const columns: Column<StaffRow>[] = [
    { key: 'name',  header: 'NAME',     sortValue: (r) => (r.full_name ?? '').toLowerCase(), render: (r) => <span style={{ fontWeight: 500 }}>{r.full_name ?? EMPTY}</span> },
    { key: 'pos',   header: 'POSITION', sortValue: (r) => r.position_title ?? '', render: (r) => r.position_title ?? EMPTY },
    { key: 'dept',  header: 'DEPARTMENT', sortValue: (r) => r.dept_name ?? r.dept_code ?? '', render: (r) => <span style={{ color: 'var(--ink-mute)' }}>{r.dept_name ?? r.dept_code ?? EMPTY}</span> },
    { key: 'type',  header: 'TYPE',     sortValue: (r) => r.employment_type ?? '', render: (r) => r.employment_type ?? EMPTY },
    { key: 'hired', header: 'HIRED',    sortValue: (r) => r.hire_date ?? '', render: (r) => fmtIsoDate(r.hire_date) },
    { key: 'hpw',   header: 'HRS/WK',   numeric: true, sortValue: (r) => r.contract_hours_pw ?? 0, render: (r) => r.contract_hours_pw != null ? r.contract_hours_pw.toString() : EMPTY },
    { key: 'salary', header: 'SALARY',  numeric: true, sortValue: (r) => r.monthly_salary ?? 0, render: (r) => fmtSalary(r.monthly_salary, r.salary_currency) },
    {
      key: 'skills', header: 'SKILLS',
      render: (r) => <span style={{ color: 'var(--ink-mute)' }}>{r.skills && r.skills.length > 0 ? r.skills.slice(0, 3).join(', ') + (r.skills.length > 3 ? '…' : '') : EMPTY}</span>,
    },
  ];
  return (
    <DataTable<StaffRow>
      columns={columns}
      rows={rows}
      rowKey={(r) => r.staff_id}
      defaultSort={{ key: 'name', dir: 'asc' }}
      emptyState="No active staff."
    />
  );
}
