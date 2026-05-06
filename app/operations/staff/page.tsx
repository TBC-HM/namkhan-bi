// app/operations/staff/page.tsx
// Re-restored 2026-05-05 — full staff cockpit:
//   1. Header KPI strip (active · archived · last payroll · monthly LAK)
//   2. Anomalies & alerts (5 cards)
//   3. Dept breakdown (last paid month) — DeptBreakdown
//   4. 4-month payroll trend — PayrollTrend
//   5. Active staff register — StaffTable (click row → drilldown)
//   6. Archived staff — ArchivedStaffTable
//
// Source views:
//   public.v_staff_register_extended — register
//   public.v_staff_anomalies         — DQ
//   ops.v_payroll_dept_monthly       — dept breakdown
// FX from gl.fx_rates fallback to env constant.

import { supabase } from '@/lib/supabase';
import { fmtMoney, FX_LAK_PER_USD } from '@/lib/format';
import { AnomalyCard } from './_components/AnomalyCard';
import { StaffTable } from './_components/StaffTable';
import { ArchivedStaffTable, type ArchivedRow } from './_components/ArchivedStaffTable';
import DeptBreakdown, { type DeptRow } from './_components/DeptBreakdown';
import PayrollTrend, { type PayrollTrendRow } from './_components/PayrollTrend';
import UploadPayslipsButton from './_components/UploadPayslipsButton';

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

async function getDeptBreakdown(): Promise<DeptRow[]> {
  const { data } = await supabase
    .schema('ops')
    .from('v_payroll_dept_monthly')
    .select('*')
    .order('period_month', { ascending: false })
    .limit(60);
  if (!data || data.length === 0) return [];
  const latest = (data[0] as any).period_month;
  return (data as any[]).filter(r => r.period_month === latest) as DeptRow[];
}

async function getPayrollTrend(): Promise<{ rows: PayrollTrendRow[]; window: string[] }> {
  const { data } = await supabase
    .schema('ops')
    .from('v_payroll_dept_monthly')
    .select('period_month, headcount, total_grand_usd, total_net_lak, total_sc_lak, total_allow_lak')
    .order('period_month', { ascending: false })
    .limit(200);
  // Group by period_month, sum across depts
  const byMonth = new Map<string, PayrollTrendRow>();
  for (const r of (data ?? []) as any[]) {
    const k = r.period_month;
    const cur = byMonth.get(k) ?? { period_month: k, headcount: 0, total_grand_usd: 0, total_net_lak: 0, total_sc_lak: 0, total_allow_lak: 0 };
    cur.headcount += Number(r.headcount || 0);
    cur.total_grand_usd += Number(r.total_grand_usd || 0);
    cur.total_net_lak += Number(r.total_net_lak || 0);
    cur.total_sc_lak += Number(r.total_sc_lak || 0);
    cur.total_allow_lak += Number(r.total_allow_lak || 0);
    byMonth.set(k, cur);
  }
  const rows = [...byMonth.values()].sort((a, b) => b.period_month.localeCompare(a.period_month));
  // Build a 4-month rolling window ending at the latest paid month
  const latest = rows[0]?.period_month;
  const win: string[] = [];
  if (latest) {
    const [y, m] = latest.split('-').map(Number);
    for (let i = 3; i >= 0; i--) {
      const d = new Date(Date.UTC(y, m - 1 - i, 1));
      win.push(`${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-01`);
    }
  }
  return { rows, window: win };
}

async function getArchivedStaff(): Promise<ArchivedRow[]> {
  const { data } = await supabase
    .from('v_staff_register_extended')
    .select('staff_id, emp_id, full_name, position_title, dept_name, hire_date, end_date, monthly_salary, bank_name, bank_account_no, bank_account_name, notes')
    .eq('is_active', false)
    .order('end_date', { ascending: false });
  return (data as unknown as ArchivedRow[]) ?? [];
}

export default async function StaffPage() {
  const [{ data: rows }, { data: anomalies }, deptRows, trend, archived] = await Promise.all([
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
    getDeptBreakdown(),
    getPayrollTrend(),
    getArchivedStaff(),
  ]);

  const safeRows: Row[] = (rows as unknown as Row[]) ?? [];
  const safeAnoms: Anomaly[] = (anomalies as unknown as Anomaly[]) ?? [];

  const grouped: Record<string, Anomaly[]> = {};
  for (const a of safeAnoms) (grouped[a.issue] ||= []).push(a);

  const totalFlags = safeAnoms.length;
  const totalActive = safeRows.length;
  const totalMonthlyLAK = safeRows.reduce((s, r) => s + Number(r.monthly_salary || 0), 0);
  const lastPaidUsd = trend.rows[0]?.total_grand_usd ?? 0;
  const lastPaidPeriod = trend.rows[0]?.period_month ?? '—';

  return (
    <div className="space-y-10 px-8 py-6">
      {/* Header */}
      <header className="flex items-end justify-between border-b border-stone-300/30 pb-4">
        <div>
          <h1 className="font-serif text-3xl tracking-tight text-stone-900">Staff</h1>
          <p className="mt-1 text-xs uppercase tracking-[0.18em] text-stone-500">
            {totalActive} active · {archived.length} archived · {fmtMoney(totalMonthlyLAK, 'LAK')} monthly base · last paid {lastPaidPeriod} {lastPaidUsd ? `· $${Math.round(lastPaidUsd).toLocaleString()}` : ''}
          </p>
        </div>
        <div className="flex items-end gap-4">
          <div className="text-right">
            <p className="text-[11px] uppercase tracking-[0.18em] text-stone-500">Source</p>
            <p className="font-mono text-xs text-stone-700">
              public.v_staff_register_extended · ops.v_payroll_dept_monthly
            </p>
          </div>
          <UploadPayslipsButton />
        </div>
      </header>

      {/* Anomalies & alerts */}
      <section>
        <div className="mb-3 flex items-baseline justify-between">
          <div>
            <h2 className="font-serif text-xl text-stone-900">Anomalies &amp; alerts</h2>
            <p className="mt-1 text-[11px] uppercase tracking-[0.18em] text-stone-500">
              Live data-quality flags. Owner action required.
            </p>
          </div>
          <span className="font-serif text-2xl text-amber-700">{totalFlags} flags</span>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-5">
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

      {/* Department breakdown */}
      <section>
        <div className="mb-3 flex items-baseline justify-between">
          <h2 className="font-serif text-xl text-stone-900">
            Department breakdown · <em className="font-serif">{lastPaidPeriod}</em>
          </h2>
          <span className="rounded-sm bg-emerald-900/10 px-2 py-1 font-mono text-[10px] uppercase tracking-[0.16em] text-emerald-900">
            ops.v_payroll_dept_monthly
          </span>
        </div>
        {deptRows.length === 0 ? (
          <div className="panel dashed" style={{ padding: 16, color: 'var(--ink-mute)', fontStyle: 'italic', textAlign: 'center' }}>
            No payroll rows yet for any closed period.
          </div>
        ) : (
          <DeptBreakdown rows={deptRows} fx={FX_LAK_PER_USD} />
        )}
      </section>

      {/* 4-month payroll trend */}
      <section>
        <div className="mb-3 flex items-baseline justify-between">
          <h2 className="font-serif text-xl text-stone-900">4-month payroll trend</h2>
          <span className="rounded-sm bg-emerald-900/10 px-2 py-1 font-mono text-[10px] uppercase tracking-[0.16em] text-emerald-900">
            USD primary · LAK secondary
          </span>
        </div>
        {trend.window.length === 0 ? (
          <div className="panel dashed" style={{ padding: 16, color: 'var(--ink-mute)', fontStyle: 'italic', textAlign: 'center' }}>
            No payroll history yet.
          </div>
        ) : (
          <PayrollTrend windowMonths={trend.window} data={trend.rows} fx={FX_LAK_PER_USD} />
        )}
      </section>

      {/* Active staff register */}
      <section>
        <div className="mb-3 flex items-baseline justify-between">
          <div>
            <h2 className="font-serif text-xl text-stone-900">
              Staff register · <em className="font-serif">{totalActive} active</em>
            </h2>
            <p className="mt-1 text-[11px] uppercase tracking-[0.18em] text-stone-500">
              Click any row to drill down.
            </p>
          </div>
          <span className="rounded-sm bg-emerald-900/10 px-2 py-1 font-mono text-[10px] uppercase tracking-[0.16em] text-emerald-900">
            Supabase · live
          </span>
        </div>
        <StaffTable rows={safeRows} />
      </section>

      {/* Archived staff */}
      <section>
        <div className="mb-3 flex items-baseline justify-between">
          <div>
            <h2 className="font-serif text-xl text-stone-900">
              Archived staff · <em className="font-serif">{archived.length}</em>
            </h2>
            <p className="mt-1 text-[11px] uppercase tracking-[0.18em] text-stone-500">
              Departed employees · payroll history + bank info retained for record.
            </p>
          </div>
        </div>
        <ArchivedStaffTable rows={archived} />
      </section>
    </div>
  );
}
