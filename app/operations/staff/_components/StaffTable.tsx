// app/operations/staff/_components/StaffTable.tsx
// PBS 2026-05-13 — theme-adaptive. Uses --paper / --ink / --kpi-frame tokens
// so the SAME table renders cream on Donna and dark on Namkhan, both legible.
// Salary cell honors salary_currency (LAK for Namkhan, EUR for Donna, USD …).

'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import StatusPill, { type StatusTone } from '@/components/ui/StatusPill';

// PBS 2026-05-13: pill mappers for Factorial-derived status columns.
// 5-tone palette only (canonical StatusPill — no new tones per design rules).
function workStatusPill(v: string | null | undefined): { tone: StatusTone; label: string } | null {
  if (!v) return null;
  switch (v) {
    case 'active':           return { tone: 'active',   label: 'Active' };
    case 'active_rotating':  return { tone: 'active',   label: 'Rotating' };
    case 'new_hire':         return { tone: 'info',     label: 'New hire' };
    case 'silent_recent':    return { tone: 'pending',  label: 'Silent 30d+' };
    case 'silent_long':      return { tone: 'expired',  label: 'Silent 90d+' };
    case 'never_clocked':    return { tone: 'expired',  label: 'Never clocked' };
    case 'terminated':       return { tone: 'inactive', label: 'Terminated' };
    default:                 return { tone: 'inactive', label: v };
  }
}
function contractPatternPill(v: string | null | undefined): { tone: StatusTone; label: string } | null {
  if (!v) return null;
  switch (v) {
    case '12mo_year_round':       return { tone: 'inactive', label: '12 mo · year-round' };
    case '9mo_fijo_discontinuo':  return { tone: 'active',   label: '9 mo · fijo discont.' };
    case 'seasonal_5_7mo':        return { tone: 'pending',  label: 'Seasonal · 5–7 mo' };
    case 'short_1_4mo':           return { tone: 'pending',  label: 'Short · 1–4 mo' };
    case 'no_clock_2025':         return { tone: 'info',     label: 'New season hire' };
    default:                      return { tone: 'inactive', label: v };
  }
}

type Row = {
  staff_id: string;
  emp_id: string;
  full_name: string;
  position_title: string;
  dept_code: string;
  dept_name: string;
  employment_type: string;
  monthly_salary: number;
  salary_currency?: string | null;
  hourly_cost_lak: number;
  hire_date: string | null;
  last_payroll_period: string | null;
  last_payroll_total_usd?: number | null;
  last_payroll_cost_lak?: number | null;
  last_payroll_net_lak?: number | null;
  payslip_pdf_status: 'current' | 'overdue' | 'never';
  flag_missing_hire_date: boolean;
  flag_missing_contract: boolean;
  flag_contract_expiring: boolean;
  // PBS 2026-05-13: Factorial-derived status columns (Donna)
  work_status?: string | null;
  contract_pattern?: string | null;
  months_worked_2025?: number | null;
  last_clock_date?: string | null;
};

interface StaffTableProps {
  rows: Row[];
  onSelect?: (id: string) => void;
  selectedId?: string | null;
}

// ---- formatting helpers -----------------------------------------------------

function fmtSalary(n: number | null | undefined, ccy: string | null | undefined): string {
  if (n == null || n === 0) return '—';
  const c = (ccy ?? 'LAK').toUpperCase();
  if (c === 'EUR') {
    if (n >= 1000) return `€${(n / 1000).toFixed(1)}k`;
    return `€${Math.round(n)}`;
  }
  if (c === 'USD') {
    if (n >= 1000) return `$${(n / 1000).toFixed(1)}k`;
    return `$${Math.round(n)}`;
  }
  // LAK
  if (n >= 1_000_000_000) return `₭${(n / 1_000_000_000).toFixed(1)}B`;
  if (n >= 1_000_000) return `₭${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1000) return `₭${Math.round(n / 1000)}k`;
  return `₭${Math.round(n)}`;
}

// ---- styles -----------------------------------------------------------------

const tableStyles: Record<string, React.CSSProperties> = {
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
    background: 'var(--paper-warm)',
    border: '1px solid var(--kpi-frame)',
    color: 'var(--ink)',
    borderRadius: 4,
    padding: '6px 10px',
    fontSize: 13,
    width: 260,
    outline: 'none',
  },
  select: {
    background: 'var(--paper-warm)',
    border: '1px solid var(--kpi-frame)',
    color: 'var(--ink)',
    borderRadius: 4,
    padding: '6px 10px',
    fontSize: 13,
    cursor: 'pointer',
  },
  counter: {
    marginLeft: 'auto',
    fontFamily: 'var(--mono)',
    fontSize: 11,
    color: 'var(--ink-mute)',
    letterSpacing: '0.08em',
  },
  th: {
    textAlign: 'left' as const,
    padding: '10px 12px',
    fontFamily: 'var(--mono)',
    fontSize: 10,
    letterSpacing: '0.16em',
    textTransform: 'uppercase' as const,
    color: 'var(--brass)',
    fontWeight: 600,
    whiteSpace: 'nowrap' as const,
    borderBottom: '1px solid var(--kpi-frame)',
  },
  thRight: { textAlign: 'right' as const },
  td: {
    padding: '10px 12px',
    fontSize: 13,
    color: 'var(--ink)',
    borderTop: '1px solid var(--line-soft)',
    verticalAlign: 'middle' as const,
  },
  tdMono: {
    fontFamily: 'var(--mono)',
    fontSize: 12,
    color: 'var(--ink-soft)',
  },
  tdMuted: { color: 'var(--ink-mute)' },
  tdStrong: { color: 'var(--ink)', fontWeight: 500 },
  tdRight: { textAlign: 'right' as const, fontVariantNumeric: 'tabular-nums' as const },
  emDash: { color: 'var(--ink-faint)' },
};

// ---- component --------------------------------------------------------------

export function StaffTable({ rows, onSelect, selectedId }: StaffTableProps) {
  const router = useRouter();
  const [q, setQ] = useState('');
  const [dept, setDept] = useState<string>('all');

  const depts = useMemo(
    () => Array.from(new Set(rows.map((r) => r.dept_name).filter(Boolean))).sort(),
    [rows]
  );

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return rows.filter((r) => {
      if (dept !== 'all' && r.dept_name !== dept) return false;
      if (!needle) return true;
      return (
        (r.full_name || '').toLowerCase().includes(needle) ||
        (r.emp_id || '').toLowerCase().includes(needle) ||
        (r.position_title || '').toLowerCase().includes(needle)
      );
    });
  }, [rows, q, dept]);

  return (
    <div style={tableStyles.wrapper}>
      <div style={tableStyles.filterRow}>
        <input
          type="text"
          placeholder="Search name, code, position…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          style={tableStyles.input}
        />
        <select
          value={dept}
          onChange={(e) => setDept(e.target.value)}
          style={tableStyles.select}
        >
          <option value="all">All departments</option>
          {depts.map((d) => (
            <option key={d} value={d}>{d}</option>
          ))}
        </select>
        <span style={tableStyles.counter}>
          {filtered.length} of {rows.length} shown
        </span>
      </div>

      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={tableStyles.th}>Emp ID</th>
              <th style={tableStyles.th}>Name</th>
              <th style={tableStyles.th}>Position</th>
              <th style={tableStyles.th}>Department</th>
              <th style={tableStyles.th}>Type</th>
              <th style={tableStyles.th}>Status · Contract</th>
              <th style={{ ...tableStyles.th, ...tableStyles.thRight }}>Base</th>
              <th style={{ ...tableStyles.th, ...tableStyles.thRight }}>Gross · last</th>
              <th style={{ ...tableStyles.th, ...tableStyles.thRight }}>Net · last</th>
              <th style={tableStyles.th}>Hire date</th>
              <th style={tableStyles.th}>Last payslip</th>
              <th style={tableStyles.th}>Flags</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((r) => {
              const isSelected = selectedId === r.staff_id;
              return (
                <tr
                  key={r.staff_id}
                  onClick={() => {
                    if (onSelect) onSelect(r.staff_id);
                    else router.push(`/operations/staff/${encodeURIComponent(r.staff_id)}`);
                  }}
                  style={{
                    cursor: 'pointer',
                    background: isSelected ? 'var(--kpi-frame)' : undefined,
                  }}
                  onMouseEnter={(e) => {
                    if (!isSelected) e.currentTarget.style.background = 'rgba(168,133,74,0.06)';
                  }}
                  onMouseLeave={(e) => {
                    if (!isSelected) e.currentTarget.style.background = '';
                  }}
                >
                  <td style={{ ...tableStyles.td, ...tableStyles.tdMono }}>{r.emp_id || '—'}</td>
                  <td style={{ ...tableStyles.td, ...tableStyles.tdStrong }}>{r.full_name || '—'}</td>
                  <td style={tableStyles.td}>
                    {r.position_title || <span style={tableStyles.emDash}>—</span>}
                  </td>
                  <td style={tableStyles.td}>
                    {r.dept_name || <span style={tableStyles.emDash}>—</span>}
                  </td>
                  <td style={{
                    ...tableStyles.td,
                    fontFamily: 'var(--mono)', fontSize: 10,
                    letterSpacing: '0.12em', textTransform: 'uppercase',
                    color: 'var(--ink-mute)',
                  }}>
                    {r.employment_type || '—'}
                  </td>
                  <td style={tableStyles.td}>
                    <StaffStatusCell row={r} />
                  </td>
                  <td style={{ ...tableStyles.td, ...tableStyles.tdRight }}>
                    {fmtSalary(r.monthly_salary, r.salary_currency)}
                  </td>
                  <td style={{ ...tableStyles.td, ...tableStyles.tdRight, fontWeight: 600 }}>
                    {fmtSalary(r.last_payroll_cost_lak ?? null, r.salary_currency)}
                  </td>
                  <td style={{ ...tableStyles.td, ...tableStyles.tdRight, ...tableStyles.tdMuted }}>
                    {fmtSalary(r.last_payroll_net_lak ?? null, r.salary_currency)}
                  </td>
                  <td style={{ ...tableStyles.td, ...tableStyles.tdMono }}>
                    {r.hire_date || <span style={tableStyles.emDash}>—</span>}
                  </td>
                  <td style={tableStyles.td}>
                    <PayslipBadge status={r.payslip_pdf_status} />
                  </td>
                  <td style={tableStyles.td}>
                    <FlagDots row={r} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <div style={{ padding: 24, textAlign: 'center', color: 'var(--ink-mute)', fontStyle: 'italic', fontSize: 13 }}>
            No staff match the filter.
          </div>
        )}
      </div>
    </div>
  );
}

// ---- atoms ------------------------------------------------------------------

function PayslipBadge({ status }: { status: Row['payslip_pdf_status'] }) {
  const map: Record<Row['payslip_pdf_status'], { bg: string; fg: string; t: string }> = {
    current:  { bg: 'rgba(107,147,121,0.18)', fg: 'var(--st-good, #82ad8c)', t: 'current' },
    overdue:  { bg: 'rgba(168,133,74,0.18)',  fg: 'var(--brass)',            t: 'overdue' },
    never:    { bg: 'var(--paper-deep)',      fg: 'var(--ink-mute)',         t: 'never'   },
  };
  const v = map[status] ?? map.never;
  return (
    <span style={{
      background: v.bg, color: v.fg,
      padding: '2px 8px', borderRadius: 3,
      fontFamily: 'var(--mono)', fontSize: 10,
      letterSpacing: '0.12em', textTransform: 'uppercase',
      border: '1px solid var(--kpi-frame)',
    }}>{v.t}</span>
  );
}

// PBS 2026-05-13 — status + contract pills from Factorial-derived columns.
// Empty cell (em-dash) for properties without these columns (e.g. Namkhan).
function StaffStatusCell({ row }: { row: Row }) {
  const ws = workStatusPill(row.work_status);
  const cp = contractPatternPill(row.contract_pattern);
  if (!ws && !cp) return <span style={{ color: 'var(--ink-faint)' }}>—</span>;
  const months = row.months_worked_2025;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
        {ws && <StatusPill tone={ws.tone}>{ws.label}</StatusPill>}
        {cp && <StatusPill tone={cp.tone}>{cp.label}</StatusPill>}
      </div>
      {months != null && months > 0 && (
        <span style={{
          fontFamily: 'var(--mono)', fontSize: 9,
          color: 'var(--ink-mute)', letterSpacing: '0.10em',
        }}>
          {months} mo · 2025
        </span>
      )}
    </div>
  );
}

function FlagDots({ row }: { row: Row }) {
  const flags = [
    { key: 'h', label: 'Missing hire date',   on: row.flag_missing_hire_date,   color: 'var(--brass)' },
    { key: 'c', label: 'Missing contract',    on: row.flag_missing_contract,    color: 'var(--oxblood-soft)' },
    { key: 'x', label: 'Contract expiring',   on: row.flag_contract_expiring,   color: '#e98257' },
  ];
  return (
    <div style={{ display: 'flex', gap: 4 }}>
      {flags.map((f) => f.on ? (
        <span key={f.key} title={f.label}
              style={{ width: 8, height: 8, borderRadius: '50%', background: f.color, display: 'inline-block' }} />
      ) : null)}
    </div>
  );
}
