// app/operations/staff/[staffId]/page.tsx
// /operations/staff/[staffId] — per-employee drill-down (Phase B, 2026-05-01)
// Source: public.v_staff_detail (proxy of ops.v_staff_detail; ops not API-exposed)
// Single row, all aggregates as JSONB columns.

import Link from 'next/link';
import { notFound } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { fmtMoney, FX_LAK_PER_USD } from '@/lib/format';
import { AttendanceCalendar } from '../_components/AttendanceCalendar';
import { PayrollHistory } from '../_components/PayrollHistory';
import { AvailabilityGrid } from '../_components/AvailabilityGrid';
import { DqStrip } from '../_components/DqStrip';

export const revalidate = 60;
export const dynamic = 'force-dynamic';

type Detail = {
  staff_id: string;
  emp_id: string;
  full_name: string;
  position_title: string;
  dept_code: string;
  dept_name: string;
  employment_type: string;
  contract_hours_pw: number;
  monthly_salary: number;
  salary_currency: string;
  hourly_cost_lak: number;
  skills: string[];
  hire_date: string | null;
  end_date: string | null;
  is_active: boolean;
  contract_doc_id: string | null;
  last_payslip_period: string | null;
  payslip_pdf_status: 'current' | 'overdue' | 'never';
  last_payroll_period: string | null;
  last_payroll_total_usd: number | null;
  last_payroll_days_worked: number | null;
  tenure_years: number | null;
  payroll_12m: PayrollRow[] | null;
  attendance_90d: AttendanceRow[] | null;
  availability: AvailabilityRow[] | null;
  dq_flags: string[] | null;
};

export type PayrollRow = {
  period_month: string;
  days_worked: number;
  days_off: number;
  days_annual_leave: number;
  days_public_holiday: number;
  base_salary_lak: number;
  overtime_15x_lak: number;
  overtime_2x_lak: number;
  service_charge_lak: number;
  gasoline_allow_lak: number;
  internet_allow_lak: number;
  other_allow_lak: number;
  adjustment_lak: number;
  deduction_lak: number;
  sso_5_5_lak: number;
  tax_lak: number;
  net_salary_lak: number;
  net_salary_usd: number;
  grand_total_usd: number;
};

export type AttendanceRow = {
  attendance_date: string;
  code: 'D' | 'X' | 'AL' | 'PH' | string;
  hours_worked: number | null;
  overtime_15x_h: number | null;
  overtime_2x_h: number | null;
  notes: string | null;
};

export type AvailabilityRow = {
  weekday: number;
  start_time: string;
  end_time: string;
  break_minutes: number;
};

export default async function StaffDetailPage({
  params,
}: {
  params: { staffId: string };
}) {
  const { data, error } = await supabase
    .from('v_staff_detail')
    .select('*')
    .eq('staff_id', params.staffId)
    .maybeSingle();

  if (error || !data) return notFound();
  const d = data as unknown as Detail;

  const annualLak = (d.monthly_salary || 0) * 12;
  const annualUsdEquiv = annualLak / FX_LAK_PER_USD;

  return (
    <div className="space-y-8 px-8 py-6">
      {/* Breadcrumb + back */}
      <nav className="text-[11px] uppercase tracking-[0.16em] text-stone-500">
        <Link href="/operations/staff" className="hover:text-stone-900">
          ← Staff register
        </Link>
        <span className="mx-2 text-stone-300">/</span>
        <span className="text-stone-700">{d.emp_id}</span>
      </nav>

      {/* Hero */}
      <header className="flex flex-wrap items-end justify-between gap-6 border-b border-stone-300/40 pb-6">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-stone-500">
            {d.emp_id} · {d.dept_name}
          </p>
          <h1 className="mt-2 font-serif text-4xl tracking-tight text-stone-900">
            {d.full_name}
          </h1>
          <p className="mt-1 text-sm italic text-stone-600">{d.position_title}</p>
          {d.skills?.length ? (
            <ul className="mt-3 flex flex-wrap gap-2">
              {d.skills.map((s) => (
                <li
                  key={s}
                  className="rounded-sm border border-stone-300 px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-stone-700"
                >
                  {s}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
        <div className="flex gap-3">
          <StatusPill active={d.is_active} />
          <span className="rounded-sm border border-stone-300 bg-white px-3 py-1 font-mono text-[10px] uppercase tracking-wider text-stone-700">
            {d.employment_type}
          </span>
        </div>
      </header>

      {/* DQ flags strip */}
      {d.dq_flags?.length ? <DqStrip flags={d.dq_flags} /> : null}

      {/* KPI strip */}
      <section className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <Kpi
          label="Monthly cost"
          value={fmtMoney(d.monthly_salary, 'LAK')}
          sub={`≈ ${fmtMoney((d.monthly_salary || 0) / FX_LAK_PER_USD, 'USD')}`}
        />
        <Kpi
          label="Annual cost"
          value={fmtMoney(annualLak, 'LAK')}
          sub={`≈ ${fmtMoney(annualUsdEquiv, 'USD')}`}
        />
        <Kpi
          label="Hourly cost"
          value={fmtMoney(d.hourly_cost_lak, 'LAK')}
          sub={`${d.contract_hours_pw} h/wk`}
        />
        <Kpi
          label="Tenure"
          value={d.tenure_years != null ? `${d.tenure_years} yrs` : '— hire date'}
          sub={d.hire_date ?? 'Backfill required'}
        />
      </section>

      {/* Two-column body */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Left: Attendance + Payroll */}
        <div className="space-y-6 lg:col-span-2">
          <Panel
            title="Attendance · last 90 days"
            sub="D = worked · X = day off · AL = annual leave · PH = public holiday"
          >
            <AttendanceCalendar rows={d.attendance_90d ?? []} />
          </Panel>

          <Panel
            title="Payroll · last 12 months"
            sub="Source: ops.payroll_monthly. LAK base, USD equivalent at imported FX."
          >
            <PayrollHistory rows={d.payroll_12m ?? []} />
          </Panel>
        </div>

        {/* Right: Availability + Documents */}
        <div className="space-y-6">
          <Panel title="Weekly availability" sub="From ops.staff_availability.">
            <AvailabilityGrid rows={d.availability ?? []} />
          </Panel>

          <Panel title="Documents" sub="HR records linked to this employee.">
            <ul className="space-y-2 text-sm">
              <DocRow
                label="Contract"
                ok={!!d.contract_doc_id}
                hint={
                  d.contract_doc_id
                    ? 'On file'
                    : 'Not uploaded — link via docs.hr_docs'
                }
              />
              <DocRow
                label={`Last payslip${
                  d.last_payslip_period ? ` (${d.last_payslip_period})` : ''
                }`}
                ok={d.payslip_pdf_status === 'current'}
                hint={
                  d.payslip_pdf_status === 'current'
                    ? 'Current month uploaded'
                    : d.payslip_pdf_status === 'overdue'
                    ? 'Overdue — upload to docs.hr_docs'
                    : 'No payslip PDF on file'
                }
              />
              <DocRow
                label={`Last calculated payroll${
                  d.last_payroll_period ? ` (${d.last_payroll_period})` : ''
                }`}
                ok={!!d.last_payroll_period}
                hint={
                  d.last_payroll_period
                    ? `Net total ${fmtMoney(
                        Number(d.last_payroll_total_usd ?? 0),
                        'USD'
                      )} · ${d.last_payroll_days_worked} days worked`
                    : 'Not yet run for last closed month'
                }
              />
            </ul>
          </Panel>
        </div>
      </div>
    </div>
  );
}

/* ---------- presentational helpers ---------- */

function Kpi({
  label,
  value,
  sub,
}: {
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <div className="rounded-sm border border-stone-300 bg-white p-4">
      <p className="text-[10px] uppercase tracking-[0.16em] text-stone-500">{label}</p>
      <p className="mt-2 font-serif text-2xl text-stone-900 tabular-nums">{value}</p>
      {sub ? <p className="mt-1 text-xs text-stone-500">{sub}</p> : null}
    </div>
  );
}

function Panel({
  title,
  sub,
  children,
}: {
  title: string;
  sub?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-sm border border-stone-300 bg-white">
      <header className="border-b border-stone-200 px-4 py-3">
        <h3 className="font-serif text-sm uppercase tracking-[0.14em] text-stone-800">
          {title}
        </h3>
        {sub ? <p className="mt-0.5 text-xs text-stone-500">{sub}</p> : null}
      </header>
      <div className="p-4">{children}</div>
    </section>
  );
}

function StatusPill({ active }: { active: boolean }) {
  return (
    <span
      className={`rounded-sm px-3 py-1 font-mono text-[10px] uppercase tracking-wider ${
        active ? 'bg-emerald-100 text-emerald-900' : 'bg-stone-100 text-stone-500'
      }`}
    >
      {active ? 'Active' : 'Inactive'}
    </span>
  );
}

function DocRow({
  label,
  ok,
  hint,
}: {
  label: string;
  ok: boolean;
  hint: string;
}) {
  return (
    <li className="flex items-start justify-between gap-3 border-b border-stone-100 pb-2 last:border-b-0 last:pb-0">
      <div>
        <p className="font-medium text-stone-900">{label}</p>
        <p className="text-xs text-stone-500">{hint}</p>
      </div>
      <span
        className={`mt-1 h-2 w-2 shrink-0 rounded-full ${
          ok ? 'bg-emerald-500' : 'bg-stone-300'
        }`}
      />
    </li>
  );
}
