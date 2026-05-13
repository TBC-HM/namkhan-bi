// app/operations/staff/_components/DeptBreakdown.tsx
// Department-level payroll breakdown with EXPANDABLE rows.
// Click a department row → shows the employees in that department inline.
// PBS 2026-05-13.

'use client';

import { useState, useMemo, useCallback, useEffect } from 'react';
import { fmtMoney, fmtTableUsd, EMPTY, FX_LAK_PER_USD } from '@/lib/format';
import UsdLak from './UsdLak';
import { StaffDrawer } from './StaffDrawer';

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
  total_canonical_net_lak: number | null;
  total_canonical_net_usd: number | null;
  total_canonical_cost_lak: number | null;
  total_canonical_cost_usd: number | null;
  total_benefits_lak: number | null;
};

export type DeptEmployee = {
  staff_id: string;
  emp_id: string;
  full_name: string;
  position_title: string;
  dept_code: string;
  employment_type: string;
  monthly_salary: number;
  hire_date: string | null;
};

interface Props {
  rows: DeptRow[];
  /** LAK per USD — used to convert LAK column totals into USD primary display. */
  fx: number;
  /** Active employees keyed by dept_code. Rendered inline on expand. */
  employeesByDept: Record<string, DeptEmployee[]>;
}

export default function DeptBreakdown({ rows, fx, employeesByDept }: Props) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [sortKey, setSortKey] = useState<string>('grand');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [selectedStaffId, setSelectedStaffId] = useState<string | null>(null);
  const handleCloseDrawer = useCallback(() => setSelectedStaffId(null), []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && handleCloseDrawer();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [handleCloseDrawer]);

  const toggle = (code: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(code)) next.delete(code);
      else next.add(code);
      return next;
    });
  };

  const sorters: Record<string, (r: DeptRow) => number | string> = {
    dept:     (r) => r.dept_name,
    hc:       (r) => r.headcount,
    base:     (r) => Number(r.total_base_lak ?? 0),
    ot:       (r) => Number(r.total_overtime_lak ?? 0),
    benefits: (r) => Number(r.total_sc_lak ?? 0) + Number(r.total_allow_lak ?? 0),
    sso:      (r) => Number(r.total_sso_lak ?? 0),
    tax:      (r) => Number(r.total_tax_lak ?? 0),
    net:      (r) => Number(r.total_canonical_net_lak ?? r.total_net_lak ?? 0),
    grand:    (r) => Number(r.total_canonical_cost_usd ?? r.total_grand_usd ?? 0),
  };

  const sorted = useMemo(() => {
    const fn = sorters[sortKey];
    if (!fn) return rows;
    const out = [...rows].sort((a, b) => {
      const av = fn(a);
      const bv = fn(b);
      if (av < bv) return sortDir === 'asc' ? -1 : 1;
      if (av > bv) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });
    return out;
  }, [rows, sortKey, sortDir]);

  const onHeaderClick = (k: string) => {
    if (k === sortKey) setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    else { setSortKey(k); setSortDir('desc'); }
  };

  const cell = (lak: number | null, tone: 'pos' | 'neg' | 'default' = 'default') => {
    if (lak == null || lak === 0) return <span style={{ color: 'var(--ink-faint)' }}>{EMPTY}</span>;
    return <UsdLak lak={Number(lak)} fx={fx} tone={tone} />;
  };

  const headers: { key: string; label: string; align?: 'right' }[] = [
    { key: 'dept',     label: 'Department' },
    { key: 'hc',       label: 'HC',                align: 'right' },
    { key: 'base',     label: 'Base',              align: 'right' },
    { key: 'ot',       label: 'Overtime',          align: 'right' },
    { key: 'benefits', label: 'Benefits',          align: 'right' },
    { key: 'sso',      label: 'SSO',               align: 'right' },
    { key: 'tax',      label: 'Tax',               align: 'right' },
    { key: 'net',      label: 'Net to employees',  align: 'right' },
    { key: 'grand',    label: 'Company cost (USD)', align: 'right' },
  ];

  return (
    <>
    <div className="panel" style={{ padding: 0, overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
        <thead>
          <tr style={{ borderBottom: '1px solid var(--kpi-frame, rgba(168,133,74,0.45))' }}>
            <th style={{ width: 28 }} />
            {headers.map((h) => (
              <th
                key={h.key}
                onClick={() => onHeaderClick(h.key)}
                style={{
                  textAlign: h.align ?? 'left',
                  padding: '10px 12px',
                  cursor: 'pointer',
                  fontFamily: 'var(--mono)',
                  fontSize: 10,
                  letterSpacing: 'var(--ls-extra)',
                  textTransform: 'uppercase',
                  color: 'var(--brass)',
                  whiteSpace: 'nowrap',
                  userSelect: 'none',
                }}
                title="Click to sort"
              >
                {h.label}
                {sortKey === h.key && <span style={{ marginLeft: 4 }}>{sortDir === 'asc' ? '▲' : '▼'}</span>}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sorted.map((r) => {
            const isOpen = expanded.has(r.dept_code);
            const employees = employeesByDept[r.dept_code] ?? [];
            return (
              <FragmentRow
                key={r.dept_code}
                row={r}
                cell={cell}
                fx={fx}
                isOpen={isOpen}
                employees={employees}
                onToggle={() => toggle(r.dept_code)}
                onSelectStaff={setSelectedStaffId}
              />
            );
          })}
          {sorted.length === 0 && (
            <tr>
              <td colSpan={headers.length + 1} style={{ textAlign: 'center', padding: 20, color: 'var(--ink-mute)', fontStyle: 'italic' }}>
                No payroll has been calculated for this period.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
    <StaffDrawer staffId={selectedStaffId} onClose={handleCloseDrawer} />
    </>
  );
}

function FragmentRow({
  row, cell, fx, isOpen, employees, onToggle, onSelectStaff,
}: {
  row: DeptRow;
  cell: (lak: number | null, tone?: 'pos' | 'neg' | 'default') => React.ReactNode;
  fx: number;
  isOpen: boolean;
  employees: DeptEmployee[];
  onToggle: () => void;
  onSelectStaff: (id: string) => void;
}) {
  const summaryTd: React.CSSProperties = { padding: '10px 12px', borderTop: '1px solid var(--line-soft, rgba(168,133,74,0.15))' };
  return (
    <>
      <tr
        onClick={onToggle}
        style={{ cursor: 'pointer', background: isOpen ? 'rgba(168,133,74,0.08)' : undefined }}
        className="dept-row"
      >
        <td style={{ ...summaryTd, textAlign: 'center', color: 'var(--brass)', userSelect: 'none' }}>
          {isOpen ? '▾' : '▸'}
        </td>
        <td style={{ ...summaryTd, fontWeight: 500, color: 'var(--ink)' }}>
          {row.dept_name}
        </td>
        <td style={{ ...summaryTd, textAlign: 'right' }}>{row.headcount?.toLocaleString() ?? EMPTY}</td>
        <td style={{ ...summaryTd, textAlign: 'right' }}>{cell(Number(row.total_base_lak))}</td>
        <td style={{ ...summaryTd, textAlign: 'right' }}>{cell(Number(row.total_overtime_lak))}</td>
        <td style={{ ...summaryTd, textAlign: 'right' }}>{cell(Number(row.total_sc_lak ?? 0) + Number(row.total_allow_lak ?? 0), 'pos')}</td>
        <td style={{ ...summaryTd, textAlign: 'right' }}>{cell(Number(row.total_sso_lak), 'neg')}</td>
        <td style={{ ...summaryTd, textAlign: 'right' }}>{cell(Number(row.total_tax_lak), 'neg')}</td>
        <td style={{ ...summaryTd, textAlign: 'right' }}>{cell(Number(row.total_canonical_net_lak ?? row.total_net_lak))}</td>
        <td style={{ ...summaryTd, textAlign: 'right', fontWeight: 600, color: 'var(--ink)' }}>
          {fmtTableUsd(Number(row.total_canonical_cost_usd ?? row.total_grand_usd))}
        </td>
      </tr>
      {isOpen && (
        <tr>
          <td colSpan={10} style={{ padding: 0, background: 'rgba(168,133,74,0.03)', borderTop: '1px solid var(--line-soft, rgba(168,133,74,0.15))' }}>
            <DeptEmployeeList employees={employees} onSelect={onSelectStaff} />
          </td>
        </tr>
      )}
    </>
  );
}

function DeptEmployeeList({ employees, onSelect }: { employees: DeptEmployee[]; onSelect: (id: string) => void }) {
  if (employees.length === 0) {
    return (
      <div style={{ padding: 16, fontStyle: 'italic', color: 'var(--ink-mute)', fontSize: 12 }}>
        No active employees in this department.
      </div>
    );
  }
  return (
    <div style={{ padding: '8px 12px 12px' }}>
      <div style={{
        fontFamily: 'var(--mono)',
        fontSize: 10,
        letterSpacing: 'var(--ls-extra)',
        textTransform: 'uppercase',
        color: 'var(--brass)',
        padding: '6px 0',
      }}>
        {employees.length} employee{employees.length === 1 ? '' : 's'} · click to open profile
      </div>
      <table style={{ width: '100%', fontSize: 12, borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ color: 'var(--ink-mute)', textAlign: 'left' }}>
            <th style={{ padding: '6px 8px', fontSize: 10, fontFamily: 'var(--mono)', letterSpacing: 'var(--ls-extra)', textTransform: 'uppercase' }}>Emp ID</th>
            <th style={{ padding: '6px 8px', fontSize: 10, fontFamily: 'var(--mono)', letterSpacing: 'var(--ls-extra)', textTransform: 'uppercase' }}>Name</th>
            <th style={{ padding: '6px 8px', fontSize: 10, fontFamily: 'var(--mono)', letterSpacing: 'var(--ls-extra)', textTransform: 'uppercase' }}>Position</th>
            <th style={{ padding: '6px 8px', fontSize: 10, fontFamily: 'var(--mono)', letterSpacing: 'var(--ls-extra)', textTransform: 'uppercase' }}>Type</th>
            <th style={{ padding: '6px 8px', fontSize: 10, fontFamily: 'var(--mono)', letterSpacing: 'var(--ls-extra)', textTransform: 'uppercase', textAlign: 'right' }}>Monthly</th>
            <th style={{ padding: '6px 8px', fontSize: 10, fontFamily: 'var(--mono)', letterSpacing: 'var(--ls-extra)', textTransform: 'uppercase' }}>Hired</th>
          </tr>
        </thead>
        <tbody>
          {employees.map((e) => (
            <tr
              key={e.staff_id}
              onClick={(ev) => { ev.stopPropagation(); onSelect(e.staff_id); }}
              style={{ cursor: 'pointer', borderTop: '1px solid var(--line-soft, rgba(168,133,74,0.12))' }}
              className="emp-row"
            >
              <td style={{ padding: '6px 8px', fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--ink-mute)' }}>{e.emp_id}</td>
              <td style={{ padding: '6px 8px', color: 'var(--ink)', fontWeight: 500 }}>{e.full_name}</td>
              <td style={{ padding: '6px 8px', color: 'var(--ink)' }}>{e.position_title ?? EMPTY}</td>
              <td style={{ padding: '6px 8px', fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--ink-mute)', textTransform: 'uppercase', letterSpacing: 'var(--ls-extra)' }}>{e.employment_type ?? EMPTY}</td>
              <td style={{ padding: '6px 8px', textAlign: 'right', color: 'var(--ink)' }}>{fmtMoney(e.monthly_salary, 'LAK')}</td>
              <td style={{ padding: '6px 8px', fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--ink-mute)' }}>{e.hire_date ?? EMPTY}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
