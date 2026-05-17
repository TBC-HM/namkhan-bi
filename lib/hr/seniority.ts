// lib/hr/seniority.ts — shared seniority + indemnización computation.
//
// Reads from two public bridge views (PostgREST-reachable, created 2026-05-15):
//   - public.v_hr_seniority_employee  (one row per active employee · dept + best-available monthly_eur)
//   - public.v_hr_seniority_by_dept   (per-department aggregation)
//
// Backward-compatible: EmployeeWithSeniority shape unchanged so Offboarding +
// Warnings tabs keep working without edits.

import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export interface EmployeeWithSeniority {
  id: number;
  full_name_en: string | null;
  hire_date: string | null;
  current_dept_code: string | null;
  current_position_code: string | null;
  monthly_eur: number;
  seniorityDays: number;
  seniorityYears: number;
  seniorityLabel: string;
  indemUnfair: number | null;
  indemObjective: number | null;
  indemFixedTermEnd: number | null;
  contract_type: string | null;
}

export interface DeptSeniorityStats {
  dept_code: string;
  dept_name: string;
  headcount: number;
  avgYears: number;
  totalMonthlyEur: number;
  exposureUnfair: number | null;
  exposureObjective: number | null;
  exposureFixed: number | null;
}

export interface SeniorityBucket {
  label: string;     // "0–1y", "1–3y", "3–5y", "5–10y", "10y+"
  rangeMin: number;  // years
  count: number;
}

export interface SeniorityTotals {
  active: number;
  totalUnfair: number;
  totalObjective: number;
  totalFixed: number;
  avgYears: number;
  top5Years: number;
  totalMonthlyEur: number;
  withSalary: number;     // how many of the active set have a positive monthly_eur
}

export interface SeniorityBundle {
  rows: EmployeeWithSeniority[];
  totals: SeniorityTotals;
  byDepartment: DeptSeniorityStats[];
  buckets: SeniorityBucket[];
  isDonna: boolean;
  error: string | null;
}

const BUCKETS: { label: string; min: number; max: number }[] = [
  { label: '0–1y',  min: 0,  max: 1   },
  { label: '1–3y',  min: 1,  max: 3   },
  { label: '3–5y',  min: 3,  max: 5   },
  { label: '5–10y', min: 5,  max: 10  },
  { label: '10y+',  min: 10, max: 999 },
];

interface ViewEmployeeRow {
  id: number;
  property_id: number;
  full_name_en: string | null;
  hire_date: string | null;
  contract_type: string | null;
  dept_code: string | null;
  dept_name: string | null;
  position_title: string | null;
  contract_pattern: string | null;
  monthly_eur: number | string | null;
  monthly_eur_source: string | null;
  seniority_days: number | null;
  seniority_years: number | string | null;
}

interface ViewDeptRow {
  property_id: number;
  dept_code: string;
  dept_name: string;
  headcount: number;
  avg_years: number | string;
  total_monthly_eur: number | string;
  exposure_unfair_33d: number | string;
  exposure_objective_20d: number | string;
  exposure_fixed_12d: number | string;
}

function toNum(v: number | string | null | undefined): number {
  if (v === null || v === undefined) return 0;
  return typeof v === 'number' ? v : Number(v) || 0;
}

function fmtSeniorityLabel(years: number): string {
  const whole = Math.floor(years);
  const months = Math.floor((years - whole) * 12);
  return `${whole}y ${months}m`;
}

export async function computeSeniorityForProperty(propertyId: number): Promise<SeniorityBundle> {
  const sb = getSupabaseAdmin();
  const isDonna = propertyId === 1000001;

  const [{ data: empRows, error: empErr }, { data: deptRows, error: deptErr }] = await Promise.all([
    sb.from('v_hr_seniority_employee').select('*').eq('property_id', propertyId).limit(1000),
    sb.from('v_hr_seniority_by_dept').select('*').eq('property_id', propertyId),
  ]);

  if (empErr) {
    return {
      rows: [], byDepartment: [], buckets: [],
      totals: { active: 0, totalUnfair: 0, totalObjective: 0, totalFixed: 0, avgYears: 0, top5Years: 0, totalMonthlyEur: 0, withSalary: 0 },
      isDonna, error: empErr.message,
    };
  }

  const view = (empRows ?? []) as ViewEmployeeRow[];

  const enriched: EmployeeWithSeniority[] = view.map((r) => {
    const seniorityYears = toNum(r.seniority_years);
    const monthlyEur = toNum(r.monthly_eur);
    const dailyEur = monthlyEur > 0 ? (monthlyEur * 12) / 365 : 0;
    const indemUnfair       = isDonna ? Math.min(dailyEur * 33 * seniorityYears, monthlyEur * 24) : null;
    const indemObjective    = isDonna ? Math.min(dailyEur * 20 * seniorityYears, monthlyEur * 12) : null;
    const indemFixedTermEnd = isDonna ? dailyEur * 12 * seniorityYears : null;
    return {
      id: r.id,
      full_name_en: r.full_name_en,
      hire_date: r.hire_date,
      current_dept_code: r.dept_code ?? null,
      current_position_code: r.position_title ?? null,
      monthly_eur: monthlyEur,
      seniorityDays: r.seniority_days ?? 0,
      seniorityYears,
      seniorityLabel: r.hire_date ? fmtSeniorityLabel(seniorityYears) : '—',
      indemUnfair, indemObjective, indemFixedTermEnd,
      contract_type: r.contract_type ?? null,
    };
  });

  enriched.sort((a, b) => b.seniorityDays - a.seniorityDays);

  const total = enriched.length;
  const totalUnfair    = enriched.reduce((s, r) => s + (r.indemUnfair      ?? 0), 0);
  const totalObjective = enriched.reduce((s, r) => s + (r.indemObjective   ?? 0), 0);
  const totalFixed     = enriched.reduce((s, r) => s + (r.indemFixedTermEnd ?? 0), 0);
  const totalMonthlyEur = enriched.reduce((s, r) => s + r.monthly_eur, 0);
  const withSalary = enriched.filter((r) => r.monthly_eur > 0).length;
  const avgYears  = total > 0 ? enriched.reduce((s, r) => s + r.seniorityYears, 0) / total : 0;
  const top5Years = enriched.slice(0, 5).reduce((s, r) => s + r.seniorityYears, 0);

  const buckets: SeniorityBucket[] = BUCKETS.map((b) => ({
    label: b.label,
    rangeMin: b.min,
    count: enriched.filter((r) => r.seniorityYears >= b.min && r.seniorityYears < b.max).length,
  }));

  const byDepartment: DeptSeniorityStats[] = deptErr || !deptRows
    ? []
    : (deptRows as ViewDeptRow[]).map((d) => ({
        dept_code: d.dept_code,
        dept_name: d.dept_name,
        headcount: d.headcount,
        avgYears: toNum(d.avg_years),
        totalMonthlyEur: toNum(d.total_monthly_eur),
        exposureUnfair:    isDonna ? toNum(d.exposure_unfair_33d)    : null,
        exposureObjective: isDonna ? toNum(d.exposure_objective_20d) : null,
        exposureFixed:     isDonna ? toNum(d.exposure_fixed_12d)     : null,
      }));

  return {
    rows: enriched,
    byDepartment,
    buckets,
    totals: { active: total, totalUnfair, totalObjective, totalFixed, avgYears, top5Years, totalMonthlyEur, withSalary },
    isDonna,
    error: null,
  };
}

export function fmtMoneyEur(amount: number, compact = true): string {
  if (!isFinite(amount) || amount === 0) return '—';
  const abs = Math.abs(amount);
  if (compact && abs >= 1000) return `€${(amount / 1000).toFixed(1)}k`;
  return `€${Math.round(amount).toLocaleString('en-US')}`;
}
