// app/operations/staff/_components/StaffPageContent.tsx
// PBS 2026-05-13 — single canonical staff page shared by:
//   - /operations/staff           (Namkhan, default property)
//   - /h/[property_id]/operations/staff (any property, scoped via prop)
//
// All view queries filter by propertyId. Views were extended to expose
// property_id in migration `staff_views_expose_property_id`.

import { supabase } from '@/lib/supabase';
import { FX_LAK_PER_USD } from '@/lib/format';
import { InsightCard } from './InsightCard';
import { StaffShell } from './StaffShell';
import { ArchivedStaffTable, type ArchivedRow } from './ArchivedStaffTable';
import DeptBreakdown, { type DeptRow, type DeptEmployee } from './DeptBreakdown';
import StaffMiniCharts, { type StaffTrendPoint } from './StaffMiniCharts';
import MonthPicker from './MonthPicker';
import DeptPicker from './DeptPicker';
import { fmtPeriodLabel } from './period-utils';
import StaffTabStrip from './StaffTabStrip';
import UploadPayslipsButton from './UploadPayslipsButton';
// PBS 2026-06-08 #133: legacy KpiStrip swapped for canonical KpiTile grid (B&W primitives)
import { DashboardPage, Container, KpiTile, type KpiTileProps } from '@/app/(cockpit)/_design';
import { OPERATIONS_SUBPAGES } from '../../_subpages';
import { rewriteSubPagesForProperty } from '@/lib/dept-cfg/rewrite-subpages';

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
  last_payroll_cost_lak: number | null;
  last_payroll_net_lak: number | null;
  payslip_pdf_status: 'current' | 'overdue' | 'never';
  flag_missing_hire_date: boolean;
  flag_missing_contract: boolean;
  flag_contract_expiring: boolean;
  // PBS 2026-05-13 — Factorial-derived status columns (Donna)
  work_status: string | null;
  contract_pattern: string | null;
  months_worked_2025: number | null;
  last_clock_date: string | null;
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
function usdToCcy(usd: number, ccy: string): number {
  const rate = TO_USD[ccy.toUpperCase()] ?? 1;
  return rate > 0 ? usd / rate : 0;
}
function fmtCcyShort(amount: number, ccy: string): string {
  const abs = Math.abs(amount);
  const sign = amount < 0 ? '−' : '';
  const sym = ccy === 'EUR' ? '€' : ccy === 'LAK' ? '₭' : '$';
  if (ccy === 'LAK') {
    if (abs >= 1_000_000_000) return `${sign}${sym}${(abs / 1_000_000_000).toFixed(1)}B`;
    if (abs >= 1_000_000) return `${sign}${sym}${(abs / 1_000_000).toFixed(1)}M`;
    if (abs >= 1_000) return `${sign}${sym}${Math.round(abs / 1_000)}k`;
    return `${sign}${sym}${Math.round(abs)}`;
  }
  if (abs >= 1_000_000) return `${sign}${sym}${(abs / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `${sign}${sym}${(abs / 1_000).toFixed(1)}k`;
  return `${sign}${sym}${Math.round(abs).toLocaleString('en-US')}`;
}

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
  /** PBS 2026-05-15: override the top-line sub-pages strip — used by the
   *  Finance · HR route (/finance/hr) so the Finance sub-pages stay visible
   *  while the body still renders the canonical staff content. */
  subPagesOverride?: { label: string; href: string }[];
}

export default async function StaffPageContent({ propertyId, propertyLabel, searchParams, subPagesOverride }: Props) {
  // Pull EVERY paid month for this property
  const { data: allMonthly } = await supabase
    .schema('ops')
    .from('v_payroll_dept_monthly')
    .select('*')
    .eq('property_id', propertyId)
    .order('period_month', { ascending: false })
    .limit(1000);

  const monthlyRows = (allMonthly as any[]) ?? [];
  let distinctMonths = [...new Set(monthlyRows.map(r => r.period_month))].sort((a, b) => b.localeCompare(a));
  const hasRealPayroll = distinctMonths.length > 0;
  // For properties without ops.payroll_monthly data (Donna today), the
  // dropdown still spans Jan 2025 → current month so the page is usable.
  if (!hasRealPayroll) {
    const today = new Date();
    today.setUTCDate(1);
    distinctMonths = [];
    for (let i = 0; i < 18; i++) {
      const d = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() - i, 1));
      const iso = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-01`;
      if (iso >= '2025-01-01') distinctMonths.push(iso);
    }
  }
  const availableMonths = buildMonthList(distinctMonths);

  const requested = typeof searchParams?.month === 'string' ? searchParams.month : null;
  const selectedMonth =
    (requested && availableMonths.includes(requested) && requested) ||
    distinctMonths[0] ||
    availableMonths[0];

  // PBS 2026-05-13: dept filter for the 3 trend charts. ?dept=CODE (or 'all').
  const requestedDept = typeof searchParams?.dept === 'string' ? searchParams.dept : null;
  const selectedDept = requestedDept ?? 'all';

  let deptRows: DeptRow[] = monthlyRows.filter(r => r.period_month === selectedMonth) as DeptRow[];

  // Trend computation honors selectedDept — narrow monthlyRows when dept != 'all'.
  const trendSource = selectedDept === 'all'
    ? monthlyRows
    : monthlyRows.filter((r) => r.dept_code === selectedDept);
  const byMonth = new Map<string, StaffTrendPoint>();
  for (const r of trendSource) {
    const cur = byMonth.get(r.period_month) ?? {
      period_month: r.period_month,
      headcount: 0,
      total_grand_usd: 0,
    };
    cur.headcount += Number(r.headcount || 0);
    cur.total_grand_usd += Number(r.total_grand_usd || 0);
    byMonth.set(r.period_month, cur);
  }
  let trendPoints = [...byMonth.values()];

  const [{ data: rows }, { data: anomalies }, archived, { data: insightsJson }] = await Promise.all([
    supabase
      .schema('public')
      .from('v_staff_register_extended')
      .select(
        'staff_id, emp_id, full_name, position_title, dept_code, dept_name, ' +
          'employment_type, monthly_salary, salary_currency, hourly_cost_lak, hire_date, ' +
          'last_payroll_period, last_payroll_total_usd, last_payroll_cost_lak, last_payroll_net_lak, payslip_pdf_status, ' +
          'flag_missing_hire_date, flag_missing_contract, flag_contract_expiring, ' +
          // PBS 2026-05-13: Factorial-derived status columns
          'work_status, contract_pattern, months_worked_2025, last_clock_date'
      )
      .eq('property_id', propertyId)
      .eq('is_active', true)
      .order('emp_id'),
    supabase
      .from('v_staff_anomalies')
      .select('issue, staff_id, full_name, dept_name')
      .eq('property_id', propertyId),
    (async (): Promise<(ArchivedRow & { dept_code?: string | null; monthly_salary: number; hire_date: string | null; end_date: string | null })[]> => {
      const { data } = await supabase
        .from('v_staff_register_extended')
        .select('staff_id, emp_id, full_name, position_title, dept_code, dept_name, hire_date, end_date, monthly_salary, salary_currency, bank_name, bank_account_no, bank_account_name, notes')
        .eq('property_id', propertyId)
        .eq('is_active', false)
        .order('end_date', { ascending: false });
      return (data as any[]) ?? [];
    })(),
    supabase.schema('ops').rpc('fn_staff_insights', { p_property_id: propertyId }),
  ]);

  const safeRows: Row[] = (rows as unknown as Row[]) ?? [];
  const safeAnoms: Anomaly[] = (anomalies as unknown as Anomaly[]) ?? [];

  // ============================================================
  // SYNTHETIC TREND + DEPT BREAKDOWN
  // When ops.payroll_monthly has no rows for this property (Donna today),
  // derive monthly headcount + cost from staff_employment.hire_date / end_date
  // and constant monthly_salary. Same KPIs/charts populate immediately.
  // Real payroll data, when it lands, overrides via the !hasRealPayroll guard.
  // ============================================================
  if (!hasRealPayroll) {
    type AllRow = {
      hire_date: string | null;
      end_date: string | null;
      monthly_salary: number;
      salary_currency: string | null;
      dept_code: string | null;
      dept_name: string | null;
    };
    const rawRows: AllRow[] = [
      ...(safeRows as any[]).map((r) => ({
        hire_date: r.hire_date, end_date: null, // active = no end
        monthly_salary: Number(r.monthly_salary || 0),
        salary_currency: r.salary_currency ?? null,
        dept_code: r.dept_code ?? null,
        dept_name: r.dept_name ?? null,
      })),
      ...(archived as any[]).map((r) => ({
        hire_date: r.hire_date, end_date: r.end_date,
        monthly_salary: Number(r.monthly_salary || 0),
        salary_currency: r.salary_currency ?? null,
        dept_code: r.dept_code ?? null,
        dept_name: r.dept_name ?? null,
      })),
    ];

    // Fill missing salaries with the dept-average so 100% of the register
    // contributes to the trend. Without this, ~60% of Donna rows would
    // contribute €0 and the line would understate cost dramatically.
    const deptSalarySum: Record<string, number> = {};
    const deptSalaryN:   Record<string, number> = {};
    for (const r of rawRows) {
      if (r.monthly_salary > 0 && r.dept_code) {
        deptSalarySum[r.dept_code] = (deptSalarySum[r.dept_code] ?? 0) + r.monthly_salary;
        deptSalaryN[r.dept_code]   = (deptSalaryN[r.dept_code] ?? 0) + 1;
      }
    }
    const globalAvg = (() => {
      const filled = rawRows.filter((r) => r.monthly_salary > 0);
      if (filled.length === 0) return 0;
      return filled.reduce((s, r) => s + r.monthly_salary, 0) / filled.length;
    })();
    const dominantSalaryCcy = rawRows.find((r) => r.monthly_salary > 0)?.salary_currency ?? 'LAK';

    const allRows: AllRow[] = rawRows.map((r) => {
      if (r.monthly_salary > 0) return r;
      const deptAvg = r.dept_code && deptSalaryN[r.dept_code]
        ? deptSalarySum[r.dept_code] / deptSalaryN[r.dept_code]
        : globalAvg;
      return {
        ...r,
        monthly_salary: deptAvg,
        // Use dominant currency if row has none — Factorial doesn't always set it.
        salary_currency: r.salary_currency ?? dominantSalaryCcy,
      };
    });

    // Active-on-month-end predicate
    const activeAt = (r: AllRow, monthIso: string) => {
      // Last day of month (approx — using 28+ heuristic): use first of next month minus 1ms
      const [y, m] = monthIso.split('-').map(Number);
      const eom = new Date(Date.UTC(y, m, 0)); // last day of month
      const eomStr = `${eom.getUTCFullYear()}-${String(eom.getUTCMonth() + 1).padStart(2, '0')}-${String(eom.getUTCDate()).padStart(2, '0')}`;
      if (!r.hire_date) return false;
      if (r.hire_date > eomStr) return false;
      if (r.end_date && r.end_date < monthIso) return false;
      return true;
    };

    // Trend: one synthetic point per month in availableMonths.
    // selectedDept (from URL) optionally narrows to a single department.
    const trendRows = selectedDept === 'all'
      ? allRows
      : allRows.filter((r) => r.dept_code === selectedDept);
    trendPoints = availableMonths.map((monthIso) => {
      const activeRows = trendRows.filter((r) => activeAt(r, monthIso));
      const costUsd = activeRows.reduce(
        (s, r) => s + salaryToUsd(r.monthly_salary, r.salary_currency),
        0
      );
      return {
        period_month: monthIso,
        headcount: activeRows.length,
        total_grand_usd: costUsd,
      };
    });

    // Dept breakdown for selected month — group by dept_code from current state
    const byDept = new Map<string, { dept_code: string; dept_name: string; headcount: number; total_lak: number }>();
    for (const r of allRows.filter((r) => activeAt(r, selectedMonth))) {
      const code = r.dept_code ?? '—';
      const name = r.dept_name ?? 'Unassigned';
      const cur = byDept.get(code) ?? { dept_code: code, dept_name: name, headcount: 0, total_lak: 0 };
      cur.headcount += 1;
      // For DeptBreakdown UI, total_base_lak stores native amount; UsdLak still applies LAK->USD,
      // but for Donna's EUR rows the displayed USD reads through salaryToUsd. We feed the
      // already-converted USD into total_canonical_cost_usd so the grand-cost column is correct.
      cur.total_lak += r.monthly_salary; // native amount (EUR for Donna, LAK for Namkhan)
      byDept.set(code, cur);
    }
    // Re-populate byMonth from synthetic trend so KPI tiles read synthetic values
    byMonth.clear();
    for (const p of trendPoints) byMonth.set(p.period_month, p);

    deptRows = [...byDept.values()].map((d) => {
      // Convert the dominant currency sum into USD for the grand-cost column.
      // Use the property's native currency (taken from any row).
      const ccy = (allRows[0]?.salary_currency ?? 'LAK') as string;
      const costUsd = salaryToUsd(d.total_lak, ccy);
      return {
        dept_code: d.dept_code,
        dept_name: d.dept_name,
        headcount: d.headcount,
        total_base_lak: d.total_lak,
        total_overtime_lak: null,
        total_sc_lak: null,
        total_allow_lak: null,
        total_sso_lak: null,
        total_tax_lak: null,
        total_net_lak: d.total_lak,
        total_grand_usd: costUsd,
        total_canonical_net_lak: d.total_lak,
        total_canonical_net_usd: costUsd,
        total_canonical_cost_lak: d.total_lak,
        total_canonical_cost_usd: costUsd,
        total_benefits_lak: null,
      } satisfies DeptRow;
    });
  }

  // 2026-05-14 — 5-box insight payload from ops.fn_staff_insights().
  // Replaces the prior 5 redundant "missing X" cards with 5 distinct dimensions:
  // master-data completeness, contract pipeline, attendance, time-off, payroll readiness.
  type InsightBox = {
    title: string;
    subtitle: string;
    score_pct?: number | null;
    stats: Array<{ label: string; value: string | number; accent?: 'ok' | 'amber' | 'red' | 'muted' }>;
    people: Array<{ staff_id: string; full_name: string; dept_name: string; meta?: string | null }>;
  };
  const insightBoxes: InsightBox[] = (insightsJson as { boxes?: InsightBox[] } | null)?.boxes ?? [];

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

  // PBS 2026-05-14 — Company-cost KPI always shows the most recent 2 months
  // (regardless of selectedMonth) + a MoM % delta. Replaces the prior
  // "selected-month cost" KPI which was redundant with selCost on the trend
  // chart's reference dot.
  const sortedMonthIsos = [...byMonth.keys()].sort((a, b) => a.localeCompare(b));
  const mCurrIso = sortedMonthIsos[sortedMonthIsos.length - 1] ?? null;
  const mPrevIso = sortedMonthIsos[sortedMonthIsos.length - 2] ?? null;
  const costCurrUsd = mCurrIso ? (byMonth.get(mCurrIso)?.total_grand_usd ?? 0) : 0;
  const costPrevUsd = mPrevIso ? (byMonth.get(mPrevIso)?.total_grand_usd ?? 0) : 0;
  const momPct = costPrevUsd > 0 ? ((costCurrUsd - costPrevUsd) / costPrevUsd) * 100 : null;
  const shortMonth = (iso: string | null): string => {
    if (!iso) return '—';
    const [, m] = iso.split('-');
    return ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][Number(m) - 1] ?? iso;
  };

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

  // PBS 2026-05-13: workforce-mix counts from Factorial contract_pattern.
  // Only populated for Donna today; Namkhan rows have null → tiles read 0/0.
  const cnt12mo = safeRows.filter((r) => r.contract_pattern === '12mo_year_round').length;
  const cntSeasonal = safeRows.filter((r) =>
    r.contract_pattern === '9mo_fijo_discontinuo'
    || r.contract_pattern === 'seasonal_5_7mo'
    || r.contract_pattern === 'short_1_4mo'
  ).length;
  const hasContractPattern = safeRows.some((r) => r.contract_pattern != null);

  // Dept options for the chart filter — union of every dept seen across
  // monthlyRows (Namkhan real payroll) and the current register (both props).
  const deptSeen = new Map<string, { code: string; name: string; hc: number }>();
  for (const r of monthlyRows) {
    if (r.dept_code && !deptSeen.has(r.dept_code)) {
      deptSeen.set(r.dept_code, { code: r.dept_code, name: r.dept_name ?? r.dept_code, hc: 0 });
    }
  }
  for (const r of safeRows) {
    if (r.dept_code) {
      const cur = deptSeen.get(r.dept_code) ?? { code: r.dept_code, name: r.dept_name ?? r.dept_code, hc: 0 };
      cur.hc += 1;
      deptSeen.set(r.dept_code, cur);
    }
  }
  const deptOptions = [...deptSeen.values()].sort((a, b) => b.hc - a.hc || a.name.localeCompare(b.name));
  const selectedDeptName = selectedDept === 'all'
    ? 'All departments'
    : (deptSeen.get(selectedDept)?.name ?? selectedDept);

  const eyebrow = propertyLabel
    ? `Operations · Staff · ${propertyLabel} · ${fmtPeriodLabel(selectedMonth)}`
    : `Operations · Staff · ${fmtPeriodLabel(selectedMonth)}`;

  // Empty-state notice — shown when the property simply has no staff data yet
  const noData = totalActive === 0 && archived.length === 0 && deptRows.length === 0;

  return (
    <DashboardPage
      title={`Staff register · ${propertyLabel ?? 'Property'}`}
      subtitle={eyebrow}
      tabs={(subPagesOverride ?? rewriteSubPagesForProperty(OPERATIONS_SUBPAGES, propertyId)).map(s => ({ key: s.href, label: s.label, href: s.href, active: s.label === 'HR' || s.href.endsWith('/finance/hr') || s.href.endsWith('/operations/staff') }))}
      action={<UploadPayslipsButton />}
    >
      <div style={{ gridColumn: '1 / -1', display: 'flex', flexDirection: 'column', gap: 18 }}>
      <StaffTabStrip propertyId={propertyId} />
      {/* PBS #133: KPI strip → B&W KpiTile grid in a Container */}
      <Container title="Workforce headline" subtitle={`${fmtPeriodLabel(selectedMonth)} · live from public.v_staff_register_extended`} density="compact">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 10 }}>
          {([
            { label: 'Active',          value: totalActive,      footnote: 'on register',
              status: totalActive > 0 ? 'green' : 'grey' },
            { label: 'Archived',        value: archived.length,  footnote: 'departed',
              status: 'grey' },
            { label: 'Headcount paid',  value: selHc,            footnote: fmtPeriodLabel(selectedMonth),
              status: selHc > 0 ? 'green' : 'grey' },
            ...(hasContractPattern ? [
              { label: '12-month workforce',  value: cnt12mo,     footnote: 'year-round (≥11 mo · 2025)', status: 'green' as const },
              { label: '9-month / seasonal',  value: cntSeasonal, footnote: 'fijo discontinuo + seasonal', status: 'grey' as const },
            ] : []),
            {
              label: `Company cost · ${shortMonth(mPrevIso)} / ${shortMonth(mCurrIso)}`,
              value: mCurrIso
                ? `${fmtCcyShort(usdToCcy(costPrevUsd, dominantCcy), dominantCcy)} → ${fmtCcyShort(usdToCcy(costCurrUsd, dominantCcy), dominantCcy)}`
                : '—',
              footnote: momPct == null ? 'no prior month' : `${momPct >= 0 ? '+' : '−'}${Math.abs(momPct).toFixed(1)}% MoM`,
              status: (momPct == null ? 'grey' : (momPct > 0.5 ? 'amber' : momPct < -0.5 ? 'green' : 'grey')) as 'grey' | 'amber' | 'green',
            },
            { label: 'Cost / head',  value: fmtCcyShort(usdToCcy(selCph, dominantCcy), dominantCcy),         footnote: `${dominantCcy} this month`,           status: 'grey' as const },
            { label: 'Monthly base', value: fmtCcyShort(usdToCcy(totalMonthlyUSD, dominantCcy), dominantCcy), footnote: `register sum · ${dominantCcy}`,       status: 'grey' as const },
            { label: 'DQ flags',     value: totalFlags,                                                       footnote: 'anomalies',                            status: totalFlags > 0 ? 'amber' : 'green' },
          ] satisfies KpiTileProps[]).map((t, i) => <KpiTile key={i} size="sm" {...t} />)}
        </div>
      </Container>

      <Container title={`Trend · ${selectedDeptName}`} subtitle="monthly headcount + payroll cost · live from ops.v_payroll_dept_monthly" action={<DeptPicker options={deptOptions} selected={selectedDept} />}>
        <StaffMiniCharts rows={trendPoints} selectedMonth={selectedMonth} nativeCurrency={dominantCcy} />
      </Container>

      {noData && (
        <Container title="No staff data yet" subtitle="upload payslips or sync HR data to populate the register">
          <div style={{ padding: '20px 4px', fontSize: 13, color: '#5A5A5A', textAlign: 'center' }}>
            This property has no register, no archived records, and no department rollup yet.
          </div>
        </Container>
      )}

      <Container title="Workforce insights" subtitle="live from ops.fn_staff_insights">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 14 }}>
          {insightBoxes.slice(0, 4).map((b, i) => (
            <InsightCard
              key={i}
              title={b.title}
              subtitle={b.subtitle}
              stats={b.stats ?? []}
              people={b.people ?? []}
              scorePct={typeof b.score_pct === 'number' ? b.score_pct : null}
            />
          ))}
        </div>
      </Container>

      <Container title="Department breakdown" subtitle="live from ops.v_payroll_dept_monthly" action={<MonthPicker months={availableMonths} selected={selectedMonth} />}>
        {deptRows.length === 0 ? (
          <div style={{ padding: 16, color: '#5A5A5A', fontStyle: 'italic', textAlign: 'center', fontSize: 13 }}>
            No payroll rows for {fmtPeriodLabel(selectedMonth)}.
          </div>
        ) : (
          <DeptBreakdown
            rows={deptRows}
            fx={FX_LAK_PER_USD}
            nativeCurrency={dominantCcy}
            employeesByDept={employeesByDept}
          />
        )}
      </Container>

      <Container
        title={`Staff register · ${totalActive} active`}
        subtitle={`click row to drill down · ${fmtCcyShort(usdToCcy(totalMonthlyUSD, dominantCcy), dominantCcy)} monthly base · live from public.v_staff_register_extended`}
      >
        <StaffShell rows={safeRows} />
      </Container>

      <details style={{ marginTop: 8 }}>
        <summary style={{
          cursor: 'pointer',
          padding: '10px 14px',
          fontSize: 12,
          fontWeight: 600,
          color: '#000',
          background: '#FFFFFF',
          border: '1px solid #E0E0E0',
          borderRadius: 6,
          letterSpacing: '0.04em',
        }}>
          Archived staff · {archived.length} <span style={{ fontWeight: 400, color: '#5A5A5A', marginLeft: 6 }}>departed · payroll history retained</span>
        </summary>
        <div style={{ marginTop: 10 }}>
          <ArchivedStaffTable rows={archived} />
        </div>
      </details>
      </div>
    </DashboardPage>
  );
}
