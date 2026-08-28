// app/operations/restaurant/_cockpit/data.ts
// PBS 2026-08-26 · Reads for the F&B cockpit tabs.
//
// One place for every query the cockpit makes, so a tab body stays presentation
// only. All reads go through public.v_* bridges (L5); F&B is scoped by
// usali_dept = 'F&B' upstream in kpi.v_outlet_reservation_spend, never by a
// hardcoded category list — that list is per-tenant vocabulary and would return
// nothing for Donna.

import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export const NAMKHAN_TZ = 'Asia/Vientiane';
export const MADRID_TZ  = 'Europe/Madrid';

export function tzFor(pid: number): string {
  return pid === 1000001 ? MADRID_TZ : NAMKHAN_TZ;
}

export function todayIn(tz: string, now: Date = new Date()): string {
  const p = new Intl.DateTimeFormat('en-CA', {
    timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(now);
  const g = (t: string) => p.find((x) => x.type === t)?.value ?? '01';
  return `${g('year')}-${g('month')}-${g('day')}`;
}

export function addDays(iso: string, n: number): string {
  const [y, m, d] = iso.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + n);
  return dt.toISOString().slice(0, 10);
}

/** Swallow a missing bridge into an empty result rather than a 500. */
async function safe<T>(p: PromiseLike<{ data: T[] | null }>): Promise<T[]> {
  try { const r = await p; return (r.data ?? []) as T[]; } catch { return []; }
}

// ─── Feed / Tonight ────────────────────────────────────────────────────────

export interface TxnRow {
  transaction_id: string | number;
  local_laos_str: string | null;
  transaction_date: string | null;
  description: string | null;
  item_category_name: string | null;
  amount: number | string | null;
  reservation_id: string | number | null;
}

/**
 * POS postings for the window, newest first.
 *
 * `q` filters server-side on description/category so the manager can find "that
 * table's bottle of wine" without pulling the whole 84k-row history client-side.
 */
export async function getTxns(
  pid: number, fromIso: string, toIso: string, q?: string, limit = 200,
): Promise<TxnRow[]> {
  const sb = getSupabaseAdmin();
  let query = sb.from('v_fnb_raw_txn_enriched')
    .select('transaction_id, local_laos_str, transaction_date, description, item_category_name, amount, reservation_id')
    .eq('property_id', pid)
    .eq('transaction_type', 'debit')
    .gte('transaction_date', fromIso)
    .lte('transaction_date', `${toIso}T23:59:59`)
    .order('transaction_date', { ascending: false })
    .limit(limit);
  const term = (q ?? '').trim();
  if (term) {
    const safeTerm = term.replace(/[%,()]/g, ' ');
    query = query.or(`description.ilike.%${safeTerm}%,item_category_name.ilike.%${safeTerm}%`);
  }
  return safe<TxnRow>(query);
}

// ─── Menu ──────────────────────────────────────────────────────────────────

export interface SellerRow {
  description: string | null;
  usali_subdept: string | null;
  total_revenue_usd: number | string | null;
  total_units: number | string | null;
  active_months: number | null;
  last_sold: string | null;
}

/** Items that have stopped selling — ordered by how long since the last sale. */
export async function getSleepingItems(limit = 20): Promise<SellerRow[]> {
  const sb = getSupabaseAdmin();
  return safe<SellerRow>(
    sb.from('v_fb_top_seller_trend')
      .select('description, usali_subdept, total_revenue_usd, total_units, active_months, last_sold')
      .not('last_sold', 'is', null)
      .order('last_sold', { ascending: true })
      .limit(limit),
  );
}

export async function getTopSellers(limit = 40): Promise<SellerRow[]> {
  const sb = getSupabaseAdmin();
  return safe<SellerRow>(
    sb.from('v_fb_top_seller_trend')
      .select('description, usali_subdept, total_revenue_usd, total_units, active_months, last_sold')
      .order('total_revenue_usd', { ascending: false })
      .limit(limit),
  );
}

export interface CategoryRow { item_category_name: string | null; amount: number | string | null }

export async function getCategoryMix(pid: number, fromIso: string, toIso: string): Promise<CategoryRow[]> {
  const sb = getSupabaseAdmin();
  return safe<CategoryRow>(
    sb.from('v_fnb_raw_txn_enriched')
      .select('item_category_name, amount')
      .eq('property_id', pid)
      .eq('transaction_type', 'debit')
      .gte('transaction_date', fromIso)
      .lte('transaction_date', `${toIso}T23:59:59`)
      .limit(5000),
  );
}

// ─── Cost ──────────────────────────────────────────────────────────────────

export interface CosRow {
  period_yyyymm?: string | null;
  month?: string | null;
  food_cost?: number | string | null;
  total_cost?: number | string | null;
  revenue?: number | string | null;
}

export async function getFoodCost(pid: number): Promise<Record<string, unknown>[]> {
  const sb = getSupabaseAdmin();
  // ORDER BY is not optional here: the view spans 2019-01 → 2027-11 and an
  // unordered limit returns the OLDEST rows, so every downstream year filter
  // came back empty.
  return safe<Record<string, unknown>>(
    sb.from('v_fnb_cos_monthly').select('*')
      .order('period_yyyymm', { ascending: false }).limit(36),
  ).then((rows) => rows.filter((r) => {
    const p = (r as Record<string, unknown>).property_id;
    return p === undefined || p === null || Number(p) === pid;
  }));
}

// getLabour() removed 2026-08-27. It read v_labour_cost_ratio_monthly, which is
// WHOLE-HOTEL payroll divided by ROOMS revenue — a hotel metric that has no
// meaning on an F&B page. Use getFbLabour() below: Restaurant Kitchen payroll
// against F&B revenue.

// ─── Ledger ────────────────────────────────────────────────────────────────

export async function getFolioVsGl(): Promise<Record<string, unknown>[]> {
  const sb = getSupabaseAdmin();
  return safe<Record<string, unknown>>(
    sb.from('v_fnb_folio_vs_gl_monthly').select('*')
      .order('period_yyyymm', { ascending: false }).limit(24),
  );
}

// ─── F&B labour (the honest one) ───────────────────────────────────────────
// PBS 2026-08-27. The Cost tab previously read v_labour_cost_ratio_monthly,
// which is WHOLE-HOTEL payroll ÷ ROOMS revenue — neither kitchen nor F&B. On
// the F&B page it overstated kitchen payroll by 7-12x and divided by the wrong
// denominator, so June read 108.5% when the kitchen was actually at 75.2% and
// August read 66.9% when it had improved to 27.6%. It told the opposite story.
//
// TENANT GUARD: v_payroll_dept_monthly has NO property_id column. Rendering it
// for any property other than Namkhan would show Namkhan's payroll on another
// tenant's page. Returns empty for everyone else so the container goes dormant
// instead of leaking (L22).

export interface FbLabourRow {
  month: string;
  kitchenCost: number;
  headcount: number | null;
  fbRevenue: number;
  ratioPct: number | null;
}

export async function getFbLabour(
  pid: number, namkhanId: number, fromMonth: string,
): Promise<FbLabourRow[]> {
  if (pid !== namkhanId) return [];
  const sb = getSupabaseAdmin();

  const [payroll, txns] = await Promise.all([
    safe<Record<string, unknown>>(
      sb.from('v_payroll_dept_monthly')
        .select('period_month, headcount, total_canonical_cost_usd')
        .eq('dept_code', 'kitchen')
        .gte('period_month', fromMonth)
        .order('period_month'),
    ),
    safe<{ transaction_date: string | null; amount: number | string | null }>(
      sb.from('v_fnb_raw_txn_enriched')
        .select('transaction_date, amount')
        .eq('property_id', pid)
        .eq('transaction_type', 'debit')
        .gte('transaction_date', fromMonth)
        .limit(50000),
    ),
  ]);

  const revByMonth = new Map<string, number>();
  for (const t of txns) {
    const m = String(t.transaction_date ?? '').slice(0, 7);
    if (!m) continue;
    revByMonth.set(m, (revByMonth.get(m) ?? 0) + Number(t.amount ?? 0));
  }

  return payroll.map((r) => {
    const month = String(r.period_month ?? '').slice(0, 7);
    const kitchenCost = Number(r.total_canonical_cost_usd ?? 0);
    const fbRevenue = revByMonth.get(month) ?? 0;
    return {
      month,
      kitchenCost,
      headcount: r.headcount == null ? null : Number(r.headcount),
      fbRevenue,
      ratioPct: fbRevenue > 0 ? Math.round((kitchenCost / fbRevenue) * 1000) / 10 : null,
    };
  }).filter((r) => r.month);
}
