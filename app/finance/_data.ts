// app/finance/_data.ts
// Server-side fetchers for the gl.* schema. Use across Finance pages.
// All queries are SELECT-only; gl schema is anon-readable per phase2_99.

import 'server-only';
import { supabaseGl, periodsFor, type PeriodWindow } from '@/lib/supabase-gl';
import { supabase } from '@/lib/supabase';

// ----- pl_section_monthly --------------------------------------------------
export interface PlSection {
  period_yyyymm: string;
  section: 'income' | 'cost_of_sales' | 'gross_profit' | 'expenses' | 'other_expenses' | 'net_earnings';
  amount_usd: number;
}

export async function getPlSections(periods: string[]): Promise<PlSection[]> {
  if (periods.length === 0) return [];
  const { data, error } = await supabaseGl
    .from('pl_section_monthly')
    .select('period_yyyymm, section, amount_usd')
    .in('period_yyyymm', periods);
  if (error) { console.error('[gl] getPlSections', error); return []; }
  return (data || []) as PlSection[];
}

export async function getPlSectionsAll(): Promise<PlSection[]> {
  const { data, error } = await supabaseGl
    .from('pl_section_monthly')
    .select('period_yyyymm, section, amount_usd')
    .order('period_yyyymm');
  if (error) { console.error('[gl] getPlSectionsAll', error); return []; }
  return (data || []) as PlSection[];
}

// ----- USALI house & dept summaries ---------------------------------------
export interface UsaliHouse {
  period_yyyymm: string;
  fiscal_year: number;
  total_revenue: number | null;
  total_cost_of_sales: number | null;
  total_dept_payroll: number | null;
  total_dept_other_op_exp: number | null;
  total_dept_profit: number | null;
  ag_total: number | null;
  sales_marketing: number | null;
  pom: number | null;
  utilities: number | null;
  mgmt_fees: number | null;
  gop: number | null;
  depreciation: number | null;
  interest: number | null;
  income_tax: number | null;
  fx_pnl: number | null;
  non_operating: number | null;
  net_income: number | null;
}

export async function getUsaliHouse(periods: string[]): Promise<UsaliHouse[]> {
  if (periods.length === 0) return [];
  const { data, error } = await supabaseGl
    .from('v_usali_house_summary')
    .select('*')
    .in('period_yyyymm', periods);
  if (error) { console.error('[gl] getUsaliHouse', error); return []; }
  return (data || []) as UsaliHouse[];
}

export interface UsaliDept {
  period_yyyymm: string;
  fiscal_year: number;
  usali_department: string;
  revenue: number | null;
  cost_of_sales: number | null;
  payroll: number | null;
  other_op_exp: number | null;
  gross_profit: number | null;
  departmental_profit: number | null;
  dept_profit_margin: number | null;
}

export async function getUsaliDept(periods: string[]): Promise<UsaliDept[]> {
  if (periods.length === 0) return [];
  const { data, error } = await supabaseGl
    .from('v_usali_dept_summary')
    .select('*')
    .in('period_yyyymm', periods);
  if (error) { console.error('[gl] getUsaliDept', error); return []; }
  return (data || []) as UsaliDept[];
}

// ----- mv_usali_pl_monthly (account-level rollup) -------------------------
export interface UsaliPlRow {
  period_yyyymm: string;
  usali_section: string | null;
  usali_department: string | null;
  usali_subcategory: string | null;
  usali_line_code: string | null;
  account_id: string;
  account_name: string;
  amount_usd: number;
}

export async function getUsaliPlBySubcat(periods: string[], subcategory: string): Promise<UsaliPlRow[]> {
  if (periods.length === 0) return [];
  const { data, error } = await supabaseGl
    .from('mv_usali_pl_monthly')
    .select('*')
    .in('period_yyyymm', periods)
    .eq('usali_subcategory', subcategory);
  if (error) { console.error('[gl] getUsaliPlBySubcat', error); return []; }
  return (data || []) as UsaliPlRow[];
}

// ----- DQ findings ---------------------------------------------------------
export interface DqOpenFinding {
  finding_id: string;
  rule_code: string;
  severity: 'low' | 'med' | 'high' | 'critical';
  ref_type: string | null;
  ref_id: string | null;
  message: string;
  suggested_fix: string | null;
  impact_usd: number | null;
  first_seen_at: string;
  last_seen_at: string;
  sort_severity: number;
}

export async function getDqOpen(opts: { onlyHighCritical?: boolean } = {}): Promise<DqOpenFinding[]> {
  let q = supabaseGl
    .from('v_dq_open_findings')
    .select('*')
    .order('sort_severity')
    .order('impact_usd', { ascending: false, nullsFirst: false });
  if (opts.onlyHighCritical) q = q.in('severity', ['critical', 'high']);
  const { data, error } = await q;
  if (error) { console.error('[gl] getDqOpen', error); return []; }
  return (data || []) as DqOpenFinding[];
}

export async function getDqUnmappedCount(): Promise<number> {
  const { count, error } = await supabaseGl
    .from('dq_findings')
    .select('*', { count: 'exact', head: true })
    .eq('rule_code', 'DQ-04-UNMAPPED')
    .eq('status', 'open');
  if (error) { console.error('[gl] getDqUnmappedCount', error); return 0; }
  return count ?? 0;
}

// ----- Decisions queue (cross-schema: governance) -------------------------
export interface DecisionQueueItem {
  id?: string;
  title?: string;
  status?: string;
  impact_usd_estimate?: number | null;
  [key: string]: unknown;
}

export async function getPendingDecisions(limit = 5): Promise<DecisionQueueItem[]> {
  // governance schema — uses default supabase client (public schema by default)
  // but we need to query governance schema; use the client with schema override
  const { createClient } = await import('@supabase/supabase-js');
  const govClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { db: { schema: 'governance' }, auth: { persistSession: false } }
  );
  const { data, error } = await govClient
    .from('decision_queue')
    .select('*')
    .eq('status', 'pending')
    .order('impact_usd_estimate', { ascending: false, nullsFirst: false })
    .limit(limit);
  if (error) { console.error('[governance] getPendingDecisions', error); return []; }
  return (data || []) as DecisionQueueItem[];
}

// ----- Helpers -------------------------------------------------------------

export function currentPeriod(today: Date = new Date()): string {
  const y = today.getFullYear();
  const m = today.getMonth() + 1;
  return `${y}-${String(m).padStart(2, '0')}`;
}

export function periodsForWindow(win: PeriodWindow): string[] {
  return periodsFor(win);
}

export function pickSection(rows: PlSection[], section: PlSection['section']): number {
  return rows
    .filter(r => r.section === section)
    .reduce((s, r) => s + Number(r.amount_usd || 0), 0);
}

export function pickPeriod<T extends { period_yyyymm: string }>(rows: T[], period: string): T | undefined {
  return rows.find(r => r.period_yyyymm === period);
}

// supabase ref re-export for legacy paths that need it
export { supabase };
