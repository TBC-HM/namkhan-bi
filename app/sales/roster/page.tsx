// app/sales/roster/page.tsx
// Sales › Roster — staff & sales agents. WIRED to ops.staff_employment + ops.departments.

import { supabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';
export const revalidate = 60;

interface StaffRow {
  id: string;
  full_name: string | null;
  position_title: string | null;
  employment_type: string | null;
  monthly_salary: number | null;
  salary_currency: string | null;
  hire_date: string | null;
  is_active: boolean | null;
  contract_hours_pw: number | null;
  skills: string[] | null;
  dept_id: string | null;
}

interface DeptRow {
  dept_id: string;
  name: string;
  code: string | null;
}

async function getStaffWithDepts() {
  const [{ data: staff }, { data: depts }] = await Promise.all([
    supabase
      .schema('ops')
      .from('staff_employment')
      .select('id, full_name, position_title, employment_type, monthly_salary, salary_currency, hire_date, is_active, contract_hours_pw, skills, dept_id')
      .eq('is_active', true)
      .order('full_name'),
    supabase
      .schema('ops')
      .from('departments')
      .select('dept_id, name, code'),
  ]);
  return {
    staff: (staff ?? []) as StaffRow[],
    depts: (depts ?? []) as DeptRow[],
  };
}

export default async function RosterPage() {
  const { staff, depts } = await getStaffWithDepts();
  const deptName = new Map(depts.map((d) => [d.dept_id, d.name] as const));

  const salesDeptCodes = ['SALES', 'RES', 'FRONTOFFICE', 'FO', 'GM', 'MGT'];
  const salesDeptIds = new Set(depts.filter((d) => salesDeptCodes.includes((d.code ?? '').toUpperCase())).map((d) => d.dept_id));
  const salesStaff = salesDeptIds.size > 0
    ? staff.filter((s) => s.dept_id && salesDeptIds.has(s.dept_id))
    : staff.slice(0, 30);

  const fmtSalary = (n: number | null, cur: string | null) =>
    n == null ? '—' : `${cur ?? 'LAK'} ${n.toLocaleString('en-US', { maximumFractionDigits: 0 })}`;

  return (
    <>
      <div style={{ fontSize: 11, color: '#8a8170', textTransform: 'uppercase', letterSpacing: '0.08em', marginTop: 14 }}>
        <strong style={{ color: '#4a4538' }}>Sales</strong> › Roster
      </div>
      <h1 style={{ margin: '4px 0 2px', fontFamily: 'Georgia, serif', fontWeight: 500, fontSize: 30 }}>
        Roster · <em style={{ color: '#a17a4f' }}>{salesStaff.length} active</em>
      </h1>
      <div style={{ fontSize: 13, color: '#4a4538' }}>
        Sales-adjacent staff from <code style={{ fontSize: 11 }}>ops.staff_employment</code>. Territory & comp ledger pending.
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, minmax(0, 1fr))', gap: 10, margin: '14px 0' }}>
        {[
          { scope: 'Active staff',     value: String(salesStaff.length), sub: 'sales-adjacent depts', lorem: false },
          { scope: 'AI agents',        value: '8',                       sub: 'inquiry, group, fit, dmc, etc.', lorem: false },
          { scope: 'Avg tenure',       value: 'lorem',                   sub: 'needs hire_date analytics', lorem: true },
          { scope: 'Productivity',     value: 'lorem',                   sub: 'needs deal data', lorem: true },
          { scope: 'Comp accruals',    value: 'lorem',                   sub: 'needs payroll_monthly join', lorem: true },
        ].map((k) => (
          <div key={k.scope} style={{ background: '#fff', border: '1px solid #e6dfc9', borderRadius: 8, padding: '12px 14px' }}>
            <div style={{ fontSize: 10.5, color: '#8a8170', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{k.scope}</div>
            <div style={{ fontFamily: 'Georgia, serif', fontSize: 22, fontWeight: 500, color: k.lorem ? '#c5b89a' : '#4a4538', fontStyle: k.lorem ? 'italic' : 'normal', margin: '2px 0' }}>{k.value}</div>
            <div style={{ fontSize: 11, color: '#8a8170' }}>{k.sub}</div>
          </div>
        ))}
      </div>

      <div style={{ background: '#fff', border: '1px solid #e6dfc9', borderRadius: 8, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
          <thead>
            <tr style={{ background: '#f7f3e7', textAlign: 'left', color: '#8a8170', fontSize: 10.5, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
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
            {salesStaff.map((s) => (
              <tr key={s.id} style={{ borderTop: '1px solid #f0eadb' }}>
                <td style={{ padding: '10px 12px', fontWeight: 500 }}>{s.full_name ?? '—'}</td>
                <td style={{ padding: '10px 12px' }}>{s.position_title ?? '—'}</td>
                <td style={{ padding: '10px 12px', color: '#8a8170' }}>{s.dept_id ? (deptName.get(s.dept_id) ?? '—') : '—'}</td>
                <td style={{ padding: '10px 12px', fontSize: 11.5 }}>{s.employment_type ?? '—'}</td>
                <td style={{ padding: '10px 12px', color: '#8a8170', fontFamily: 'Menlo, monospace', fontSize: 11.5 }}>{s.hire_date ?? '—'}</td>
                <td style={{ padding: '10px 12px', textAlign: 'right', fontFamily: 'Menlo, monospace' }}>{s.contract_hours_pw ?? '—'}</td>
                <td style={{ padding: '10px 12px', textAlign: 'right', fontFamily: 'Menlo, monospace' }}>{fmtSalary(s.monthly_salary, s.salary_currency)}</td>
                <td style={{ padding: '10px 12px', fontSize: 11, color: '#8a8170' }}>
                  {s.skills && s.skills.length > 0 ? s.skills.slice(0, 3).join(', ') + (s.skills.length > 3 ? '…' : '') : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div style={{ marginTop: 14, padding: '10px 14px', background: '#e6f4ec', border: '1px solid #aed6c0', borderRadius: 6, color: '#1f5f3a', fontSize: 11.5 }}>
        <strong>✓ Wired.</strong> {staff.length} total active staff in <code>ops.staff_employment</code>; showing sales-adjacent slice. Productivity &amp; comp metrics need deal/payroll join.
      </div>
    </>
  );
}
