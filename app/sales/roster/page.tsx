// app/sales/roster/page.tsx
// Sales › Roster — staff & sales agents.
// WIRED to public.v_staff_register_extended (proxy view, since 'ops' schema not API-exposed).

import { supabase } from '@/lib/supabase';
import PageHeader from '@/components/layout/PageHeader';

export const dynamic = 'force-dynamic';
export const revalidate = 60;

interface StaffRow {
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

async function getStaff() {
  const { data, error } = await supabase
    .from('v_staff_register_extended')
    .select('staff_id, full_name, position_title, dept_code, dept_name, employment_type, monthly_salary, salary_currency, hire_date, is_active, contract_hours_pw, skills')
    .eq('is_active', true)
    .order('full_name');
  if (error) {
    console.error('[roster] error', error);
    return [] as StaffRow[];
  }
  return (data ?? []) as StaffRow[];
}

export default async function RosterPage() {
  const staff = await getStaff();

  const salesDeptCodes = ['SALES', 'RES', 'FRONTOFFICE', 'FO', 'GM', 'MGT', 'SAL'];
  const salesStaff = staff.filter((s) => s.dept_code && salesDeptCodes.includes(s.dept_code.toUpperCase()));
  const display = salesStaff.length > 0 ? salesStaff : staff.slice(0, 30);

  const fmtSalary = (n: number | null, cur: string | null) =>
    n == null ? '—' : `${cur ?? 'LAK'} ${n.toLocaleString('en-US', { maximumFractionDigits: 0 })}`;

  return (
    <>
      <PageHeader
        pillar="Sales"
        tab="Roster"
        title={<>Roster · <em style={{ color: 'var(--brass)', fontStyle: 'italic' }}>{display.length} active</em></>}
        lede={<>{salesStaff.length > 0 ? `Sales-adjacent staff (${salesStaff.length} of ${staff.length} total)` : `Showing first 30 of ${staff.length} active staff (no sales-coded department found)`} from <code style={{ fontSize: "var(--t-sm)" }}>v_staff_register_extended</code>.</>}
      />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, minmax(0, 1fr))', gap: 10, margin: '14px 0' }}>
        {[
          { scope: 'Active staff',     value: String(display.length),  sub: `of ${staff.length} total`,             lorem: false },
          { scope: 'AI agents',        value: '8',                     sub: 'inquiry, group, fit, dmc, etc.',       lorem: false },
          { scope: 'Avg tenure',       value: 'lorem',                 sub: 'needs hire_date analytics',            lorem: true  },
          { scope: 'Productivity',     value: 'lorem',                 sub: 'needs deal data',                       lorem: true  },
          { scope: 'Comp accruals',    value: 'lorem',                 sub: 'needs payroll_monthly join',            lorem: true  },
        ].map((k) => (
          <div key={k.scope} className="kpi-box" data-tooltip={`${k.scope} · ${k.sub}`}>
            <div className="kpi-tile-scope">{k.scope}</div>
            <div className={`kpi-box-value${k.lorem ? ' lorem' : ''}`}>{k.value}</div>
            <div className="kpi-tile-sub">{k.sub}</div>
          </div>
        ))}
      </div>

      <div style={{ background: 'var(--paper-warm)', border: '1px solid var(--paper-deep)', borderRadius: 8, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: "var(--t-base)" }}>
          <thead>
            <tr style={{ background: 'var(--paper-warm)', textAlign: 'left', color: 'var(--ink-mute)', fontSize: "var(--t-xs)", textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              <th style={{ padding: '10px 12px' }}>Name</th>
              <th style={{ padding: '10px 12px' }}>Position</th>
              <th style={{ padding: '10px 12px' }}>Department</th>
              <th style={{ padding: '10px 12px' }}>Type</th>
              <th style={{ padding: '10px 12px' }}>Hired</th>
              <th style={{ padding: '10px 12px', textAlign: 'right' }}>Hrs/wk</th>
              <th style={{ padding: '10px 12px', textAlign: 'right' }}>Salary</th>
              <th style={{ padding: '10px 12px' }}>Skills</th>
            </tr>
          </thead>
          <tbody>
            {display.map((s) => (
              <tr key={s.staff_id} style={{ borderTop: '1px solid var(--paper-warm)' }}>
                <td style={{ padding: '10px 12px', fontWeight: 500 }}>{s.full_name ?? '—'}</td>
                <td style={{ padding: '10px 12px' }}>{s.position_title ?? '—'}</td>
                <td style={{ padding: '10px 12px', color: 'var(--ink-mute)' }}>{s.dept_name ?? s.dept_code ?? '—'}</td>
                <td style={{ padding: '10px 12px', fontSize: "var(--t-sm)" }}>{s.employment_type ?? '—'}</td>
                <td style={{ padding: '10px 12px', color: 'var(--ink-mute)', fontFamily: 'var(--mono)', fontSize: "var(--t-sm)" }}>{s.hire_date ?? '—'}</td>
                <td style={{ padding: '10px 12px', textAlign: 'right', fontFamily: 'var(--mono)' }}>{s.contract_hours_pw ?? '—'}</td>
                <td style={{ padding: '10px 12px', textAlign: 'right', fontFamily: 'var(--mono)' }}>{fmtSalary(s.monthly_salary, s.salary_currency)}</td>
                <td style={{ padding: '10px 12px', fontSize: "var(--t-sm)", color: 'var(--ink-mute)' }}>
                  {s.skills && s.skills.length > 0 ? s.skills.slice(0, 3).join(', ') + (s.skills.length > 3 ? '…' : '') : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div style={{ marginTop: 14, padding: '10px 14px', background: 'var(--st-good-bg)', border: '1px solid var(--st-good-bd)', borderRadius: 6, color: 'var(--moss)', fontSize: "var(--t-sm)" }}>
        <strong>✓ Wired.</strong> Reading from <code>public.v_staff_register_extended</code> ({staff.length} active rows). Productivity &amp; comp metrics need deal/payroll join.
      </div>
    </>
  );
}
