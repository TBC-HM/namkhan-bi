// app/operations/staff/_components/staff-detail-types.ts
// Shared row types used by AttendanceCalendar, AvailabilityGrid,
// CompBreakdown, PayrollHistory, YtdSummary.
// Previously exported from [staffId]/page.tsx but that file became a thin
// wrapper around StaffDetailContent so types live here now.

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
  fx_lak_usd?: number | null;
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
