// app/operations/staff/_components/StaffPageContent.tsx
// PBS 2026-05-13 — single canonical staff page shared by:
//   - /operations/staff           (Namkhan, default property)
//   - /h/[property_id]/operations/staff (any property, scoped via prop)
//
// All view queries filter by propertyId. Views were extended to expose
// property_id in migration `staff_views_expose_property_id`.

import { supabase } from '@/lib/supabase';
import { FX_LAK_PER_USD } from '@/lib/format';
import { AnomalyCard } from './AnomalyCard';
import { StaffShell } from './StaffShell';
import { ArchivedStaffTable, type ArchivedRow } from './ArchivedStaffTable';
import DeptBreakdown, { type DeptRow, type DeptEmployee } from './DeptBreakdown';
import StaffMiniCharts, { type StaffTrendPoint } from './StaffMiniCharts';
import MonthPicker from './MonthPicker';
import { fmtPeriodLabel } from './period-utils';
import UploadPayslipsButton from './UploadPayslipsButton';
import KpiStrip, { type KpiStripItem } from '@/components/kpi/KpiStrip';
import Page from '@/components/page/Page';
import { OPERATIONS_SUBPAGES } from '../../_subpages';

type Anomaly = { issue: string; staff_id: string; full_name: string; dept_name: string; };

type Row = {
  staff_id: string;
  emp_id: string;
  full_name: string;
  position_title: string;
  dept_code: string;
  dept_name: string;
  employment_type: string;
  monthly_salary: number;
  salary_currency: string | null;
  hourly_cost_lak: number;
  hire_date: string | null;
  last_payroll_period: string | null;
  last_payroll_total_usd: number | null;
  payslip_pdf_status: 'current' | 'overdue' | 'never';
  flag_missing_hire_date: boolean;
  flag_missing_contract: boolean;
  flag_contract_expiring: boolean;
};

// USD per 1 unit — rough static rates. Real rates should come from gl.fx_rates.
const TO_USD: Record<string, number> = {
  USD: 1,
  EUR: 1.08,
  LAK: 1 / 21800,
};
function salaryToUsd(amount: number, ccy: string | null | undefined): number {
  const rate = TO_USD[(ccy ?? 'LAK').toUpperCase()] ?? (1 / 21800);
  return amount * rate;
}

const ISSUE_META: Record<string, { label: string; sub: string }> = {
  missing_hire_date: { label: 'Missing hire date', sub: 'Contract import gap — separate handover.' },
  missing_contract: { label: 'Missing contract PDF', sub: 'Upload signed contract to docs.hr_docs.' },
  contract_expiring: { label: 'Contract expiring', sub: 'End date ≤ 60 days. Renew or release.' },
  no_payslip_pdf_last_closed_month: { label: 'Payslip PDF missing', sub: 'Upload last closed-month payslip.' },
  no_calculated_payroll_last_closed_month: { label: 'Payroll not run', sub: 'ops.payroll_monthly has no row for last month.' },
};

function buildMonthList(actualMonths: string[]): string[] {
  const out: string[] = [];
  const start = new Date(Date.UTC(2025, 0, 1));
  const end = actualMonths[0]
    ? new Date(actualMonths[0] + 'T00:00:00Z')
    : new Date(Date.UTC(2026, 11, 1));
  for (
    let d = new Date(end);
    d.getTime() >= start.getTime();
    d.setUTCMonth(d.getUTCMonth() - 1)
  ) {
    const iso = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-01`;
    out.push(iso);
    if (out.length > 60) break;
  }
  for (const m of actualMonths) if (!out.includes(m)) out.push(m);
  return out.sort((a, b) => b.localeCompare(a));
}

interface Props {
  propertyId: number;
  propertyLabel?: string;
  searchParams: Record<string, string | string[] | undefined>;
}

export default async function StaffPageContent({ propertyId, propertyLabel, searchParams }: Props) {
  // Pull EVERY paid month for this property
  const { data: allMonthly } = await supabase
    .schema('ops')
    .from('v_payroll_dept_monthly')
    .select('*')
    .eq('property_id', propertyId)
    .order('period_month', { ascending: false })
    .limit(1000);

  const monthlyRows = (allMonthly as any[]) ?? [];
  const distinctMonths = [...new Set(monthlyRows.map(r => r.period_month))].sort((a, b) => b.localeCompare(a));
  const availableMonths = buildMonthList(distinctMonths);

  const requested = typeof searchParams?.month === 'string' ? searchParams.month : null;
  const selectedMonth =
    (requested && availableMonths.includes(requested) && requested) ||
    distinctMonths[0] ||
    availableMonths[0];

  const deptRows: DeptRow[] = monthlyRows.filter(r => r.period_month === selectedMonth) as DeptRow[];

  const byMonth = new Map<string, StaffTrendPoint>();
  for (const r of monthlyRows) {
    const cur = byMonth.get(r.period_month) ?? {
      period_month: r.period_month,
      headcount: 0,
      total_grand_usd: 0,
    };
    cur.headcount += Number(r.headcount || 0);
    cur.total_grand_usd += Number(r.total_grand_usd || 0);
    byMonth.set(r.period_month, cur);
  }
  const trendPoints = [...byMonth.values()];

  const [{ data: rows }, { data: anomalies }, archived] = await Promise.all([
    supabase
      .from('v_staff_register_extended')
      .select(
        'staff_id, emp_id, full_name, position_title, dept_code, dept_name, ' +
          'employment_type, monthly_salary, salary_currency, hourly_cost_lak, hire_date, ' +
          'last_payroll_period, last_payroll_total_usd, payslip_pdf_status, ' +
          'flag_missing_hire_date, flag_missing_contract, flag_contract_expiring'
      )
      .eq('property_id', propertyId)
      .eq('is_active', true)
      .order('emp_id'),
    supabase
      .from('v_staff_anomalies')
      .select('issue, staff_id, full_name, dept_name')
      .eq('property_id', propertyId),
    (async (): Promise<ArchivedRow[]> => {
      const { data } = await supabase
        .from('v_staff_register_extended')
        .select('staff_id, emp_id, full_name, position_title, dept_name, hire_date, end_date, monthly_salary, salary_currency, bank_name, bank_account_no, bank_account_name, notes')
        .eq('property_id', propertyId)
        .eq('is_active', false)
        .order('end_date', { ascending: false });
      return (data as unknown as ArchivedRow[]) ?? [];
    })(),
  ]);

  const safeRows: Row[] = (rows as unknown as Row[]) ?? [];
  const safeAnoms: Anomaly[] = (anomalies as unknown as Anomaly[]) ?? [];

  const grouped: Record<string, Anomaly[]> = {};
  for (const a of safeAnoms) (grouped[a.issue] ||= []).push(a);

  const employeesByDept: Record<string, DeptEmployee[]> = {};
  for (const r of safeRows) {
    const k = r.dept_code;
    (employeesByDept[k] ||= []).push({
      staff_id: r.staff_id,
      emp_id: r.emp_id,
      full_name: r.full_name,
      position_title: r.position_title,
      dept_code: r.dept_code,
      employment_type: r.employment_type,
      monthly_salary: Number(r.monthly_salary || 0),
      hire_date: r.hire_date,
    });
  }
  for (const k of Object.keys(employeesByDept)) {
    employeesByDept[k].sort((a, b) => a.emp_id.localeCompare(b.emp_id));
  }

  const selPoint = byMonth.get(selectedMonth);
  const selHc = selPoint?.headcount ?? 0;
  const selCost = selPoint?.total_grand_usd ?? 0;
  const selCph = selHc > 0 ? selCost / selHc : 0;

  const totalActive = safeRows.length;
  // Currency-aware sum: each row converts via its own salary_currency.
  // Namkhan rows are LAK, Donna rows are EUR — same KPI in USD for both.
  const totalMonthlyUSD = safeRows.reduce(
    (s, r) => s + salaryToUsd(Number(r.monthly_salary || 0), r.salary_currency),
    0
  );
  // Dominant currency for display labels
  const ccyCounts: Record<string, number> = {};
  for (const r of safeRows) {
    const c = (r.salary_currency ?? 'LAK').toUpperCase();
    ccyCounts[c] = (ccyCounts[c] ?? 0) + 1;
  }
  const dominantCcy = Object.entries(ccyCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'LAK';
  const totalFlags = safeAnoms.length;

  const eyebrow = propertyLabel
    ? `Operations · Staff · ${propertyLabel} · ${fmtPeriodLabel(selectedMonth)}`
    : `Operations · Staff · ${fmtPeriodLabel(selectedMonth)}`;

  // Empty-state notice — shown when the property simply has no staff data yet
  const noData = totalActive === 0 && archived.length === 0 && deptRows.length === 0;

  return (
    <Page
      eyebrow={eyebrow}
      title={<>Staff <em style={{ color: 'var(--brass)', fontStyle: 'italic' }}>register</em></>}
      subPages={OPERATIONS_SUBPAGES}
      topRight={<UploadPayslipsButton />}
    >
      <KpiStrip items={[
        { label: 'Active', value: totalActive, kind: 'count', hint: 'on register' },
        { label: 'Archived', value: archived.length, kind: 'count', hint: 'departed' },
        { label: 'Headcount paid', value: selHc, kind: 'count', hint: fmtPeriodLabel(selectedMonth) },
        { label: 'Company cost', value: selCost, kind: 'money', tone: 'neutral', hint: fmtPeriodLabel(selectedMonth) },
        { label: 'Cost / head', value: selCph, kind: 'money', hint: 'USD this month' },
        { label: 'Monthly base', value: totalMonthlyUSD, kind: 'money', hint: `register sum · USD (from ${dominantCcy})` },
        { label: 'DQ flags', value: totalFlags, kind: 'count', tone: totalFlags > 0 ? 'warn' : 'pos', hint: 'anomalies' },
      ] satisfies KpiStripItem[]} />

      <div style={{ marginTop: 20 }}>
        <StaffMiniCharts rows={trendPoints} selectedMonth={selectedMonth} />
      </div>

      {noData && (
        <div className="panel dashed" style={{
          marginTop: 20, padding: 20, textAlign: 'center', color: 'var(--ink-mute)',
        }}>
          <div style={{
            fontFamily: 'var(--mono)', fontSize: 'var(--t-xs)',
            letterSpacing: 'var(--ls-extra)', textTransform: 'uppercase',
            color: 'var(--brass)', marginBottom: 6,
          }}>
            No staff data yet for this property
          </div>
          <div style={{ fontSize: 'var(--t-sm)' }}>
            Upload payslips or sync HR data to populate the register.
          </div>
        </div>
      )}

      <section style={{ marginTop: 28 }}>
        <div style={{ marginBottom: 10, display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
          <h2 style={{
            fontFamily: 'var(--mono)',
            fontSize: 'var(--t-xs)',
            letterSpacing: 'var(--ls-extra)',
            textTransform: 'uppercase',
            color: 'var(--brass)',
          }}>
            Anomalies &amp; alerts
          </h2>
          <span style={{ fontFamily: 'var(--serif)', fontSize: 'var(--t-xl)', color: totalFlags > 0 ? 'var(--brass)' : 'var(--good, #2c7a4b)' }}>
            {totalFlags} flag{totalFlags === 1 ? '' : 's'}
          </span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14 }}>
          {Object.entries(ISSUE_META).map(([key, meta]) => (
            <AnomalyCard
              key={key}
              title={meta.label}
              subtitle={meta.sub}
              count={grouped[key]?.length ?? 0}
              people={grouped[key] ?? []}
            />
          ))}
        </div>
      </section>

      <section style={{ marginTop: 28 }}>
        <div style={{ marginBottom: 10, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <h2 style={{
              fontFamily: 'var(--mono)',
              fontSize: 'var(--t-xs)',
              letterSpacing: 'var(--ls-extra)',
              textTransform: 'uppercase',
              color: 'var(--brass)',
            }}>
              Department breakdown
            </h2>
            <MonthPicker months={availableMonths} selected={selectedMonth} />
          </div>
          <span style={{
            fontFamily: 'var(--mono)',
            fontSize: 10,
            letterSpacing: 'var(--ls-extra)',
            textTransform: 'uppercase',
            color: 'var(--ink-mute)',
          }}>
            ops.v_payroll_dept_monthly
          </span>
        </div>
        {deptRows.length === 0 ? (
          <div className="panel dashed" style={{ padding: 16, color: 'var(--ink-mute)', fontStyle: 'italic', textAlign: 'center' }}>
            No payroll rows for {fmtPeriodLabel(selectedMonth)}.
          </div>
        ) : (
          <DeptBreakdown
            rows={deptRows}
            fx={FX_LAK_PER_USD}
            employeesByDept={employeesByDept}
          />
        )}
      </section>

      <details open style={{ marginTop: 28 }}>
        <summary style={{
          cursor: 'pointer',
          padding: '8px 0',
          fontFamily: 'var(--mono)',
          fontSize: 'var(--t-xs)',
          letterSpacing: 'var(--ls-extra)',
          textTransform: 'uppercase',
          color: 'var(--brass)',
        }}>
          Staff register · {totalActive} active ▾ <span style={{ textTransform: 'none', letterSpacing: 'normal', color: 'var(--ink-mute)' }}>click row to drill down · ${Math.round(totalMonthlyUSD).toLocaleString()} monthly base (USD from {dominantCcy})</span>
        </summary>
        <div style={{ marginTop: 10 }}>
          <StaffShell rows={safeRows} />
        </div>
      </details>

      <details style={{ marginTop: 16 }}>
        <summary style={{
          cursor: 'pointer',
          padding: '8px 0',
          fontFamily: 'var(--mono)',
          fontSize: 'var(--t-xs)',
          letterSpacing: 'var(--ls-extra)',
          textTransform: 'uppercase',
          color: 'var(--brass)',
        }}>
          Archived staff · {archived.length} ▾ <span style={{ textTransform: 'none', letterSpacing: 'normal', color: 'var(--ink-mute)' }}>departed · payroll history retained</span>
        </summary>
        <div style={{ marginTop: 10 }}>
          <ArchivedStaffTable rows={archived} />
        </div>
      </details>
    </Page>
  );
}
