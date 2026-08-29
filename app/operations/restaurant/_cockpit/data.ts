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
    // v_fnb_raw_txn_enriched is NOT F&B-only despite the name — it carries the
    // nightly room rate, tax and fee postings plus spa and transport. Without
    // this filter 76% of what the feed showed was not F&B.
    .eq('usali_dept', 'F&B')
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
      .eq('usali_dept', 'F&B')
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

// ─── Service clock ─────────────────────────────────────────────────────────
// PBS 2026-08-27. When is the work actually happening? Every posting carries a
// local timestamp, so the hour it was billed is a usable proxy for when it was
// consumed — but ONLY once room rate / tax / fee are excluded. Those post in a
// nightly batch at 00:00 and, unfiltered, put 1,855 phantom lines and $103k at
// midnight, which would have read as the busiest hour of the day.
//
// Minibar is kept separate deliberately: it is in-room consumption and needs no
// one on the floor, so counting it as service demand would overstate the
// morning shift.

export interface ServiceHour {
  hour: number;
  lines: number;
  revenue: number;
  food: number;
  beverage: number;
  minibar: number;
  linesPerDay: number;
}

export async function getServiceClock(
  pid: number, fromIso: string, toIso: string,
): Promise<ServiceHour[]> {
  const sb = getSupabaseAdmin();
  const rows = await safe<{
    local_laos_dt: string | null; amount: number | string | null;
    usali_subdept: string | null; transaction_date: string | null;
  }>(
    sb.from('v_fnb_raw_txn_enriched')
      .select('local_laos_dt, amount, usali_subdept, transaction_date')
      .eq('property_id', pid)
      .eq('transaction_type', 'debit')
      .eq('usali_dept', 'F&B')
      .gte('transaction_date', fromIso)
      .lte('transaction_date', `${toIso}T23:59:59`)
      .limit(50000),
  );

  const byHour = new Map<number, ServiceHour & { days: Set<string> }>();
  for (const r of rows) {
    const dt = r.local_laos_dt;
    if (!dt) continue;
    const hour = Number(String(dt).slice(11, 13));
    if (!Number.isFinite(hour)) continue;
    const day = String(dt).slice(0, 10);
    const e = byHour.get(hour) ?? {
      hour, lines: 0, revenue: 0, food: 0, beverage: 0, minibar: 0,
      linesPerDay: 0, days: new Set<string>(),
    };
    e.lines += 1;
    e.revenue += Number(r.amount ?? 0);
    if (r.usali_subdept === 'Food') e.food += 1;
    else if (r.usali_subdept === 'Beverage') e.beverage += 1;
    else if (r.usali_subdept === 'Minibar') e.minibar += 1;
    e.days.add(day);
    byHour.set(hour, e);
  }

  return [...byHour.values()]
    .map(({ days, ...h }) => ({
      ...h,
      revenue: Math.round(h.revenue),
      linesPerDay: days.size > 0 ? Math.round((h.lines / days.size) * 10) / 10 : 0,
    }))
    .sort((a, b) => a.hour - b.hour);
}

// ─── Real F&B revenue, and what is wrong with the classification ───────────
// PBS 2026-08-27.
//
// The Cost tab's percentage came from gl.v_fnb_cos_monthly.food_cost_pct, whose
// denominator is food_rev + breakfast_alloc — NOT "effective revenue" as the
// page claimed. Worse, from June the GL carries no F&B revenue at all while the
// breakfast allocation continues, so effective_rev becomes a pure notional
// reclass ($1,130 / $2,380 / $2,380) with no sales behind it. Meanwhile the
// folio recorded $5,810 / $9,294 / $7,881 of actual F&B in those months.
//
// So the page now shows both: what the ledger says, and what the till says.

export interface MonthRevenue { month: string; folioRevenue: number }

export async function getFbRevenueByMonth(pid: number, fromMonth: string): Promise<MonthRevenue[]> {
  const sb = getSupabaseAdmin();
  const rows = await safe<{ transaction_date: string | null; amount: number | string | null }>(
    sb.from('v_fnb_raw_txn_enriched')
      .select('transaction_date, amount')
      .eq('property_id', pid)
      .eq('transaction_type', 'debit')
      .eq('usali_dept', 'F&B')
      .gte('transaction_date', fromMonth)
      .limit(50000),
  );
  const by = new Map<string, number>();
  for (const r of rows) {
    const m = String(r.transaction_date ?? '').slice(0, 7);
    if (m) by.set(m, (by.get(m) ?? 0) + Number(r.amount ?? 0));
  }
  return [...by.entries()].map(([month, folioRevenue]) => ({ month, folioRevenue: Math.round(folioRevenue) }))
    .sort((a, b) => a.month.localeCompare(b.month));
}

export interface ClassIssue { kind: string; label: string; lines: number; revenue: number; note: string }

/**
 * Categories that are filed wrongly, or filed twice.
 *
 * Not fixable from this page — it is a POS vocabulary problem — but a manager
 * reading a menu report is entitled to know which rows are lying to them.
 */
export async function getClassificationIssues(pid: number, fromIso: string): Promise<ClassIssue[]> {
  const sb = getSupabaseAdmin();
  const rows = await safe<{
    item_category_name: string | null; usali_dept: string | null;
    usali_subdept: string | null; amount: number | string | null;
  }>(
    sb.from('v_fnb_raw_txn_enriched')
      .select('item_category_name, usali_dept, usali_subdept, amount')
      .eq('property_id', pid)
      .eq('transaction_type', 'debit')
      .gte('transaction_date', fromIso)
      .limit(50000),
  );

  const agg = new Map<string, { lines: number; revenue: number; dept: string }>();
  for (const r of rows) {
    const name = (r.item_category_name ?? '').trim();
    if (!name || ['rate', 'tax', 'fee'].includes(name)) continue;
    const k = `${r.usali_dept ?? '—'}||${name}`;
    const a = agg.get(k) ?? { lines: 0, revenue: 0, dept: r.usali_dept ?? '—' };
    a.lines += 1; a.revenue += Number(r.amount ?? 0);
    agg.set(k, a);
  }

  const out: ClassIssue[] = [];

  // (a) non-F&B things filed under F&B
  const NOT_FB = /activity|activities|transport|spa|laundry|excursion|tour/i;
  for (const [k, a] of agg) {
    const name = k.split('||')[1];
    if (a.dept === 'F&B' && NOT_FB.test(name)) {
      out.push({ kind: 'wrong department', label: name, lines: a.lines, revenue: Math.round(a.revenue),
                 note: 'filed under F&B but is not food or drink' });
    }
  }

  // (b) the same product under two spellings — case/whitespace collisions
  const byNorm = new Map<string, string[]>();
  for (const k of agg.keys()) {
    const name = k.split('||')[1];
    const norm = name.toLowerCase().replace(/\s+/g, ' ').trim();
    byNorm.set(norm, [...(byNorm.get(norm) ?? []), name]);
  }
  for (const [, names] of byNorm) {
    const uniq = [...new Set(names)];
    if (uniq.length > 1) {
      const lines = uniq.reduce((s, n) => s + ([...agg.entries()].find(([k]) => k.endsWith(`||${n}`))?.[1].lines ?? 0), 0);
      const revenue = uniq.reduce((s, n) => s + ([...agg.entries()].find(([k]) => k.endsWith(`||${n}`))?.[1].revenue ?? 0), 0);
      out.push({ kind: 'split by spelling', label: uniq.join('  /  '), lines, revenue: Math.round(revenue),
                 note: 'one product, two spellings — every report splits it in half' });
    }
  }

  // (c) generic buckets carrying real money
  const GENERIC = /^(product|other products|addon|generic|menus|meals|mains|to eat)$/i;
  for (const [k, a] of agg) {
    const name = k.split('||')[1];
    if (GENERIC.test(name) && a.revenue > 100) {
      out.push({ kind: 'generic bucket', label: name, lines: a.lines, revenue: Math.round(a.revenue),
                 note: 'no menu meaning — invisible to any dish-level decision' });
    }
  }

  return out.sort((x, y) => y.revenue - x.revenue).slice(0, 12);
}

// ─── Today KPI matrix ──────────────────────────────────────────────────────
// PBS 2026-08-27. Four tiles could not carry it: the manager wants every KPI
// across every timeframe with last year beside it. Metrics down, periods
// across — same shape as the Revenue HoD matrix.
//
// Minibar is its own row throughout. It is F&B and stays in the totals, but it
// is in-room self-service: counting it inside "restaurant" flatters covers and
// hides that the floor was quiet.

export interface FbPeriodStats {
  restaurant: number;
  minibar: number;
  total: number;
  folios: number;
  lines: number;
  avgPerFolio: number | null;
}

export interface FbKpiCell { ty: FbPeriodStats; ly: FbPeriodStats }

export type FbPeriodKey = 'today' | 'yesterday' | 'last7' | 'last30';

const EMPTY_STATS: FbPeriodStats = {
  restaurant: 0, minibar: 0, total: 0, folios: 0, lines: 0, avgPerFolio: null,
};

function statsFrom(rows: Array<{ amount: number | string | null; usali_subdept: string | null; reservation_id: string | number | null }>): FbPeriodStats {
  let restaurant = 0, minibar = 0, lines = 0;
  const folios = new Set<string>();
  for (const r of rows) {
    const amt = Number(r.amount ?? 0);
    if (r.usali_subdept === 'Minibar') minibar += amt; else restaurant += amt;
    lines += 1;
    const f = String(r.reservation_id ?? '');
    if (f) folios.add(f);
  }
  const total = restaurant + minibar;
  return {
    restaurant: Math.round(restaurant),
    minibar: Math.round(minibar),
    total: Math.round(total),
    folios: folios.size,
    lines,
    avgPerFolio: folios.size > 0 ? Math.round(total / folios.size) : null,
  };
}

/** Every KPI across today / yesterday / 7d / 30d, each against the same window last year. */
export async function getFbKpiMatrix(
  pid: number, todayIso: string,
): Promise<Record<FbPeriodKey, FbKpiCell>> {
  const sb = getSupabaseAdmin();
  const shiftYear = (iso: string) => {
    const [y, m, d] = iso.split('-').map(Number);
    const last = new Date(Date.UTC(y - 1, m, 0)).getUTCDate();
    return `${y - 1}-${String(m).padStart(2, '0')}-${String(Math.min(d, last)).padStart(2, '0')}`;
  };
  const windows: Record<FbPeriodKey, [string, string]> = {
    today:     [todayIso, todayIso],
    yesterday: [addDays(todayIso, -1), addDays(todayIso, -1)],
    last7:     [addDays(todayIso, -6), todayIso],
    last30:    [addDays(todayIso, -29), todayIso],
  };

  const pull = (from: string, to: string) => safe<{
    amount: number | string | null; usali_subdept: string | null; reservation_id: string | number | null;
  }>(
    sb.from('v_fnb_raw_txn_enriched')
      .select('amount, usali_subdept, reservation_id')
      .eq('property_id', pid).eq('transaction_type', 'debit').eq('usali_dept', 'F&B')
      .gte('transaction_date', from).lte('transaction_date', `${to}T23:59:59`)
      .limit(20000),
  );

  const keys = Object.keys(windows) as FbPeriodKey[];
  const results = await Promise.all(keys.flatMap((k) => {
    const [f, t] = windows[k];
    return [pull(f, t), pull(shiftYear(f), shiftYear(t))];
  }));

  const out = {} as Record<FbPeriodKey, FbKpiCell>;
  keys.forEach((k, i) => {
    out[k] = { ty: statsFrom(results[i * 2] ?? []), ly: statsFrom(results[i * 2 + 1] ?? []) };
  });
  return out;
}

/** Feed rows with the detail a manager asks for: which room, who, which waiter. */
export interface FeedDetailRow extends TxnRow {
  room_name: string | null;
  guest_name: string | null;
  user_name: string | null;
  usali_subdept: string | null;
}

export async function getFeedDetail(
  pid: number, fromIso: string, toIso: string, q?: string, limit = 300,
): Promise<FeedDetailRow[]> {
  const sb = getSupabaseAdmin();
  let query = sb.from('v_fnb_raw_txn_enriched')
    .select('transaction_id, local_laos_str, transaction_date, description, item_category_name, amount, reservation_id, room_name, guest_name, user_name, usali_subdept')
    .eq('property_id', pid)
    .eq('transaction_type', 'debit')
    .eq('usali_dept', 'F&B')
    .gte('transaction_date', fromIso)
    .lte('transaction_date', `${toIso}T23:59:59`)
    .order('transaction_date', { ascending: false })
    .limit(limit);
  const term = (q ?? '').trim();
  if (term) {
    const s = term.replace(/[%,()]/g, ' ');
    query = query.or(`description.ilike.%${s}%,item_category_name.ilike.%${s}%,room_name.ilike.%${s}%,guest_name.ilike.%${s}%,user_name.ilike.%${s}%`);
  }
  return safe<FeedDetailRow>(query);
}
