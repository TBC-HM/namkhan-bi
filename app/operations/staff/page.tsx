// app/operations/staff/page.tsx
// PBS 2026-05-13 — canonical rebuild:
//   1. KPI strip at the top (canonical KpiStrip with brass frame)
//   2. FilterStrip-style month picker on the Department breakdown header
//   3. 3 mini line charts side-by-side (headcount · cost · cost/head)
//   4. Anomalies & alerts cards
//   5. Collapsible Staff register + Archived staff (<details>/<summary>)
//
// Source views:
//   public.v_staff_register_extended — register
//   public.v_staff_anomalies         — DQ
//   ops.v_payroll_dept_monthly       — dept breakdown + trend
// FX from gl.fx_rates fallback to env constant.

import { supabase } from '@/lib/supabase';
import { fmtMoney, FX_LAK_PER_USD } from '@/lib/format';
import { AnomalyCard } from './_components/AnomalyCard';
import { StaffShell } from './_components/StaffShell';
import { ArchivedStaffTable, type ArchivedRow } from './_components/ArchivedStaffTable';
import DeptBreakdown, { type DeptRow } from './_components/DeptBreakdown';
import StaffMiniCharts, { type StaffTrendPoint } from './_components/StaffMiniCharts';
import MonthPicker, { fmtPeriodLabel } from './_components/MonthPicker';
import UploadPayslipsButton from './_components/UploadPayslipsButton';
import KpiStrip, { type KpiStripItem } from '@/components/kpi/KpiStrip';
import Page from '@/components/page/Page';
import { OPERATIONS_SUBPAGES } from '../_subpages';

export const revalidate = 60;
export const dynamic = 'force-dynamic';

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
  hourly_cost_lak: number;
  hire_date: string | null;
  last_payroll_period: string | null;
  last_payroll_total_usd: number | null;
  payslip_pdf_status: 'current' | 'overdue' | 'never';
  flag_missing_hire_date: boolean;
  flag_missing_contract: boolean;
  flag_contract_expiring: boolean;
};

const ISSUE_META: Record<string, { label: string; sub: string }> = {
  missing_hire_date: { label: 'Missing hire date', sub: 'Contract import gap — separate handover.' },
  missing_contract: { label: 'Missing contract PDF', sub: 'Upload signed contract to docs.hr_docs.' },
  contract_expiring: { label: 'Contract expiring', sub: 'End date ≤ 60 days. Renew or release.' },
  no_payslip_pdf_last_closed_month: { label: 'Payslip PDF missing', sub: 'Upload last closed-month payslip.' },
  no_calculated_payroll_last_closed_month: { label: 'Payroll not run', sub: 'ops.payroll_monthly has no row for last month.' },
};

/** Build available months Jan 2025 → latest paid month present in the data. */
function buildMonthList(actualMonths: string[]): string[] {
  // Available months sorted desc. Always include Jan 2025 floor.
  const have = new Set(actualMonths);
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
  // Always include months we actually have, even if outside the inferred window
  for (const m of actualMonths) if (!out.includes(m)) out.push(m);
  return out.sort((a, b) => b.localeCompare(a));
}

interface Props {
  searchParams: Record<string, string | string[] | undefined>;
}

export default async function StaffPage({ searchParams }: Props) {
  // Pull EVERY paid month so we can build the dropdown + trend in one query
  const { data: allMonthly } = await supabase
    .schema('ops')
    .from('v_payroll_dept_monthly')
    .select('*')
    .order('period_month', { ascending: false })
    .limit(1000);

  const monthlyRows = (allMonthly as any[]) ?? [];
  const distinctMonths = [...new Set(monthlyRows.map(r => r.period_month))].sort((a, b) => b.localeCompare(a));
  const availableMonths = buildMonthList(distinctMonths);

  // Resolve selected month: ?month=YYYY-MM-01 → query → latest in data → fallback
  const requested = typeof searchParams?.month === 'string' ? searchParams.month : null;
  const selectedMonth =
    (requested && availableMonths.includes(requested) && requested) ||
    distinctMonths[0] ||
    availableMonths[0];

  // Slice dept breakdown to selected month
  const deptRows: DeptRow[] = monthlyRows.filter(r => r.period_month === selectedMonth) as DeptRow[];

  // Build trend points (one row per month, summed across depts)
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

  // Pull register, anomalies, archived in parallel
  const [{ data: rows }, { data: anomalies }, archived] = await Promise.all([
    supabase
      .from('v_staff_register_extended')
      .select(
        'staff_id, emp_id, full_name, position_title, dept_code, dept_name, ' +
          'employment_type, monthly_salary, hourly_cost_lak, hire_date, ' +
          'last_payroll_period, last_payroll_total_usd, payslip_pdf_status, ' +
          'flag_missing_hire_date, flag_missing_contract, flag_contract_expiring'
      )
      .eq('is_active', true)
      .order('emp_id'),
    supabase.from('v_staff_anomalies').select('issue, staff_id, full_name, dept_name'),
    (async (): Promise<ArchivedRow[]> => {
      const { data } = await supabase
        .from('v_staff_register_extended')
        .select('staff_id, emp_id, full_name, position_title, dept_name, hire_date, end_date, monthly_salary, bank_name, bank_account_no, bank_account_name, notes')
        .eq('is_active', false)
        .order('end_date', { ascending: false });
      return (data as unknown as ArchivedRow[]) ?? [];
    })(),
  ]);

  const safeRows: Row[] = (rows as unknown as Row[]) ?? [];
  const safeAnoms: Anomaly[] = (anomalies as unknown as Anomaly[]) ?? [];

  const grouped: Record<string, Anomaly[]> = {};
  for (const a of safeAnoms) (grouped[a.issue] ||= []).push(a);

  // KPI numbers for selected month
  const selPoint = byMonth.get(selectedMonth);
  const selHc = selPoint?.headcount ?? 0;
  const selCost = selPoint?.total_grand_usd ?? 0;
  const selCph = selHc > 0 ? selCost / selHc : 0;

  const totalActive = safeRows.length;
  const totalMonthlyLAK = safeRows.reduce((s, r) => s + Number(r.monthly_salary || 0), 0);
  const totalFlags = safeAnoms.length;

  return (
    <Page
      eyebrow={`Operations · Staff · ${fmtPeriodLabel(selectedMonth)}`}
      title={<>Staff <em style={{ color: 'var(--brass)', fontStyle: 'italic' }}>register</em></>}
      subPages={OPERATIONS_SUBPAGES}
      topRight={<UploadPayslipsButton />}
    >
      {/* ============================================================
          1. CANONICAL KPI STRIP — top of the page
          ============================================================ */}
      <KpiStrip items={[
        { label: 'Active', value: totalActive, kind: 'count', hint: 'on register' },
        { label: 'Archived', value: archived.length, kind: 'count', hint: 'departed' },
        { label: 'Headcount paid', value: selHc, kind: 'count', hint: fmtPeriodLabel(selectedMonth) },
        { label: 'Company cost', value: selCost, kind: 'money', tone: 'neutral', hint: fmtPeriodLabel(selectedMonth) },
        { label: 'Cost / head', value: selCph, kind: 'money', hint: 'USD this month' },
        { label: 'Monthly base', value: totalMonthlyLAK / FX_LAK_PER_USD, kind: 'money', hint: 'register sum · USD' },
        { label: 'DQ flags', value: totalFlags, kind: 'count', tone: totalFlags > 0 ? 'warn' : 'pos', hint: 'anomalies' },
      ] satisfies KpiStripItem[]} />

      {/* ============================================================
          2. 3 MINI CHARTS — under KPIs, above tables (canonical)
          ============================================================ */}
      <div style={{ marginTop: 20 }}>
        <StaffMiniCharts rows={trendPoints} selectedMonth={selectedMonth} />
      </div>

      {/* ============================================================
          3. ANOMALIES & ALERTS
          ============================================================ */}
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

      {/* ============================================================
          4. DEPARTMENT BREAKDOWN with month dropdown
          ============================================================ */}
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
          <DeptBreakdown rows={deptRows} fx={FX_LAK_PER_USD} />
        )}
      </section>

      {/* ============================================================
          5. STAFF REGISTER — collapsible
          ============================================================ */}
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
          Staff register · {totalActive} active ▾ <span style={{ textTransform: 'none', letterSpacing: 'normal', color: 'var(--ink-mute)' }}>click row to drill down · {fmtMoney(totalMonthlyLAK, 'LAK')} monthly base</span>
        </summary>
        <div style={{ marginTop: 10 }}>
          <StaffShell rows={safeRows} />
        </div>
      </details>

      {/* ============================================================
          6. ARCHIVED STAFF — collapsible, default closed
          ============================================================ */}
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
