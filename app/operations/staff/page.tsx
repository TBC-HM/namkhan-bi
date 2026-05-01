// app/operations/staff/page.tsx
// /operations/staff — redesigned master register (Phase B, 2026-05-01)
// Source: public.v_staff_register_extended + public.v_staff_anomalies (proxies of ops.* views)
// Read-only. Click row → /operations/staff/[staffId]
//
// Repair notes (vs original drop):
//   - createClient() → existing { supabase } from '@/lib/supabase'
//   - .schema('ops').from(...) → public-proxy queries (ops not API-exposed)
//   - fmtLAK/fmtUSD → fmtMoney(n, 'LAK'|'USD')

import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { fmtMoney } from '@/lib/format';
import { AnomalyCard } from './_components/AnomalyCard';
import { StaffTable } from './_components/StaffTable';
import UploadPayslipsButton from './_components/UploadPayslipsButton';

export const revalidate = 60;
export const dynamic = 'force-dynamic';

type Anomaly = {
  issue: string;
  staff_id: string;
  full_name: string;
  dept_name: string;
};

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
  missing_hire_date: {
    label: 'Missing hire date',
    sub: 'Contract import gap — separate handover.',
  },
  missing_contract: {
    label: 'Missing contract PDF',
    sub: 'Upload signed contract to docs.hr_docs.',
  },
  contract_expiring: {
    label: 'Contract expiring',
    sub: 'End date ≤ 60 days. Renew or release.',
  },
  no_payslip_pdf_last_closed_month: {
    label: 'Payslip PDF missing',
    sub: 'Upload last closed-month payslip.',
  },
  no_calculated_payroll_last_closed_month: {
    label: 'Payroll not run',
    sub: 'ops.payroll_monthly has no row for last month.',
  },
};

export default async function StaffPage() {
  const [{ data: rows }, { data: anomalies }] = await Promise.all([
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
    supabase
      .from('v_staff_anomalies')
      .select('issue, staff_id, full_name, dept_name'),
  ]);

  const safeRows: Row[] = (rows as unknown as Row[]) ?? [];
  const safeAnoms: Anomaly[] = (anomalies as unknown as Anomaly[]) ?? [];

  // Group anomalies by issue
  const grouped: Record<string, Anomaly[]> = {};
  for (const a of safeAnoms) {
    (grouped[a.issue] ||= []).push(a);
  }

  const totalFlags = safeAnoms.length;
  const totalActive = safeRows.length;
  const totalMonthlyLAK = safeRows.reduce(
    (s, r) => s + Number(r.monthly_salary || 0),
    0
  );

  return (
    <div className="space-y-10 px-8 py-6">
      {/* Header */}
      <header className="flex items-end justify-between border-b border-stone-300/30 pb-4">
        <div>
          <h1 className="font-serif text-3xl tracking-tight text-stone-900">Staff</h1>
          <p className="mt-1 text-xs uppercase tracking-[0.18em] text-stone-500">
            {totalActive} active · {fmtMoney(totalMonthlyLAK, 'LAK')} monthly payroll
          </p>
        </div>
        <div className="flex items-end gap-4">
          <div className="text-right">
            <p className="text-[11px] uppercase tracking-[0.18em] text-stone-500">Source</p>
            <p className="font-mono text-xs text-stone-700">
              public.v_staff_register_extended · Supabase live
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

      {/* Staff register */}
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
    </div>
  );
}
