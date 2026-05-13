// app/operations/staff/_components/ArchivedStaffTable.tsx
// Staff who left the property — kept for record. PBS 2026-05-13 v3:
// canonical tokens (--paper, --ink, --kpi-frame) so it renders correctly
// on both Donna (cream) and Namkhan (dark). Bank info moved to drawer.

'use client';

import { useState, useMemo, useEffect, useCallback } from 'react';
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
  salary_currency?: string | null;
  bank_name: string | null;
  bank_account_no: string | null;
  bank_account_name: string | null;
  notes: string | null;
};

function fmtSalary(n: number | null | undefined, ccy: string | null | undefined): string {
  if (n == null || n === 0) return '—';
  const c = (ccy ?? 'LAK').toUpperCase();
  if (c === 'EUR') return n >= 1000 ? `€${(n / 1000).toFixed(1)}k` : `€${Math.round(n)}`;
  if (c === 'USD') return n >= 1000 ? `$${(n / 1000).toFixed(1)}k` : `$${Math.round(n)}`;
  if (n >= 1_000_000_000) return `₭${(n / 1_000_000_000).toFixed(1)}B`;
  if (n >= 1_000_000) return `₭${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1000) return `₭${Math.round(n / 1000)}k`;
  return `₭${Math.round(n)}`;
}

const S: Record<string, React.CSSProperties> = {
  wrapper: {
    borderRadius: 4,
    border: '1px solid var(--kpi-frame, rgba(168,133,74,0.45))',
    background: 'var(--paper-warm)',
    overflow: 'hidden',
  },
  filterRow: {
    display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 12,
    borderBottom: '1px solid var(--line-soft)',
    padding: '10px 14px',
    background: 'var(--paper)',
  },
  input: {
    background: 'var(--paper-warm)', border: '1px solid var(--kpi-frame)',
    color: 'var(--ink)', borderRadius: 4, padding: '6px 10px',
    fontSize: 13, width: 280, outline: 'none',
  },
  counter: {
    marginLeft: 'auto', fontFamily: 'var(--mono)', fontSize: 11,
    color: 'var(--ink-mute)', letterSpacing: '0.08em',
  },
  th: {
    textAlign: 'left' as const, padding: '8px 12px',
    fontFamily: 'var(--mono)', fontSize: 10, letterSpacing: '0.16em',
    textTransform: 'uppercase' as const, color: 'var(--brass)',
    fontWeight: 600, whiteSpace: 'nowrap' as const,
    borderBottom: '1px solid var(--kpi-frame)',
  },
  td: {
    padding: '8px 12px', fontSize: 13, color: 'var(--ink)',
    borderTop: '1px solid var(--line-soft)',
  },
  mono: { fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--ink-soft)' },
  muted: { color: 'var(--ink-mute)' },
  italic: { fontStyle: 'italic' as const },
  faint: { color: 'var(--ink-faint)' },
  rightNum: { textAlign: 'right' as const, fontVariantNumeric: 'tabular-nums' as const },
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
      <div className="panel dashed" style={{ textAlign: 'center', padding: 20, color: 'var(--ink-mute)', fontSize: 13 }}>
        No archived staff yet.
      </div>
    );
  }

  return (
    <>
      <div style={S.wrapper}>
        <div style={S.filterRow}>
          <input
            type="text"
            placeholder="Search archived (name, position, department)…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            style={S.input}
          />
          <span style={S.counter}>{filtered.length} of {rows.length} archived</span>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={S.th}>Emp ID</th>
                <th style={S.th}>Name</th>
                <th style={S.th}>Position</th>
                <th style={S.th}>Department</th>
                <th style={S.th}>Hired</th>
                <th style={S.th}>Left</th>
                <th style={{ ...S.th, textAlign: 'right' }}>Last salary</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((r) => {
                const isSelected = selectedStaffId === r.staff_id;
                return (
                  <tr
                    key={r.staff_id}
                    onClick={() => setSelectedStaffId(r.staff_id)}
                    style={{ cursor: 'pointer', background: isSelected ? 'var(--kpi-frame)' : undefined }}
                    onMouseEnter={(e) => {
                      if (!isSelected) e.currentTarget.style.background = 'rgba(168,133,74,0.06)';
                    }}
                    onMouseLeave={(e) => {
                      if (!isSelected) e.currentTarget.style.background = '';
                    }}
                  >
                    <td style={{ ...S.td, ...S.mono }}>{r.emp_id || '—'}</td>
                    <td style={{ ...S.td, ...S.italic }}>{r.full_name || '—'}</td>
                    <td style={{ ...S.td, ...S.muted }}>{r.position_title || '—'}</td>
                    <td style={{ ...S.td, ...S.muted }}>{r.dept_name || '—'}</td>
                    <td style={{ ...S.td, ...S.mono }}>
                      {r.hire_date || <span style={S.faint}>—</span>}
                    </td>
                    <td style={{ ...S.td, ...S.mono, color: 'var(--oxblood-soft)' }}>
                      {r.end_date || <span style={S.faint}>—</span>}
                    </td>
                    <td style={{ ...S.td, ...S.rightNum }}>
                      {fmtSalary(r.monthly_salary, r.salary_currency)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
      <StaffDrawer staffId={selectedStaffId} onClose={handleClose} />
    </>
  );
}
