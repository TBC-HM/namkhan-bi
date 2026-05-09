// app/sales/roster/page.tsx
// Sales › Roster — staff & sales agents.
// WIRED to public.v_staff_register_extended (proxy view, since 'ops' schema not API-exposed).

import { supabase } from '@/lib/supabase';
import Page from '@/components/page/Page';
import Panel from '@/components/page/Panel';
import KpiBox from '@/components/kpi/KpiBox';
import ArtifactActions from '@/components/page/ArtifactActions';
import RosterTable, { type StaffRow as StaffRowT } from './_components/RosterTable';
import { SALES_SUBPAGES } from '../_subpages';

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

  const ctx = (kind: 'panel' | 'table' | 'kpi' | 'brief', title: string) => ({ kind, title, dept: 'sales' as const });

  return (
    <Page
      eyebrow="Sales · Roster"
      title={<>Roster · <em style={{ color: 'var(--brass)', fontStyle: 'italic' }}>{display.length} active</em></>}
      subPages={SALES_SUBPAGES}
    >
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12, marginBottom: 14 }}>
        <KpiBox value={display.length} unit="count" label="Active staff" tooltip={`of ${staff.length} total`} />
        <KpiBox value={8}              unit="count" label="AI agents" tooltip="inquiry, group, fit, dmc, etc." />
        <KpiBox value={null}           unit="nights" label="Avg tenure" state="data-needed" needs="hire_date analytics" />
        <KpiBox value={null}           unit="count"  label="Productivity" state="data-needed" needs="deal data" />
        <KpiBox value={null}           unit="usd"    label="Comp accruals" state="data-needed" needs="payroll_monthly join" />
      </div>

      <Panel title={`Roster · ${display.length} active`} eyebrow="v_staff_register_extended" actions={<ArtifactActions context={ctx('table', 'Roster')} />}>
        <RosterTable rows={display as StaffRowT[]} />
      </Panel>

      <div style={{ marginTop: 14, padding: '10px 14px', background: 'var(--st-good-bg)', border: '1px solid var(--st-good-bd)', borderRadius: 6, color: 'var(--moss)', fontSize: "var(--t-sm)" }}>
        <strong>✓ Wired.</strong> Reading from <code>public.v_staff_register_extended</code> ({staff.length} active rows). Productivity &amp; comp metrics need deal/payroll join.
      </div>
    </Page>
  );
}
