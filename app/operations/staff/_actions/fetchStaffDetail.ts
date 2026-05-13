// app/operations/staff/_actions/fetchStaffDetail.ts
// PBS 2026-05-09: "THE STAFF LANDING PAGE HAS CHANGED — CHANGE FROM A LANDING
// PAGE TO THE SAME CONCEPT LIKE IN GUESTS THAT THE DETAIL SLIDES IN FROM THE
// RIGHT". Server action returning the same payload that
// /[staffId]/page.tsx uses so the drawer can render the full profile inline.

'use server';

import { supabase } from '@/lib/supabase';

export interface StaffDetail {
  staff_id: string;
  emp_id: string;
  full_name: string;
  position_title: string;
  dept_code: string;
  dept_name: string;
  employment_type: string;
  contract_hours_pw: number | null;
  monthly_salary: number;
  salary_currency: string | null;
  hourly_cost_lak: number;
  skills: string[] | null;
  hire_date: string | null;
  end_date: string | null;
  is_active: boolean;
  photo_path: string | null;
  phone: string | null;
  contract_doc_id: string | null;
  last_payslip_period: string | null;
  payslip_pdf_status: 'current' | 'overdue' | 'never' | null;
  last_payroll_period: string | null;
  last_payroll_total_usd: number | null;
  last_payroll_days_worked: number | null;
  tenure_years: number | null;
  payroll_12m: any[] | null;
  attendance_90d: any[] | null;
  availability: any[] | null;
  dq_flags: string[] | null;
  bank_name: string | null;
  bank_account_no: string | null;
  bank_account_name: string | null;
  // PBS 2026-05-13 drawer redesign — contact + leave fields
  email: string | null;
  personal_email: string | null;
  phone_canonical: string | null;
  date_of_birth: string | null;
  seniority_date: string | null;
  nationality: string | null;
  property_id: number | null;
  annual_leave_used_ytd: number | null;
  public_holiday_ytd: number | null;
  sick_days_ytd: number | null;
  days_worked_ytd: number | null;
  // Attendance score from ops.v_staff_attendance_score (added 2026-05-13)
  attendance_score: number | null;
  attendance_hours_30d: number | null;
  attendance_hours_ytd: number | null;
  attendance_events_30d: number | null;
  // Punctuality score from ops.v_staff_punctuality (added 2026-05-13)
  punctuality_avg_90d: number | null;
  punctuality_shifts_90d: number | null;
  punctuality_no_show_90d: number | null;
  punctuality_late_15_90d: number | null;
  // Last raise + extra pay (added 2026-05-13)
  last_raise_date: string | null;
  last_raise_delta_lak: number | null;
  last_raise_old_lak: number | null;
  last_raise_new_lak: number | null;
  last_raise_pct: number | null;
  extra_adjustments_pos_ytd: number | null;
  extra_adjustments_neg_ytd: number | null;
  extra_deductions_ytd: number | null;
  extra_events_count: number | null;
  // Benefit YTD totals (added 2026-05-13)
  service_charge_ytd_lak: number | null;
  gasoline_ytd_lak: number | null;
  internet_ytd_lak: number | null;
  benefits_total_ytd_lak: number | null;
}

export async function fetchStaffDetail(staffId: string): Promise<StaffDetail | null> {
  const thisYear = new Date().getUTCFullYear();
  const [{ data, error }, scoreRes, raiseRes, extraRes, punctRes] = await Promise.all([
    // PBS 2026-05-13: pin schema to `public` — there is a duplicate
    // `ops.v_staff_detail` (older, no property_id). Without the schema
    // pin PostgREST sometimes resolves to the wrong one, which broke the
    // drawer's property_id-gated attendance block for many Donna staff.
    supabase
      .schema('public')
      .from('v_staff_detail')
      .select('*')
      .eq('staff_id', staffId)
      .maybeSingle(),
    // PBS 2026-05-13: pull property_id too so we can reuse it for the
    // drawer property-aware section visibility (skip Attendance block
    // for Namkhan since no timeclock is wired). View is now LEFT JOIN'd
    // against staff_employment so every active staff has a row.
    supabase
      .schema('ops')
      .from('v_staff_attendance_score')
      .select('attendance_score, hours_30d, hours_ytd, events_30d, property_id')
      .eq('staff_id', staffId)
      .maybeSingle(),
    supabase
      .schema('ops')
      .from('v_staff_last_raise')
      .select('raise_date, delta_lak, old_base_lak, new_base_lak, delta_pct')
      .eq('staff_id', staffId)
      .maybeSingle(),
    supabase
      .schema('ops')
      .from('v_staff_extra_pay')
      .select('adjustments_pos_ytd, adjustments_neg_ytd, deductions_ytd, events_count, service_charge_ytd_lak, gasoline_ytd_lak, internet_ytd_lak, benefits_total_ytd_lak')
      .eq('staff_id', staffId)
      .eq('year', thisYear)
      .maybeSingle(),
    // PBS 2026-05-13: punctuality score (90d) per staff for the second
    // mini score in the drawer's attendance block.
    supabase
      .schema('ops')
      .from('v_staff_punctuality')
      .select('avg_score, shifts_90d, no_show_90d, late_15_90d')
      .eq('staff_id', staffId)
      .maybeSingle(),
  ]);
  if (error) {
    console.error('fetchStaffDetail error', error);
    return null;
  }
  if (!data) return null;
  const sc = scoreRes.data as any;
  const rs = raiseRes.data as any;
  const ex = extraRes.data as any;
  const pu = punctRes.data as any;
  return {
    ...(data as any),
    attendance_score:      sc?.attendance_score ?? null,
    attendance_hours_30d:  sc?.hours_30d ?? null,
    attendance_hours_ytd:  sc?.hours_ytd ?? null,
    attendance_events_30d: sc?.events_30d ?? null,
    punctuality_avg_90d:     pu?.avg_score ?? null,
    punctuality_shifts_90d:  pu?.shifts_90d ?? null,
    punctuality_no_show_90d: pu?.no_show_90d ?? null,
    punctuality_late_15_90d: pu?.late_15_90d ?? null,
    last_raise_date:       rs?.raise_date ?? null,
    last_raise_delta_lak:  rs?.delta_lak ?? null,
    last_raise_old_lak:    rs?.old_base_lak ?? null,
    last_raise_new_lak:    rs?.new_base_lak ?? null,
    last_raise_pct:        rs?.delta_pct ?? null,
    extra_adjustments_pos_ytd: ex?.adjustments_pos_ytd ?? null,
    extra_adjustments_neg_ytd: ex?.adjustments_neg_ytd ?? null,
    extra_deductions_ytd:      ex?.deductions_ytd ?? null,
    extra_events_count:        ex?.events_count ?? null,
    service_charge_ytd_lak:    ex?.service_charge_ytd_lak ?? null,
    gasoline_ytd_lak:          ex?.gasoline_ytd_lak ?? null,
    internet_ytd_lak:          ex?.internet_ytd_lak ?? null,
    benefits_total_ytd_lak:    ex?.benefits_total_ytd_lak ?? null,
  } as StaffDetail;
}
