// app/operations/staff/_components/ArchivedStaffTable.tsx
// Staff who left the property — kept for record (payroll history, bank info, end date).
// PBS 2026-05-13: bank info moved out of the table — only visible in slide-in drawer.
'use client';

import { useState, useMemo, useEffect, useCallback } from 'react';
import UsdLak from './UsdLak';
import { StaffDrawer } from './StaffDrawer';

export type ArchivedRow = {
  staff_id: string;
  emp_id: string;
  full_name: string;
  position_title: string | null;
  dept_name: string | null;
  hire_date: string | null;
  end_date: string | null;
  monthly_salary: number;
  bank_name: string | null;
  bank_account_no: string | null;
  bank_account_name: string | null;
  notes: string | null;
};

export function ArchivedStaffTable({ rows }: { rows: ArchivedRow[] }) {
  const [q, setQ] = useState('');
  const [selectedStaffId, setSelectedStaffId] = useState<string | null>(null);
  const handleClose = useCallback(() => setSelectedStaffId(null), []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && handleClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [handleClose]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return rows;
    return rows.filter((r) =>
      r.full_name.toLowerCase().includes(needle) ||
      r.emp_id.toLowerCase().includes(needle) ||
      (r.position_title || '').toLowerCase().includes(needle) ||
      (r.dept_name || '').toLowerCase().includes(needle)
    );
  }, [rows, q]);

  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => (b.end_date || '').localeCompare(a.end_date || ''));
  }, [filtered]);

  if (rows.length === 0) {
    return (
      <div className="panel dashed" style={{ textAlign: 'center', padding: '20px', color: 'var(--ink-mute)', fontSize: 'var(--t-sm)' }}>
        No archived staff yet.
      </div>
    );
  }

  return (
    <>
    <div className="rounded-sm border border-stone-300 bg-white">
      <div className="flex flex-wrap items-center gap-3 border-b border-stone-200 px-4 py-3">
        <input
          type="text"
          placeholder="Search archived (name, position, department)…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="w-72 rounded-sm border border-stone-300 px-3 py-1.5 text-sm focus:border-stone-700 focus:outline-none"
        />
        <span className="ml-auto text-xs text-stone-500">
          {filtered.length} of {rows.length} archived
        </span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-[10px] uppercase tracking-[0.16em] text-stone-500">
              <th className="px-4 py-2">Emp ID</th>
              <th className="px-4 py-2">Name</th>
              <th className="px-4 py-2">Position</th>
              <th className="px-4 py-2">Department</th>
              <th className="px-4 py-2">Hired</th>
              <th className="px-4 py-2">Left</th>
              <th className="px-4 py-2 text-right">Last salary</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((r) => (
              <tr
                key={r.staff_id}
                onClick={() => setSelectedStaffId(r.staff_id)}
                className={`cursor-pointer border-t border-stone-100 hover:bg-stone-50 ${
                  selectedStaffId === r.staff_id ? 'bg-emerald-900/5' : ''
                }`}
              >
                <td className="px-4 py-2 font-mono text-xs text-stone-600">{r.emp_id}</td>
                <td className="px-4 py-2 font-medium text-stone-700" style={{ fontStyle: 'italic' }}>
                  {r.full_name}
                </td>
                <td className="px-4 py-2 text-stone-600">{r.position_title || '—'}</td>
                <td className="px-4 py-2 text-stone-600">{r.dept_name || '—'}</td>
                <td className="px-4 py-2 text-stone-600 font-mono text-xs">
                  {r.hire_date || <span className="text-stone-300">—</span>}
                </td>
                <td className="px-4 py-2 font-mono text-xs" style={{ color: 'var(--st-bad)' }}>
                  {r.end_date || <span className="text-stone-300">—</span>}
                </td>
                <td className="px-4 py-2 text-right tabular-nums">
                  {r.monthly_salary > 0 ? <UsdLak lak={Number(r.monthly_salary)} /> : <span className="text-stone-300">—</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
    <StaffDrawer staffId={selectedStaffId} onClose={handleClose} />
    </>
  );
}
