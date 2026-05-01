// app/operations/staff/_components/StaffTable.tsx
'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { fmtMoney } from '@/lib/format';

type Row = {
  staff_id: string;
  emp_id: string;
  full_name: string;
  position_title: string;
  dept_code: string;
  dept_name: string;
  employment_type: string;
  monthly_salary: number;
  hourly_cost_lak: number;
  hire_date: string | null;
  last_payroll_period: string | null;
  payslip_pdf_status: 'current' | 'overdue' | 'never';
  flag_missing_hire_date: boolean;
  flag_missing_contract: boolean;
  flag_contract_expiring: boolean;
};

export function StaffTable({ rows }: { rows: Row[] }) {
  const router = useRouter();
  const [q, setQ] = useState('');
  const [dept, setDept] = useState<string>('all');

  const depts = useMemo(
    () => Array.from(new Set(rows.map((r) => r.dept_name))).sort(),
    [rows]
  );

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return rows.filter((r) => {
      if (dept !== 'all' && r.dept_name !== dept) return false;
      if (!needle) return true;
      return (
        r.full_name.toLowerCase().includes(needle) ||
        r.emp_id.toLowerCase().includes(needle) ||
        r.position_title.toLowerCase().includes(needle)
      );
    });
  }, [rows, q, dept]);

  return (
    <div className="rounded-sm border border-stone-300 bg-white">
      {/* Filter row */}
      <div className="flex flex-wrap items-center gap-3 border-b border-stone-200 px-4 py-3">
        <input
          type="text"
          placeholder="Search name, code, position…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="w-64 rounded-sm border border-stone-300 px-3 py-1.5 text-sm focus:border-stone-700 focus:outline-none"
        />
        <select
          value={dept}
          onChange={(e) => setDept(e.target.value)}
          className="rounded-sm border border-stone-300 bg-white px-3 py-1.5 text-sm"
        >
          <option value="all">All departments</option>
          {depts.map((d) => (
            <option key={d} value={d}>
              {d}
            </option>
          ))}
        </select>
        <span className="ml-auto text-xs text-stone-500">
          {filtered.length} of {rows.length} shown
        </span>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-[10px] uppercase tracking-[0.16em] text-stone-500">
              <th className="px-4 py-3">Emp ID</th>
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Position</th>
              <th className="px-4 py-3">Department</th>
              <th className="px-4 py-3">Type</th>
              <th className="px-4 py-3 text-right">Monthly LAK</th>
              <th className="px-4 py-3 text-right">Hourly LAK</th>
              <th className="px-4 py-3">Hire Date</th>
              <th className="px-4 py-3">Last Payslip</th>
              <th className="px-4 py-3">Flags</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((r) => (
              <tr
                key={r.staff_id}
                onClick={() =>
                  router.push(`/operations/staff/${encodeURIComponent(r.staff_id)}`)
                }
                className="cursor-pointer border-t border-stone-100 hover:bg-stone-50"
              >
                <td className="px-4 py-3 font-mono text-xs text-stone-600">
                  {r.emp_id}
                </td>
                <td className="px-4 py-3 font-medium text-stone-900">
                  {r.full_name}
                </td>
                <td className="px-4 py-3 text-stone-700">{r.position_title}</td>
                <td className="px-4 py-3 text-stone-600">{r.dept_name}</td>
                <td className="px-4 py-3 font-mono text-[10px] uppercase tracking-wider text-stone-500">
                  {r.employment_type}
                </td>
                <td className="px-4 py-3 text-right tabular-nums">
                  {fmtMoney(r.monthly_salary, 'LAK')}
                </td>
                <td className="px-4 py-3 text-right tabular-nums text-stone-600">
                  {fmtMoney(r.hourly_cost_lak, 'LAK')}
                </td>
                <td className="px-4 py-3 text-stone-700">
                  {r.hire_date ?? <span className="text-stone-300">—</span>}
                </td>
                <td className="px-4 py-3">
                  <PayslipBadge status={r.payslip_pdf_status} />
                </td>
                <td className="px-4 py-3">
                  <FlagDots row={r} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <div className="p-8 text-center text-sm text-stone-500">
            No staff match the filter.
          </div>
        )}
      </div>
    </div>
  );
}

function PayslipBadge({ status }: { status: Row['payslip_pdf_status'] }) {
  const map = {
    current: { c: 'bg-emerald-100 text-emerald-900', t: 'current' },
    overdue: { c: 'bg-amber-100 text-amber-900', t: 'overdue' },
    never: { c: 'bg-stone-100 text-stone-500', t: 'never' },
  } as const;
  const v = map[status];
  return (
    <span
      className={`rounded-sm px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider ${v.c}`}
    >
      {v.t}
    </span>
  );
}

function FlagDots({ row }: { row: Row }) {
  const flags: { key: string; label: string; on: boolean; color: string }[] = [
    {
      key: 'h',
      label: 'Missing hire date',
      on: row.flag_missing_hire_date,
      color: 'bg-amber-500',
    },
    {
      key: 'c',
      label: 'Missing contract',
      on: row.flag_missing_contract,
      color: 'bg-rose-500',
    },
    {
      key: 'x',
      label: 'Contract expiring',
      on: row.flag_contract_expiring,
      color: 'bg-orange-500',
    },
  ];
  return (
    <div className="flex gap-1">
      {flags.map((f) =>
        f.on ? (
          <span
            key={f.key}
            title={f.label}
            className={`h-2 w-2 rounded-full ${f.color}`}
          />
        ) : null
      )}
    </div>
  );
}
