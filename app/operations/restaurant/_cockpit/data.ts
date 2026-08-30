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

export interface FbPnlRow {
  month: string;
  glRevenue: number;
  glCost: number;
  costPct: number | null;
}

/**
 * F&B revenue and cost of sales straight from the live P&L.
 *
 * WAS gl.v_fnb_cos_monthly, which reads the gl.mv_usali_pl_monthly MATERIALIZED
 * view. That matview is stale — it stops at 2026-06 with 14 rows, while
 * public.v_pl_monthly_by_property carries 1,791 rows through 2026-08. The page
 * therefore reported June cost as $61 when the ledger says $3,686, and printed
 * "not posted" for July and August when both are posted. A stale matview and an
 * unposted month look identical from the outside; only one of them is true.
 *
 * Food AND beverage together: a restaurant buys both, and splitting them here
 * only invited the same mistake twice.
 */
export async function getFoodCost(pid: number, year: string): Promise<FbPnlRow[]> {
  const sb = getSupabaseAdmin();
  const rows = await safe<{
    period_yyyymm: string | null; usali_subcategory: string | null;
    usali_line_label: string | null; amount_usd: number | string | null;
  }>(
    sb.from('v_pl_monthly_by_property')
      .select('period_yyyymm, usali_subcategory, usali_line_label, amount_usd')
      .eq('property_id', pid)
      .like('period_yyyymm', `${year}%`)
      .limit(5000),
  );

  const by = new Map<string, { rev: number; cost: number }>();
  for (const r of rows) {
    const label = String(r.usali_line_label ?? '');
    if (!/food|beverage/i.test(label)) continue;
    const m = String(r.period_yyyymm ?? '');
    if (!m) continue;
    const e = by.get(m) ?? { rev: 0, cost: 0 };
    const amt = Number(r.amount_usd ?? 0);
    if (r.usali_subcategory === 'Revenue') e.rev += amt;
    else if (r.usali_subcategory === 'Cost of Sales') e.cost += amt;
    by.set(m, e);
  }

  return [...by.entries()]
    .map(([month, v]) => ({
      month,
      glRevenue: Math.round(v.rev),
      glCost: Math.round(v.cost),
      costPct: v.rev > 0 ? Math.round((v.cost / v.rev) * 1000) / 10 : null,
    }))
    .filter((r) => r.glRevenue !== 0 || r.glCost !== 0)
    .sort((a, b) => a.month.localeCompare(b.month));
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

// revByMonth: Map<'YYYY-MM', folioRevenue> — callers supply this from
// getFbRevenueByMonth (usali_dept='F&B' filtered) so we never re-query with
// the wrong scope. The old inline txn query lacked .eq('usali_dept','F&B')
// and counted room charges, inflating the denominator.
export async function getFbLabour(
  pid: number, namkhanId: number, fromMonth: string,
  revByMonth: Map<string, number>,
): Promise<FbLabourRow[]> {
  if (pid !== namkhanId) return [];
  const sb = getSupabaseAdmin();

  const payroll = await safe<Record<string, unknown>>(
    sb.from('v_payroll_dept_monthly')
      .select('period_month, headcount, total_canonical_cost_usd')
      .eq('dept_code', 'kitchen')
      .gte('period_month', fromMonth)
      .order('period_month'),
  );

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

export type FbPeriodKey = 'today' | 'yesterday' | 'last7' | 'last30' | 'ytd';

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
    ytd:       [`${todayIso.slice(0, 4)}-01-01`, todayIso],
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

export interface FbCaptureStats {
  folioRev: number;
  coverDays: number;
  avgCheck: number | null;
  capturePct: number | null;
  spendPerOcc: number | null;
}

/** Folio-based capture metrics by period (v_fb_outlet_daily + v_ancillary_capture_daily). */
export async function getFbCaptureMatrix(
  pid: number, todayIso: string,
): Promise<Record<FbPeriodKey, FbCaptureStats>> {
  const sb = getSupabaseAdmin();
  const yr = todayIso.slice(0, 4);
  const janFirst = `${yr}-01-01`;
  const windows: Record<FbPeriodKey, [string, string]> = {
    today:     [todayIso, todayIso],
    yesterday: [addDays(todayIso, -1), addDays(todayIso, -1)],
    last7:     [addDays(todayIso, -6), todayIso],
    last30:    [addDays(todayIso, -29), todayIso],
    ytd:       [janFirst, todayIso],
  };

  // Fetch all rows since Jan 1 then filter client-side per window — avoids 10+ round trips.
  const [outletRows, captureRows] = await Promise.all([
    safe<{ service_date: string; revenue: number | string | null; reservations: number | null }>(
      sb.from('v_fb_outlet_daily')
        .select('service_date, revenue, reservations')
        .eq('property_id', pid)
        .gte('service_date', addDays(todayIso, -29))
        .lte('service_date', todayIso),
    ),
    safe<{ night_date: string; occupied_rooms: number | null; fb_capturing_rooms: number | null }>(
      sb.from('v_ancillary_capture_daily')
        .select('night_date, occupied_rooms, fb_capturing_rooms')
        .eq('property_id', pid)
        .gte('night_date', addDays(todayIso, -29))
        .lte('night_date', todayIso),
    ),
  ]);

  // For YTD we need the full year range, not just last-30 → run a separate pull if ytd starts before last30.
  const ytdFrom = janFirst;
  const last30From = addDays(todayIso, -29);
  const needYtdExtension = ytdFrom < last30From;

  let ytdOutlet: typeof outletRows = outletRows;
  let ytdCapture: typeof captureRows = captureRows;
  if (needYtdExtension) {
    const [yo, yc] = await Promise.all([
      safe<{ service_date: string; revenue: number | string | null; reservations: number | null }>(
        sb.from('v_fb_outlet_daily')
          .select('service_date, revenue, reservations')
          .eq('property_id', pid)
          .gte('service_date', ytdFrom)
          .lt('service_date', last30From),
      ),
      safe<{ night_date: string; occupied_rooms: number | null; fb_capturing_rooms: number | null }>(
        sb.from('v_ancillary_capture_daily')
          .select('night_date, occupied_rooms, fb_capturing_rooms')
          .eq('property_id', pid)
          .gte('night_date', ytdFrom)
          .lt('night_date', last30From),
      ),
    ]);
    ytdOutlet = [...yo, ...outletRows];
    ytdCapture = [...yc, ...captureRows];
  }

  const out = {} as Record<FbPeriodKey, FbCaptureStats>;
  for (const key of Object.keys(windows) as FbPeriodKey[]) {
    const [from, to] = windows[key];
    const src = key === 'ytd' ? ytdOutlet : outletRows;
    const cap = key === 'ytd' ? ytdCapture : captureRows;

    const outlet = src.filter((r) => r.service_date >= from && r.service_date <= to);
    const night  = cap.filter((r) => r.night_date >= from && r.night_date <= to);

    const folioRev  = outlet.reduce((s, r) => s + Number(r.revenue ?? 0), 0);
    const coverDays = outlet.reduce((s, r) => s + Number(r.reservations ?? 0), 0);
    const occRooms  = night.reduce((s, r) => s + Number(r.occupied_rooms ?? 0), 0);
    const capRooms  = night.reduce((s, r) => s + Number(r.fb_capturing_rooms ?? 0), 0);

    out[key] = {
      folioRev:   Math.round(folioRev),
      coverDays,
      avgCheck:   coverDays > 0 ? Math.round(folioRev / coverDays) : null,
      capturePct: occRooms > 0 ? Math.round((capRooms / occRooms) * 1000) / 10 : null,
      spendPerOcc: occRooms > 0 ? Math.round(folioRev / occRooms) : null,
    };
  }
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

// ─── Menu items, by year, sortable ─────────────────────────────────────────
// PBS 2026-08-27. v_dept_top_seller_trend carries property_id, usali_dept and a
// `monthly` JSONB keyed YYYY-MM with {rev, units} — so per-year revenue, units
// and average selling price are all derivable without new DDL. Preferred over
// v_fb_top_seller_trend, which has no property_id and would show Namkhan's menu
// on any other property.

export type MenuSort = 'revenue' | 'units' | 'price' | 'last' | 'name' | 'category';

export interface MenuItem {
  name: string;
  subdept: string;
  revenue: number;
  units: number;
  avgPrice: number | null;
  lastSold: string | null;
  monthsActive: number;
}

interface MonthlyBucket { rev?: number | string; units?: number | string }

export async function getMenuYears(pid: number): Promise<string[]> {
  const rows = await getMenuRaw(pid);
  const years = new Set<string>();
  for (const r of rows) {
    for (const k of Object.keys(r.monthly ?? {})) years.add(k.slice(0, 4));
  }
  return [...years].sort().reverse();
}

async function getMenuRaw(pid: number): Promise<Array<{
  description: string | null; usali_subdept: string | null; last_sold: string | null;
  monthly: Record<string, MonthlyBucket> | null;
}>> {
  const sb = getSupabaseAdmin();
  return safe(
    sb.from('v_dept_top_seller_trend')
      .select('description, usali_subdept, last_sold, monthly')
      .eq('property_id', pid)
      .eq('usali_dept', 'F&B')
      .limit(2000),
  );
}

/**
 * Every F&B product sold in the chosen year, with its average selling price.
 *
 * Average price is revenue ÷ units for that year only — a dish whose price
 * changed mid-year shows the blended rate, which is what was actually achieved
 * rather than what the menu claims.
 */
export async function getMenuItems(
  pid: number, year: string, sort: MenuSort = 'revenue', dir: 'asc' | 'desc' = 'desc',
): Promise<MenuItem[]> {
  const raw = await getMenuRaw(pid);
  const items: MenuItem[] = [];

  for (const r of raw) {
    const monthly = r.monthly ?? {};
    let revenue = 0, units = 0, months = 0;
    for (const [k, v] of Object.entries(monthly)) {
      if (!k.startsWith(year)) continue;
      const rev = Number(v?.rev ?? 0);
      const u = Number(v?.units ?? 0);
      if (rev === 0 && u === 0) continue;
      revenue += rev; units += u; months += 1;
    }
    if (months === 0) continue; // not sold in this year at all
    items.push({
      name: String(r.description ?? '—'),
      subdept: String(r.usali_subdept ?? '—'),
      revenue: Math.round(revenue),
      units,
      avgPrice: units > 0 ? Math.round((revenue / units) * 100) / 100 : null,
      lastSold: r.last_sold,
      monthsActive: months,
    });
  }

  const mul = dir === 'asc' ? 1 : -1;
  items.sort((a, b) => {
    switch (sort) {
      case 'units':    return (a.units - b.units) * mul;
      case 'price':    return ((a.avgPrice ?? 0) - (b.avgPrice ?? 0)) * mul;
      case 'last':     return String(a.lastSold ?? '').localeCompare(String(b.lastSold ?? '')) * mul;
      case 'name':     return a.name.localeCompare(b.name) * mul;
      case 'category': return (a.subdept.localeCompare(b.subdept) || b.revenue - a.revenue) * mul;
      default:         return (a.revenue - b.revenue) * mul;
    }
  });
  return items;
}

// ─── Breakfast posted vs pax in house ──────────────────────────────────────
// PBS 2026-08-27: every rate includes breakfast, so pax-nights in house should
// equal breakfast covers, at a $12 internal transfer price.
//
// CAVEAT THAT LIMITS THIS ENTIRELY: pms.v_reservations.adults stopped being
// populated around May 2026 — present on 127/127 January reservations but only
// 9/80 in August. Months after April cannot be compared at all, and saying so
// is the only honest option; filling the gap with zeros would invent a shortfall.

export interface BreakfastCheck {
  month: string;
  paxNights: number | null;
  reservationsWithPax: number;
  reservationsTotal: number;
  expectedUsd: number | null;
  postedUsd: number;
  coverage: number;
}

export async function getBreakfastCheck(
  pid: number, fromMonth: string, transferPrice = 12,
): Promise<BreakfastCheck[]> {
  const sb = getSupabaseAdmin();
  const [alloc, res] = await Promise.all([
    safe<{ period_yyyymm: string; alloc_usd: number | string | null }>(
      sb.from('v_breakfast_allocation_monthly')
        .select('period_yyyymm, alloc_usd').eq('property_id', pid)
        .gte('period_yyyymm', fromMonth.slice(0, 7)).order('period_yyyymm'),
    ),
    safe<{ check_in_date: string | null; check_out_date: string | null; adults: number | null; children: number | null }>(
      sb.from('v_reservations_unified')
        .select('check_in_date, check_out_date, adults, children')
        .eq('property_id', pid).gte('check_in_date', fromMonth).limit(5000),
    ),
  ]);

  const pax = new Map<string, { nights: number; withPax: number; total: number }>();
  for (const r of res) {
    const ci = r.check_in_date, co = r.check_out_date;
    if (!ci || !co) continue;
    const m = ci.slice(0, 7);
    const nights = Math.max(0, (Date.parse(co) - Date.parse(ci)) / 86400000);
    const e = pax.get(m) ?? { nights: 0, withPax: 0, total: 0 };
    e.total += 1;
    if (r.adults != null) {
      e.withPax += 1;
      e.nights += (Number(r.adults) + Number(r.children ?? 0)) * nights;
    }
    pax.set(m, e);
  }

  return alloc.map((a) => {
    const m = a.period_yyyymm;
    const p = pax.get(m);
    const coverage = p && p.total > 0 ? Math.round((p.withPax / p.total) * 100) : 0;
    const usable = coverage >= 80;
    return {
      month: m,
      paxNights: usable ? Math.round(p!.nights) : null,
      reservationsWithPax: p?.withPax ?? 0,
      reservationsTotal: p?.total ?? 0,
      expectedUsd: usable ? Math.round(p!.nights * transferPrice) : null,
      postedUsd: Math.round(Number(a.alloc_usd ?? 0)),
      coverage,
    };
  });
}
