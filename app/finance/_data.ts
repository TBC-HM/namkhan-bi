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

// ----- Last-Year P&L (gl.pnl_snapshot) ------------------------------------
// pnl_snapshot has 2025 historical data. Used to populate the "LY" column
// on /finance/pnl. Joins to gl.accounts to derive USALI department + subcat.

export interface LyDeptRow {
  usali_department: string | null;
  usali_subcategory: string | null;
  revenue: number;
  cost_of_sales: number;
  payroll: number;
  other_op_exp: number;
}

/**
 * Pull last-year P&L for the same calendar month as `period` (YYYY-MM).
 * Returns an aggregate-by-department record. If no 2025 data exists for
 * that month, returns an empty array.
 */
export async function getLyByDept(period: string): Promise<LyDeptRow[]> {
  const [yStr, mStr] = period.split('-');
  const y = Number(yStr) - 1;
  const m = Number(mStr);
  if (!Number.isFinite(y) || !Number.isFinite(m)) return [];

  // pnl_snapshot.account_code joins to gl.accounts.account_id. We pull every
  // row for that month and aggregate client-side by USALI subcategory + dept.
  const { data, error } = await supabaseGl
    .from('pnl_snapshot')
    .select('account_code, amount_usd')
    .eq('period_year', y)
    .eq('period_month', m);
  if (error) { console.error('[gl] getLyByDept', error); return []; }

  const rows = (data ?? []) as { account_code: string; amount_usd: number }[];
  if (rows.length === 0) return [];

  // Need account → usali_subcategory mapping. Pull once.
  const ids = Array.from(new Set(rows.map(r => r.account_code))).filter(Boolean);
  const { data: accts, error: aErr } = await supabaseGl
    .from('accounts')
    .select('account_id, usali_subcategory')
    .in('account_id', ids);
  if (aErr) { console.error('[gl] getLyByDept accounts join', aErr); return []; }
  const subcatById = new Map<string, string | null>();
  for (const a of (accts ?? []) as { account_id: string; usali_subcategory: string | null }[]) {
    subcatById.set(a.account_id, a.usali_subcategory);
  }

  // For LY we don't have class assignment in pnl_snapshot, so we can't break
  // out by usali_department without a class join. Aggregate by subcategory
  // only; the consumer rolls up to a single LY total per dept-equivalent.
  const bySub = new Map<string, { revenue: number; cost_of_sales: number; payroll: number; other_op_exp: number }>();
  for (const r of rows) {
    const sub = subcatById.get(r.account_code) ?? 'Other';
    const cur = bySub.get(sub) ?? { revenue: 0, cost_of_sales: 0, payroll: 0, other_op_exp: 0 };
    const amt = Number(r.amount_usd || 0);
    if (sub === 'Revenue') cur.revenue += -amt; // revenue stored as credit (negative)
    else if (sub === 'Cost of Sales') cur.cost_of_sales += amt;
    else if (sub === 'Payroll & Related') cur.payroll += amt;
    else cur.other_op_exp += amt;
    bySub.set(sub, cur);
  }
  // Flatten to one row per subcategory (department info absent at LY level)
  return Array.from(bySub.entries()).map(([sub, v]) => ({
    usali_department: null,
    usali_subcategory: sub,
    ...v,
  }));
}

/** Convenience: total revenue for the same month last year. */
export async function getLyTotalRevenue(period: string): Promise<number | null> {
  const ly = await getLyByDept(period);
  if (ly.length === 0) return null;
  return ly.reduce((s, r) => s + (r.revenue || 0), 0);
}

/**
 * Read LY (Actuals 2025) lines for the same calendar month and return a
 * Record keyed `${subcat}||${dept}` (where dept='' replaces 'Undistributed'
 * to match the page convention). Sourced from gl.v_ly_lines (plan.lines
 * scenario "Actuals 2025").
 */
export async function getLyLinesByPeriod(period: string): Promise<Record<string, number>> {
  const [yStr, mStr] = period.split('-');
  const y = Number(yStr) - 1;
  const m = Number(mStr);
  if (!Number.isFinite(y) || !Number.isFinite(m)) return {};
  const lyPeriod = `${y}-${String(m).padStart(2, '0')}`;
  const { data, error } = await supabaseGl
    .from('v_ly_lines')
    .select('usali_subcategory, usali_department, amount_usd')
    .eq('period_yyyymm', lyPeriod);
  if (error || !data) return {};
  const out: Record<string, number> = {};
  for (const r of data as { usali_subcategory: string; usali_department: string; amount_usd: number }[]) {
    const dept = r.usali_department === 'Undistributed' ? '' : r.usali_department;
    const k = `${r.usali_subcategory}||${dept}`;
    out[k] = (out[k] ?? 0) + Number(r.amount_usd || 0);
  }
  return out;
}

/** Forecast (Conservative 2026) lines, same key shape. */
export async function getForecastLinesByPeriod(period: string): Promise<Record<string, number>> {
  const { data, error } = await supabaseGl
    .from('v_forecast_lines')
    .select('usali_subcategory, usali_department, amount_usd')
    .eq('period_yyyymm', period);
  if (error || !data) return {};
  const out: Record<string, number> = {};
  for (const r of data as { usali_subcategory: string; usali_department: string; amount_usd: number }[]) {
    const dept = r.usali_department === 'Undistributed' ? '' : r.usali_department;
    const k = `${r.usali_subcategory}||${dept}`;
    out[k] = (out[k] ?? 0) + Number(r.amount_usd || 0);
  }
  return out;
}

/**
 * LY by USALI department. We infer department from gl_entries class assignment
 * (account_id → most-frequent class_id → classes.usali_department). Accounts not
 * present in gl_entries get null department.
 *
 * Returns map: usali_department → { revenue, expense } summed for the same
 * month last year.
 */
export async function getLyByUsaliDept(period: string): Promise<Record<string, { revenue: number; expense: number }>> {
  const [yStr, mStr] = period.split('-');
  const y = Number(yStr) - 1;
  const m = Number(mStr);
  if (!Number.isFinite(y) || !Number.isFinite(m)) return {};

  const { data: snap, error } = await supabaseGl
    .from('pnl_snapshot')
    .select('account_code, amount_usd')
    .eq('period_year', y)
    .eq('period_month', m);
  if (error || !snap || snap.length === 0) return {};

  const ids = Array.from(new Set(snap.map((r: any) => r.account_code))).filter(Boolean);

  // Build account_id → usali_department map via accounts + most-common class
  // assignment in gl_entries.
  const [{ data: accts }, { data: ents }] = await Promise.all([
    supabaseGl.from('accounts').select('account_id, usali_subcategory').in('account_id', ids),
    supabaseGl.from('gl_entries').select('account_id, class_id').in('account_id', ids),
  ]);

  // gl_entries.class_id → gl.classes.usali_department
  const { data: classes } = await supabaseGl.from('classes').select('class_id, usali_department');
  const deptByClass = new Map<string, string | null>();
  for (const c of (classes ?? []) as { class_id: string; usali_department: string | null }[]) {
    deptByClass.set(c.class_id, c.usali_department);
  }

  // Most-common class per account
  const tally = new Map<string, Map<string, number>>();
  for (const e of (ents ?? []) as { account_id: string; class_id: string }[]) {
    if (!e.class_id) continue;
    const m = tally.get(e.account_id) ?? new Map<string, number>();
    m.set(e.class_id, (m.get(e.class_id) ?? 0) + 1);
    tally.set(e.account_id, m);
  }
  const deptByAccount = new Map<string, string | null>();
  for (const [acct, classCounts] of tally.entries()) {
    let bestClass: string | null = null;
    let bestN = 0;
    for (const [cid, n] of classCounts) {
      if (n > bestN) { bestClass = cid; bestN = n; }
    }
    deptByAccount.set(acct, bestClass ? deptByClass.get(bestClass) ?? null : null);
  }
  const subByAccount = new Map<string, string | null>();
  for (const a of (accts ?? []) as { account_id: string; usali_subcategory: string | null }[]) {
    subByAccount.set(a.account_id, a.usali_subcategory);
  }

  const out: Record<string, { revenue: number; expense: number }> = {};
  for (const r of snap as { account_code: string; amount_usd: number }[]) {
    const dept = deptByAccount.get(r.account_code) ?? 'Unmapped';
    const sub = subByAccount.get(r.account_code) ?? '';
    const amt = Number(r.amount_usd || 0);
    if (!out[dept]) out[dept] = { revenue: 0, expense: 0 };
    if (sub === 'Revenue') out[dept].revenue += -amt; // credit-side
    else out[dept].expense += amt;
  }
  return out;
}

// ----- Budget vs Actual (gl.budgets + gl.v_budget_vs_actual) ---------------

export interface BudgetActualRow {
  period_yyyymm: string;
  usali_subcategory: string;
  usali_department: string; // '' when undistributed
  actual_usd: number;
  budget_usd: number;
  variance_usd: number;
  variance_pct: number | null;
}

/** Pull budget × actual rows for a list of periods. */
export async function getBudgetVsActual(periods: string[]): Promise<BudgetActualRow[]> {
  if (periods.length === 0) return [];
  const { data, error } = await supabaseGl
    .from('v_budget_vs_actual')
    .select('*')
    .in('period_yyyymm', periods);
  if (error) { console.error('[gl] getBudgetVsActual', error); return []; }
  return (data ?? []) as BudgetActualRow[];
}

/**
 * All budget rows for one period — used by USALI grid Budget column.
 * Reads from gl.v_budget_lines (sourced from plan.lines · Budget 2026 v1)
 * which uses dept = 'Undistributed' for undistributed lines. We normalise
 * the key to match the page convention (`||` empty suffix for undistributed)
 * so existing page code doesn't have to change.
 */
export async function getBudgetByPeriod(period: string): Promise<Record<string, number>> {
  const { data, error } = await supabaseGl
    .from('v_budget_lines')
    .select('usali_subcategory, usali_department, amount_usd')
    .eq('period_yyyymm', period);
  if (error || !data) return {};
  const out: Record<string, number> = {};
  for (const r of data as { usali_subcategory: string; usali_department: string; amount_usd: number }[]) {
    // Page code keys undistributed lines as `${subcat}||` (empty dept) — translate
    // 'Undistributed' back to '' to match.
    const dept = r.usali_department === 'Undistributed' ? '' : r.usali_department;
    const k = `${r.usali_subcategory}||${dept}`;
    out[k] = (out[k] ?? 0) + Number(r.amount_usd || 0);
  }
  return out;
}

// ----- Plan drivers (volume metrics: room_nights / occ% / ADR) ------------

export interface DriverRow {
  scenario_name: string;
  scenario_type: string;
  driver_key: string;
  value_numeric: number;
}

export async function getDriversByPeriod(period: string): Promise<DriverRow[]> {
  const { data, error } = await supabaseGl
    .from('v_drivers_stack')
    .select('scenario_name, scenario_type, driver_key, value_numeric')
    .eq('period_yyyymm', period);
  if (error || !data) return [];
  return data as DriverRow[];
}

// ----- Freshness summary --------------------------------------------------

export interface FreshnessSummary {
  matview_count: number;
  stale_count: number;
  latest_refresh_at: string | null;
  freshest_minutes: number;
  stalest_minutes: number;
}

export async function getFreshnessSummary(): Promise<FreshnessSummary | null> {
  const { data, error } = await supabaseGl
    .from('v_freshness_summary')
    .select('*')
    .single();
  if (error || !data) return null;
  return data as FreshnessSummary;
}

// ----- Materiality thresholds ---------------------------------------------

export interface MaterialityThreshold {
  pct: number;
  abs_usd: number;
}

export async function getMaterialityThreshold(): Promise<MaterialityThreshold | null> {
  const { data, error } = await supabaseGl
    .from('materiality_thresholds')
    .select('pct_threshold, abs_threshold_usd')
    .eq('scope', 'global')
    .single();
  if (error || !data) return null;
  return {
    pct: Number((data as any).pct_threshold || 5),
    abs_usd: Number((data as any).abs_threshold_usd || 1000),
  };
}

/**
 * Per-dept actuals for a list of periods — used by heatmap. Returns
 * a flat array of { period, dept, revenue, expense, dept_profit }.
 */
export async function getDeptByPeriods(periods: string[]): Promise<Array<{ period: string; dept: string; revenue: number; expense: number; dept_profit: number }>> {
  if (periods.length === 0) return [];
  const { data, error } = await supabaseGl
    .from('v_usali_dept_summary')
    .select('period_yyyymm, usali_department, revenue, cost_of_sales, payroll, other_op_exp, departmental_profit')
    .in('period_yyyymm', periods);
  if (error || !data) return [];
  return (data as any[]).map(r => ({
    period: r.period_yyyymm,
    dept: r.usali_department,
    revenue: Number(r.revenue || 0),
    expense: Number(r.cost_of_sales || 0) + Number(r.payroll || 0) + Number(r.other_op_exp || 0),
    dept_profit: Number(r.departmental_profit || 0),
  }));
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
