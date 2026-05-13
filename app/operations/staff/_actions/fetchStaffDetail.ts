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
}

export async function fetchStaffDetail(staffId: string): Promise<StaffDetail | null> {
  const { data, error } = await supabase
    .from('v_staff_detail')
    .select('*')
    .eq('staff_id', staffId)
    .maybeSingle();
  if (error) {
    console.error('fetchStaffDetail error', error);
    return null;
  }
  return data as StaffDetail | null;
}
