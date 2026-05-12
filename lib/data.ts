// lib/data.ts
// Period-aware data fetchers. Every relevant function accepts ResolvedPeriod
// and applies its from/to/segment/compare values instead of hardcoded windows.
//
// IMPORTANT: This is a DROP-IN REPLACEMENT for the existing lib/data.ts.
// Function names are preserved. Helpers `defaultDailyRange` and `defaultMonthRange`
// are kept as fallbacks for any code that hasn't been migrated yet.
//
// Pattern in pages:
//   const period = resolvePeriod(searchParams);
//   const daily = await getKpiDaily(period);
//   const agg   = aggregateDaily(daily);

import { supabase, PROPERTY_ID } from './supabase';
import type { ResolvedPeriod, Segment } from './period';
import { segmentFilter } from './period';

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Apply segment filter to a Supabase query. Currently filters by `source` /
 * `source_name` in views that have it. Pass the column name your view uses.
 *
 * NOTE on caveat: most KPI views (mv_kpi_daily, mv_kpi_today, mv_capture_rates)
 * are NOT segment-partitioned at the DB level. Filtering by segment on those
 * views returns the same numbers regardless. Only mv_channel_perf and
 * reservations-derived queries respect segment today.
 *
 * Phase 2 backlog: rebuild kpi/capture views with segment dimension.
 */
function applySegment<T>(query: any, period: ResolvedPeriod, column = 'market_segment'): any {
  const seg = segmentFilter(period.seg);
  // Override default column if caller passes one explicitly (e.g. 'source' for mv_channel_perf).
  // Otherwise use seg.column ('market_segment') from the new mapping.
  const col = seg.column ? column : null;
  if (seg.isNull && col) {
    return query.is(col, null);
  }
  if (col && seg.values && seg.values.length > 0) {
    return query.in(col, seg.values);
  }
  return query;
}

// ============================================================================
// TODAY (snapshot, period-independent)
// ============================================================================

export async function getKpiToday() {
  const { data, error } = await supabase
    .from('mv_kpi_today')
    .select('*')
    .eq('property_id', PROPERTY_ID)
    .single();
  if (error) throw error;
  return data;
}

// ============================================================================
// OVERVIEW — canonical wiring per Cowork audit 2026-05-03
// ============================================================================
// Source-of-truth views/functions deployed in Supabase:
//   - public.v_overview_live           (LIVE strip — In-house, arrivals, OTB, cancel%, no-show%)
//   - public.v_overview_dq             (DQ tile — column action_required)
//   - public.f_overview_kpis(p_window, p_compare, p_segment)  (Performance + capture rows, both USD AND LAK columns)
// Brief: "Use the new overview wiring (already deployed). Do not invent new queries when these already exist."

const WIN_MAP: Record<string, string> = {
  today:   'TODAY',
  '7d':    '7D',
  '30d':   '30D',
  '90d':   '90D',
  ytd:     'YTD',
  l12m:    'YTD',         // l12m is non-canonical per brief; coerce to nearest valid
  next7:   'NEXT_7',
  next30:  'NEXT_30',
  next90:  'NEXT_90',
  next180: 'NEXT_90',     // non-canonical; coerce
  next365: 'NEXT_90',     // non-canonical; coerce
};
// 2026-05-12: compare_bounds() now natively understands STLY/SDLY/LW/LM as
// distinct ranges. Was previously collapsing both STLY+SDLY → YOY and both
// LW+LM → PREV_PERIOD, which made compare deltas identical across multiple
// selector buttons. Pass-through the keys; SQL handles case-insensitively.
const CMP_MAP: Record<string, string> = {
  none:   'NONE',
  pp:     'PREV_PERIOD',
  stly:   'STLY',
  sdly:   'SDLY',
  lw:     'LW',
  lm:     'LM',
  budget: 'NONE',         // budget compare is wired via separate views, not f_overview_kpis
};
// SegmentKey -> reservations.market_segment text the function expects.
// 'all' and 'unsegmented' both map to NULL (no filter).
const SEG_MAP: Record<string, string | null> = {
  all:         null,
  retail:      'Retail',
  dmc:         'DMC',
  group:       'Group Bookings',
  discount:    'Discount',
  comp:        'Comp',
  unsegmented: null,
};

export async function getOverviewLive() {
  const { data, error } = await supabase
    .from('v_overview_live')
    .select('*')
    .eq('property_id', PROPERTY_ID)
    .single();
  if (error) throw error;
  return data;
}

export async function getOverviewDqSummary() {
  const { data, error } = await supabase
    .from('v_overview_dq')
    .select('*')
    .single();
  if (error) throw error;
  return data;
}

/**
 * Period KPIs from f_overview_kpis. Returns { current, compare? } objects with
 * BOTH usd and lak columns (no FX multiplication anywhere).
 *
 * If the period.win value is non-canonical (l12m, next180, next365), it's
 * coerced to the nearest valid f_overview_kpis enum value.
 *
 * Uses the anon client. Function is `SECURITY DEFINER` (set 2026-05-03 via
 * Cowork audit) and runs as `postgres`, so it bypasses downstream RLS on
 * mv_kpi_daily and auth_ext. Search_path is locked to `public, pg_temp` to
 * prevent path-injection. EXECUTE granted to anon/authenticated/service_role.
 */
export async function getOverviewKpis(period: ResolvedPeriod) {
  const win = WIN_MAP[period.win] ?? '30D';
  const cmp = CMP_MAP[period.cmp] ?? 'NONE';
  const seg = SEG_MAP[period.seg] ?? null;
  const { data, error } = await supabase.rpc('f_overview_kpis', {
    p_window:  win,
    p_compare: cmp,
    p_segment: seg,
  });
  if (error) throw error;
  const rows = (data ?? []) as any[];
  const current = rows.find((r: any) => r.period_kind === 'current') ?? null;
  const compare = rows.find((r: any) => r.period_kind === 'compare') ?? null;
  return { current, compare };
}

export async function getOverviewSegments() {
  const { data, error } = await supabase
    .from('v_overview_segments')
    .select('*')
    .order('sort_order')
    .order('segment');
  if (error) throw error;
  return data ?? [];
}

// ============================================================================
// DAILY KPI — drives Overview, Pulse, Departments, P&L cards
// ============================================================================

/**
 * NEW signature accepting ResolvedPeriod.
 * Backwards compatibility: if old callers pass (from: string, to: string),
 * we still honor that — see overload below.
 */
export async function getKpiDaily(period: ResolvedPeriod): Promise<any[]>;
export async function getKpiDaily(fromDate: string, toDate: string): Promise<any[]>;
export async function getKpiDaily(a: ResolvedPeriod | string, b?: string): Promise<any[]> {
  let from: string, to: string;
  if (typeof a === 'string') {
    from = a; to = b!;
  } else {
    from = a.from; to = a.to;
  }

  const { data, error } = await supabase
    .from('mv_kpi_daily')
    .select('*')
    .eq('property_id', PROPERTY_ID)
    .gte('night_date', from)
    .lte('night_date', to)
    .order('night_date', { ascending: true });
  if (error) throw error;
  return data ?? [];
}

/**
 * STLY/Prior comparison fetcher. Returns null if period.cmp is empty/budget.
 */
export async function getKpiDailyCompare(period: ResolvedPeriod): Promise<any[] | null> {
  if (!period.compareFrom || !period.compareTo) return null;
  const { data, error } = await supabase
    .from('mv_kpi_daily')
    .select('*')
    .eq('property_id', PROPERTY_ID)
    .gte('night_date', period.compareFrom)
    .lte('night_date', period.compareTo)
    .order('night_date', { ascending: true });
  if (error) return null;
  return data ?? [];
}

// ============================================================================
// USALI MONTHLY
// ============================================================================

export async function getRevenueByUsali(period: ResolvedPeriod): Promise<any[]>;
export async function getRevenueByUsali(fromMonth: string, toMonth: string): Promise<any[]>;
export async function getRevenueByUsali(a: ResolvedPeriod | string, b?: string): Promise<any[]> {
  let fromMonth: string, toMonth: string;
  if (typeof a === 'string') {
    fromMonth = a; toMonth = b!;
  } else {
    // For monthly USALI we want the trailing 12 months ending in the period's `to` month,
    // OR the period range if it spans more than 1 month.
    const toDate = new Date(a.to + 'T00:00:00Z');
    const fromDate = new Date(a.from + 'T00:00:00Z');
    const spanMonths =
      (toDate.getUTCFullYear() - fromDate.getUTCFullYear()) * 12 +
      (toDate.getUTCMonth() - fromDate.getUTCMonth());

    if (spanMonths >= 1) {
      // Use the period's own range, snapped to month-firsts
      fromMonth = `${fromDate.getUTCFullYear()}-${String(fromDate.getUTCMonth() + 1).padStart(2, '0')}-01`;
      toMonth = `${toDate.getUTCFullYear()}-${String(toDate.getUTCMonth() + 2).padStart(2, '0')}-01`;
    } else {
      // Sub-month period — show trailing 12 months ending at period.to
      const back = new Date(Date.UTC(toDate.getUTCFullYear() - 1, toDate.getUTCMonth(), 1));
      fromMonth = `${back.getUTCFullYear()}-${String(back.getUTCMonth() + 1).padStart(2, '0')}-01`;
      toMonth = `${toDate.getUTCFullYear()}-${String(toDate.getUTCMonth() + 2).padStart(2, '0')}-01`;
    }
  }

  const { data, error } = await supabase
    .from('mv_revenue_by_usali_dept')
    .select('*')
    .eq('property_id', PROPERTY_ID)
    .gte('month', fromMonth)
    .lte('month', toMonth)
    .order('month', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

// ============================================================================
// CHANNELS
// ============================================================================

/**
 * Channel performance. The mat view today has fixed-window columns
 * (revenue_30d, revenue_90d, etc.). We accept ResolvedPeriod so the page
 * shows the appropriate column AND we filter zero-revenue channels.
 *
 * Backwards-compatible: still callable with no args.
 */
export async function getChannelPerf(period?: ResolvedPeriod): Promise<any[]> {
  let query = supabase
    .from('mv_channel_perf')
    .select('*')
    .eq('property_id', PROPERTY_ID);

  // Pick the order column based on period length (best available without view changes)
  const orderCol = period && period.days <= 35 ? 'revenue_30d' : 'revenue_90d';

  query = query.order(orderCol, { ascending: false, nullsFirst: false });

  if (period) {
    query = applySegment(query, period, 'source');
  }

  const { data, error } = await query;
  if (error) throw error;
  // Drop zero-revenue rows (audit fix H5)
  return (data ?? []).filter((c: any) =>
    Number(c.revenue_30d || 0) > 0 ||
    Number(c.revenue_90d || 0) > 0 ||
    Number(c.bookings_30d || 0) > 0 ||
    Number(c.bookings_90d || 0) > 0
  );
}

// ============================================================================
// PACE
// ============================================================================

export async function getPaceOtb(period?: ResolvedPeriod) {
  let query = supabase
    .from('mv_pace_otb')
    .select('*')
    .eq('property_id', PROPERTY_ID)
    .order('ci_month', { ascending: true });

  // If period is forward-looking, scope the pace months to its window
  if (period && period.direction === 'fwd') {
    const fromMonth = period.from.slice(0, 7) + '-01';
    const toMonth = period.to.slice(0, 7) + '-01';
    query = query.gte('ci_month', fromMonth).lte('ci_month', toMonth);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data ?? [];
}

// ============================================================================
// TODAY DETAIL
// ============================================================================

export async function getArrivalsDeparturesToday() {
  const { data, error } = await supabase
    .from('mv_arrivals_departures_today')
    .select('*')
    .eq('property_id', PROPERTY_ID)
    .order('check_in_date', { ascending: true });
  if (error) throw error;
  return data ?? [];
}

// ============================================================================
// AGED AR
// ============================================================================

/**
 * Audit fix C5: filter out future-stay reservations. Real Aged AR =
 * reservations with checkout_date in the past AND positive balance.
 *
 * The mat view today returns everything with a balance, including upcoming
 * stays — those are NOT receivables. We filter client-side until the view
 * itself is rebuilt (see sql/01_fix_mv_aged_ar.sql).
 */
export async function getAgedAr() {
  const { data, error } = await supabase
    .from('mv_aged_ar')
    .select('*')
    .eq('property_id', PROPERTY_ID)
    .order('days_overdue', { ascending: false });
  if (error) throw error;
  // Frontend safety net even before the SQL migration runs:
  return (data ?? []).filter((r: any) => Number(r.days_overdue) > 0);
}

// ============================================================================
// CAPTURE RATES
// ============================================================================

export async function getCaptureRates() {
  const { data, error } = await supabase
    .from('mv_capture_rates')
    .select('*')
    .eq('property_id', PROPERTY_ID)
    .single();
  if (error) throw error;
  return data;
}

// ============================================================================
// RATE INVENTORY CALENDAR
// ============================================================================

export async function getRateInventoryCalendar(period: ResolvedPeriod): Promise<any[]>;
export async function getRateInventoryCalendar(fromDate: string, toDate: string): Promise<any[]>;
export async function getRateInventoryCalendar(a: ResolvedPeriod | string, b?: string): Promise<any[]> {
  let from: string, to: string;
  if (typeof a === 'string') {
    from = a; to = b!;
  } else {
    from = a.from; to = a.to;
  }

  const { data, error } = await supabase
    .from('mv_rate_inventory_calendar')
    .select('*')
    .eq('property_id', PROPERTY_ID)
    .gte('inventory_date', from)
    .lte('inventory_date', to)
    .order('inventory_date', { ascending: true });
  if (error) throw error;
  return data ?? [];
}

// ============================================================================
// DQ ISSUES
// ============================================================================

export async function getDqIssues() {
  // Cowork audit 2026-05-03: switched from legacy `dq_known_issues` (4 stale rows)
  // to canonical `public.v_dq_open` (joins dq.violations + dq.rules, ~29 live rows).
  // Severity values: CRITICAL | WARNING | INFO. Caller maps to its own UI buckets.
  const { data, error } = await supabase
    .from('v_dq_open')
    .select('*')
    .order('detected_at', { ascending: false });
  if (error) throw error;
  // Shim so existing callers (which read .severity, .category, .title, .description) keep working
  return (data ?? []).map((r: any) => ({
    id: r.violation_id,
    severity: (() => {
      const s = String(r.severity || '').toLowerCase();
      if (s === 'critical') return 'high';
      if (s === 'warning') return 'medium';
      if (s === 'info') return 'low';
      return s;
    })(),
    category: r.rule_category,
    title: r.rule_title || r.rule_id,
    description: r.rule_description,
    entity_type: r.entity_type,
    entity_id: r.entity_id,
    detected_at: r.detected_at,
    details: r.details,
  }));
}

// ============================================================================
// LEGACY HELPERS — kept so any unmigrated code still compiles
// ============================================================================

export function defaultMonthRange(): { fromMonth: string; toMonth: string } {
  const today = new Date();
  const from = new Date(today.getFullYear() - 1, today.getMonth(), 1);
  return {
    fromMonth: from.toISOString().slice(0, 10),
    toMonth: new Date(today.getFullYear(), today.getMonth() + 1, 1).toISOString().slice(0, 10)
  };
}

export function defaultDailyRange(daysBack = 90): { from: string; to: string } {
  const today = new Date();
  const from = new Date(today.getTime() - daysBack * 86400000);
  return {
    from: from.toISOString().slice(0, 10),
    to: today.toISOString().slice(0, 10)
  };
}

// ============================================================================
// AGGREGATION
// ============================================================================

// Aggregate daily KPI rows over the requested capacity-mode column.
// Bug 11 fix (Cowork handoff 2026-05-01): the prior implementation used the LAST row's
// total_rooms, which was wrong for windows that span a capacity change. Now we sum
// per-night capacity from the chosen capacity_<mode> column (selling/live/total),
// falling back to total_rooms when those columns aren't present (older matview).
//
// `mode` is optional + defaults to 'selling' so legacy callers that pass only `rows`
// keep working — but every caller should pass `period.capacityMode` to honour ?cap=.
export function aggregateDaily(rows: any[], mode: 'selling' | 'live' | 'total' = 'selling') {
  if (!rows.length) return null;
  const capCol =
    mode === 'live'    ? 'capacity_live' :
    mode === 'total'   ? 'capacity_total' :
                         'capacity_selling';

  const totals = rows.reduce((a: any, r: any) => {
    a.rooms_sold += Number(r.rooms_sold || 0);
    a.rooms_revenue += Number(r.rooms_revenue || 0);
    a.fnb_revenue += Number(r.fnb_revenue || 0);
    a.fnb_food_revenue += Number(r.fnb_food_revenue || 0);
    a.fnb_beverage_revenue += Number(r.fnb_beverage_revenue || 0);
    a.spa_revenue += Number(r.spa_revenue || 0);
    a.activity_revenue += Number(r.activity_revenue || 0);
    a.retail_revenue += Number(r.retail_revenue || 0);
    a.total_ancillary_revenue += Number(r.total_ancillary_revenue || 0);
    a.unclassified_revenue += Number(r.unclassified_revenue || 0);
    a.days += 1;
    // Per-night capacity sum from the selected mode; fall back to total_rooms when missing.
    const perNightCap = Number(r[capCol] ?? r.total_rooms ?? 0);
    a.available_roomnights += perNightCap;
    a.total_rooms = Number(r.total_rooms || a.total_rooms); // last seen — legacy tile compat
    return a;
  }, {
    rooms_sold: 0, rooms_revenue: 0, fnb_revenue: 0, fnb_food_revenue: 0,
    fnb_beverage_revenue: 0, spa_revenue: 0, activity_revenue: 0,
    retail_revenue: 0, total_ancillary_revenue: 0, unclassified_revenue: 0,
    days: 0, total_rooms: 0, available_roomnights: 0,
  });

  const availableRn = totals.available_roomnights;
  return {
    ...totals,
    capacity_mode: mode,
    available_roomnights: availableRn,
    occupancy_pct: availableRn ? (totals.rooms_sold / availableRn) * 100 : 0,
    adr: totals.rooms_sold ? totals.rooms_revenue / totals.rooms_sold : 0,
    revpar: availableRn ? totals.rooms_revenue / availableRn : 0,
    trevpar: availableRn ? (totals.rooms_revenue + totals.total_ancillary_revenue) / availableRn : 0,
  };
}

// ============================================================================
// HELPERS — added 2026-05-01 (Cowork handoff)
// ============================================================================

/**
 * Booking count per rate plan over the requested window.
 * Used by /revenue/rateplans (existing replacement page already imports a similar shape).
 * Falls back to [] if reservation_rooms isn't reachable.
 */
export async function getRatePlanUsage(from: string, to: string): Promise<Array<{
  rate_plan_name: string; bookings: number; revenue: number;
}>> {
  try {
    const { supabase, PROPERTY_ID } = await import('./supabase');
    const { data, error } = await supabase
      .from('reservation_rooms')
      .select('rate_plan_name, rate, reservation_id, reservations!inner(property_id, booking_date, status)')
      .gte('reservations.booking_date', from)
      .lte('reservations.booking_date', to)
      .eq('reservations.property_id', PROPERTY_ID)
      .neq('reservations.status', 'canceled')
      .neq('reservations.status', 'no_show');
    if (error) { console.error('getRatePlanUsage', error); return []; }
    const map: Record<string, { bookings: number; revenue: number }> = {};
    (data ?? []).forEach((r: any) => {
      const k = r.rate_plan_name || '(none)';
      if (!map[k]) map[k] = { bookings: 0, revenue: 0 };
      map[k].bookings += 1;
      map[k].revenue += Number(r.rate || 0);
    });
    return Object.entries(map)
      .map(([rate_plan_name, x]) => ({ rate_plan_name, ...x }))
      .sort((a, b) => b.revenue - a.revenue);
  } catch (e) { console.error('getRatePlanUsage', e); return []; }
}

/**
 * Count of guests/reservations missing email in the requested window.
 * Used by /finance/ledger and /actions to surface DQ debt.
 */
export async function countMissingEmail(from: string, to: string): Promise<number> {
  try {
    const { supabase, PROPERTY_ID } = await import('./supabase');
    const { count, error } = await supabase
      .from('reservations')
      .select('reservation_id', { count: 'exact', head: true })
      .eq('property_id', PROPERTY_ID)
      .gte('booking_date', from)
      .lte('booking_date', to)
      .or('email.is.null,email.eq.');
    if (error) { console.error('countMissingEmail', error); return 0; }
    return count ?? 0;
  } catch (e) { console.error('countMissingEmail', e); return 0; }
}

// =====================================================================
// Restored helpers (2026-05-04 → re-restored 2026-05-05 after parallel-session wipe)
// Used by: /operations · /operations/restaurant · /operations/spa
//          · /operations/activities · /finance/poster
// =====================================================================

export interface DeptPlRow {
  period: string;
  revenue: number;
  food_revenue: number;
  bev_revenue: number;
  food_cost: number;
  bev_cost: number;
  spa_cost: number;
  cogs: number;
  payroll: number;
  other_oe: number;
  total_cost: number;
  gop: number;
  gop_pct: number;
  food_cost_pct: number;
  bev_cost_pct: number;
  spa_cost_pct: number;
  labor_cost_pct: number;
  cb_revenue: number | null;
  cb_qb_variance_pct: number | null;
}

const PL_DEPT_MAP: Record<'fnb' | 'spa' | 'activities' | 'retail', { qb: string; cb: string }> = {
  fnb:        { qb: 'F&B',           cb: 'fnb_revenue'      },
  spa:        { qb: 'Spa',           cb: 'spa_revenue'      },
  activities: { qb: 'Activities',    cb: 'activity_revenue' },
  retail:     { qb: 'Retail',        cb: 'retail_revenue'   },
};

function blankPlRow(m: string): DeptPlRow {
  return {
    period: m, revenue: 0, food_revenue: 0, bev_revenue: 0,
    food_cost: 0, bev_cost: 0, spa_cost: 0, cogs: 0,
    payroll: 0, other_oe: 0, total_cost: 0, gop: 0, gop_pct: 0,
    food_cost_pct: 0, bev_cost_pct: 0, spa_cost_pct: 0, labor_cost_pct: 0,
    cb_revenue: null, cb_qb_variance_pct: null,
  };
}

export async function getDeptPl(dept: 'fnb' | 'spa' | 'activities' | 'retail', monthsBack = 16): Promise<DeptPlRow[]> {
  const cfg = PL_DEPT_MAP[dept];
  const today = new Date();
  const start = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() - (monthsBack - 1), 1));
  const startStr = `${start.getUTCFullYear()}-${String(start.getUTCMonth() + 1).padStart(2, '0')}`;
  const { data: qb, error: qbErr } = await supabase
    .schema('gl').from('mv_usali_pl_monthly')
    .select('period_yyyymm, usali_subcategory, usali_line_label, amount_usd')
    .eq('usali_department', cfg.qb).gte('period_yyyymm', startStr);
  if (qbErr) return [];
  const startDate = `${startStr}-01`;
  const { data: cb } = await supabase
    .from('mv_kpi_daily')
    .select(`night_date, ${cfg.cb}`)
    .eq('property_id', PROPERTY_ID).gte('night_date', startDate);
  const cbByMonth: Record<string, number> = {};
  for (const r of (cb ?? []) as any[]) {
    const m = String(r.night_date).slice(0, 7);
    cbByMonth[m] = (cbByMonth[m] ?? 0) + Number(r[cfg.cb] ?? 0);
  }
  const byMonth: Record<string, DeptPlRow> = {};
  for (const row of (qb ?? []) as any[]) {
    const m = String(row.period_yyyymm);
    if (!byMonth[m]) byMonth[m] = blankPlRow(m);
    const amt = Number(row.amount_usd ?? 0);
    const sub = String(row.usali_subcategory ?? '');
    const line = String(row.usali_line_label ?? '');
    if (sub === 'Revenue') {
      byMonth[m].revenue += -amt;
      if (/^food/i.test(line))      byMonth[m].food_revenue += -amt;
      else if (/^bev/i.test(line))  byMonth[m].bev_revenue  += -amt;
    } else {
      byMonth[m].total_cost += amt;
      if (sub === 'Cost of Sales') {
        byMonth[m].cogs += amt;
        if (/^food/i.test(line))      byMonth[m].food_cost += amt;
        else if (/^bev/i.test(line))  byMonth[m].bev_cost  += amt;
        else if (/^spa/i.test(line))  byMonth[m].spa_cost  += amt;
      } else if (sub === 'Payroll & Related') byMonth[m].payroll += amt;
      else byMonth[m].other_oe += amt;
    }
  }
  const todayPeriod = `${today.getUTCFullYear()}-${String(today.getUTCMonth() + 1).padStart(2, '0')}`;
  const out: DeptPlRow[] = Object.values(byMonth).map((r) => {
    const cbRev = cbByMonth[r.period] ?? null;
    return {
      ...r,
      gop: r.revenue - r.total_cost,
      gop_pct: r.revenue > 0 ? ((r.revenue - r.total_cost) / r.revenue) * 100 : 0,
      food_cost_pct: r.revenue > 0 ? (r.food_cost / r.revenue) * 100 : 0,
      bev_cost_pct:  r.revenue > 0 ? (r.bev_cost  / r.revenue) * 100 : 0,
      spa_cost_pct:  r.revenue > 0 ? (r.spa_cost  / r.revenue) * 100 : 0,
      labor_cost_pct: r.revenue > 0 ? (r.payroll  / r.revenue) * 100 : 0,
      cb_revenue: cbRev,
      cb_qb_variance_pct: cbRev != null && cbRev > 0 ? ((r.revenue - cbRev) / cbRev) * 100 : null,
    };
  });
  for (const m of Object.keys(cbByMonth)) {
    if (!byMonth[m] && cbByMonth[m] > 0 && m <= todayPeriod) {
      out.push({ ...blankPlRow(m), cb_revenue: cbByMonth[m] });
    }
  }
  return out.filter(r => r.period <= todayPeriod && (r.revenue > 0 || (r.cb_revenue ?? 0) > 0))
    .sort((a, b) => b.period.localeCompare(a.period));
}

// Period-aware F&B costs
export interface FnbCostsForPeriod {
  revenue: number; food_revenue: number; bev_revenue: number;
  food_cost: number; bev_cost: number; payroll: number;
  total_cost: number; gop: number;
  food_cost_pct: number; bev_cost_pct: number; labor_cost_pct: number; gop_pct: number;
  months_used: string[];
}
export async function getFnbCostsForPeriod(fromIso: string, toIso: string): Promise<FnbCostsForPeriod | null> {
  const fromMonth = fromIso.slice(0, 7), toMonth = toIso.slice(0, 7);
  const { data, error } = await supabase
    .schema('gl').from('mv_usali_pl_monthly')
    .select('period_yyyymm, usali_subcategory, usali_line_label, amount_usd')
    .eq('usali_department', 'F&B').gte('period_yyyymm', fromMonth).lte('period_yyyymm', toMonth);
  if (error || !data || data.length === 0) return null;
  let revenue = 0, food_rev = 0, bev_rev = 0, food_cost = 0, bev_cost = 0, payroll = 0, other_oe = 0, cogs = 0;
  const months = new Set<string>();
  for (const row of data as any[]) {
    const amt = Number(row.amount_usd ?? 0);
    const sub = String(row.usali_subcategory ?? ''), line = String(row.usali_line_label ?? '');
    months.add(String(row.period_yyyymm));
    if (sub === 'Revenue') { revenue += -amt; if (/^food/i.test(line)) food_rev += -amt; else if (/^bev/i.test(line)) bev_rev += -amt; }
    else if (sub === 'Cost of Sales') { cogs += amt; if (/^food/i.test(line)) food_cost += amt; else if (/^bev/i.test(line)) bev_cost += amt; }
    else if (sub === 'Payroll & Related') payroll += amt;
    else other_oe += amt;
  }
  if (revenue <= 0) return null;
  const total_cost = cogs + payroll + other_oe, gop = revenue - total_cost;
  return { revenue, food_revenue: food_rev, bev_revenue: bev_rev, food_cost, bev_cost, payroll, total_cost, gop,
    food_cost_pct: (food_cost / revenue) * 100, bev_cost_pct: (bev_cost / revenue) * 100,
    labor_cost_pct: (payroll / revenue) * 100, gop_pct: (gop / revenue) * 100,
    months_used: Array.from(months).sort().reverse() };
}

// Period-aware Spa costs
export interface SpaCostsForPeriod {
  revenue: number; spa_cost: number; payroll: number; total_cost: number; gop: number;
  spa_cost_pct: number; labor_cost_pct: number; gop_pct: number; months_used: string[];
}
export async function getSpaCostsForPeriod(fromIso: string, toIso: string): Promise<SpaCostsForPeriod | null> {
  const fromMonth = fromIso.slice(0, 7), toMonth = toIso.slice(0, 7);
  const { data, error } = await supabase
    .schema('gl').from('mv_usali_pl_monthly')
    .select('period_yyyymm, usali_subcategory, usali_line_label, amount_usd')
    .eq('usali_department', 'Spa').gte('period_yyyymm', fromMonth).lte('period_yyyymm', toMonth);
  if (error || !data || data.length === 0) return null;
  let revenue = 0, spa_cost = 0, payroll = 0, other_oe = 0, cogs = 0;
  const months = new Set<string>();
  for (const row of data as any[]) {
    const amt = Number(row.amount_usd ?? 0);
    const sub = String(row.usali_subcategory ?? ''), line = String(row.usali_line_label ?? '');
    months.add(String(row.period_yyyymm));
    if (sub === 'Revenue') revenue += -amt;
    else if (sub === 'Cost of Sales') { cogs += amt; if (/^spa/i.test(line)) spa_cost += amt; }
    else if (sub === 'Payroll & Related') payroll += amt;
    else other_oe += amt;
  }
  if (revenue <= 0) return null;
  const total_cost = cogs + payroll + other_oe, gop = revenue - total_cost;
  return { revenue, spa_cost, payroll, total_cost, gop,
    spa_cost_pct: (spa_cost / revenue) * 100, labor_cost_pct: (payroll / revenue) * 100, gop_pct: (gop / revenue) * 100,
    months_used: Array.from(months).sort().reverse() };
}

// Period-aware Activities costs
export interface ActivitiesCostsForPeriod {
  revenue: number; cogs: number; payroll: number; total_cost: number; gop: number;
  cogs_pct: number; labor_cost_pct: number; gop_pct: number; months_used: string[];
}
export async function getActivitiesCostsForPeriod(fromIso: string, toIso: string): Promise<ActivitiesCostsForPeriod | null> {
  const fromMonth = fromIso.slice(0, 7), toMonth = toIso.slice(0, 7);
  const { data, error } = await supabase
    .schema('gl').from('mv_usali_pl_monthly')
    .select('period_yyyymm, usali_subcategory, amount_usd')
    .eq('usali_department', 'Activities').gte('period_yyyymm', fromMonth).lte('period_yyyymm', toMonth);
  if (error || !data || data.length === 0) return null;
  let revenue = 0, cogs = 0, payroll = 0, other_oe = 0;
  const months = new Set<string>();
  for (const row of data as any[]) {
    const amt = Number(row.amount_usd ?? 0), sub = String(row.usali_subcategory ?? '');
    months.add(String(row.period_yyyymm));
    if (sub === 'Revenue') revenue += -amt;
    else if (sub === 'Cost of Sales') cogs += amt;
    else if (sub === 'Payroll & Related') payroll += amt;
    else other_oe += amt;
  }
  if (revenue <= 0) return null;
  const total_cost = cogs + payroll + other_oe, gop = revenue - total_cost;
  return { revenue, cogs, payroll, total_cost, gop,
    cogs_pct: (cogs / revenue) * 100, labor_cost_pct: (payroll / revenue) * 100, gop_pct: (gop / revenue) * 100,
    months_used: Array.from(months).sort().reverse() };
}

// Generic dept capture + per-occ-rn from kpi.v_capture_rate_daily
export interface DeptCaptureForPeriod {
  res_in_house: number; res_with_purchase: number; revenue: number; roomnights: number;
  capture_pct: number; spend_per_occ: number;
}
export async function getDeptCaptureForPeriod(filter: { usali_dept: string; usali_subdept?: string }, fromIso: string, toIso: string): Promise<DeptCaptureForPeriod | null> {
  let q = supabase.schema('kpi').from('v_capture_rate_daily')
    .select('reservations_in_house, res_with_purchase, revenue, occupied_room_nights')
    .eq('usali_dept', filter.usali_dept).gte('stay_date', fromIso).lte('stay_date', toIso);
  if (filter.usali_subdept) q = q.eq('usali_subdept', filter.usali_subdept);
  const { data, error } = await q;
  if (error || !data) return null;
  let rih = 0, rwp = 0, rev = 0, rn = 0;
  for (const r of data as any[]) {
    rih += Number(r.reservations_in_house ?? 0);
    rwp += Number(r.res_with_purchase ?? 0);
    rev += Number(r.revenue ?? 0);
    rn  += Number(r.occupied_room_nights ?? 0);
  }
  if (rih === 0 && rn === 0) return null;
  return { res_in_house: rih, res_with_purchase: rwp, revenue: rev, roomnights: rn,
    capture_pct: rih > 0 ? (100 * rwp / rih) : 0, spend_per_occ: rn > 0 ? rev / rn : 0 };
}
export const getFnbCaptureForPeriod = (f: string, t: string) => getDeptCaptureForPeriod({ usali_dept: 'F&B' }, f, t);

// Staff Canteen total cost across departments
export interface CanteenForPeriod {
  total_usd: number; employee_meal_usd: number; canteen_materials_usd: number;
  occ_room_nights: number; cost_per_occ_room: number;
  months_used: string[]; by_dept: { dept: string; usd: number }[];
}
export async function getCanteenForPeriod(fromIso: string, toIso: string): Promise<CanteenForPeriod | null> {
  const fromMonth = fromIso.slice(0, 7), toMonth = toIso.slice(0, 7);
  const { data } = await supabase.schema('gl').from('v_gl_entries_enriched')
    .select('period_yyyymm, account_name, usali_department, amount_usd')
    .in('account_name', ['EMPLOYEE MEAL', 'STAFF CANTEEN MATERIALS'])
    .gte('period_yyyymm', fromMonth).lte('period_yyyymm', toMonth);
  let total = 0, em = 0, mat = 0;
  const months = new Set<string>();
  const byDept: Record<string, number> = {};
  for (const r of (data ?? []) as any[]) {
    const amt = Number(r.amount_usd ?? 0);
    months.add(String(r.period_yyyymm));
    total += amt;
    if (String(r.account_name) === 'EMPLOYEE MEAL') em += amt; else mat += amt;
    const d = String(r.usali_department ?? 'Other');
    byDept[d] = (byDept[d] ?? 0) + amt;
  }
  const { data: kpi } = await supabase.from('mv_kpi_daily')
    .select('rooms_sold').eq('property_id', PROPERTY_ID)
    .gte('night_date', fromIso).lte('night_date', toIso);
  const occ = (kpi ?? []).reduce((s: number, r: any) => s + Number(r.rooms_sold ?? 0), 0);
  if (total === 0 && occ === 0) return null;
  return { total_usd: total, employee_meal_usd: em, canteen_materials_usd: mat,
    occ_room_nights: occ, cost_per_occ_room: occ > 0 ? total / occ : 0,
    months_used: Array.from(months).sort().reverse(),
    by_dept: Object.entries(byDept).map(([dept, usd]) => ({ dept, usd })).sort((a, b) => Math.abs(b.usd) - Math.abs(a.usd)) };
}

// Breakfast allocation (USALI) — pax-nights × $10 fair value
export interface BreakfastAllocation {
  adult_nights: number; child_nights: number;
  rate_per_adult_usd: number; rate_per_child_usd: number;
  total_alloc_usd: number;
  monthly: { period: string; adult_nights: number; child_nights: number; alloc_usd: number }[];
}
export async function getBreakfastAllocation(fromIso: string, toIso: string,
  ratePerAdult = Number(process.env.BREAKFAST_USD_ADULT ?? 10),
  ratePerChild = Number(process.env.BREAKFAST_USD_CHILD ?? 5)): Promise<BreakfastAllocation | null> {
  const { data } = await supabase.from('reservations')
    .select('check_in_date, check_out_date, adults, children, is_cancelled')
    .eq('property_id', PROPERTY_ID).not('check_in_date', 'is', null).not('check_out_date', 'is', null);
  if (!data) return null;
  const buckets: Record<string, { a: number; c: number }> = {};
  let A = 0, C = 0;
  for (const r of data as any[]) {
    if (r.is_cancelled === true) continue;
    const cin = new Date(`${r.check_in_date}T00:00:00Z`), cout = new Date(`${r.check_out_date}T00:00:00Z`);
    const adults = Math.max(Number(r.adults ?? 1), 1), children = Number(r.children ?? 0);
    for (let d = new Date(cin); d < cout; d.setUTCDate(d.getUTCDate() + 1)) {
      const iso = d.toISOString().slice(0, 10);
      if (iso < fromIso || iso > toIso) continue;
      const m = iso.slice(0, 7);
      if (!buckets[m]) buckets[m] = { a: 0, c: 0 };
      buckets[m].a += adults; buckets[m].c += children;
      A += adults; C += children;
    }
  }
  const monthly = Object.entries(buckets).map(([period, x]) => ({
    period, adult_nights: x.a, child_nights: x.c,
    alloc_usd: x.a * ratePerAdult + x.c * ratePerChild,
  })).sort((a, b) => a.period.localeCompare(b.period));
  const total = A * ratePerAdult + C * ratePerChild;
  if (total === 0) return null;
  return { adult_nights: A, child_nights: C, rate_per_adult_usd: ratePerAdult, rate_per_child_usd: ratePerChild, total_alloc_usd: total, monthly };
}

// GL detail breakdown — works for any USALI dept
export interface FnbGlLine {
  usali_subcategory: string; usali_line_label: string | null; account_name: string;
  amounts_by_period: Record<string, number>; total_usd: number;
}
export interface FnbGlBreakdown { periods: string[]; lines: FnbGlLine[]; }
export async function getDeptGlBreakdown(usaliDepartment: string, monthsBack = 16): Promise<FnbGlBreakdown> {
  const today = new Date();
  const start = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() - (monthsBack - 1), 1));
  const startStr = `${start.getUTCFullYear()}-${String(start.getUTCMonth() + 1).padStart(2, '0')}`;
  const { data } = await supabase.schema('gl').from('v_gl_entries_enriched')
    .select('period_yyyymm, account_name, usali_subcategory, usali_line_label, amount_usd, is_pl')
    .eq('usali_department', usaliDepartment).eq('is_pl', true).gte('period_yyyymm', startStr);
  const periodSet = new Set<string>();
  const map: Record<string, FnbGlLine> = {};
  for (const row of (data ?? []) as any[]) {
    const period = String(row.period_yyyymm); periodSet.add(period);
    const sub = String(row.usali_subcategory ?? 'Other');
    const acct = String(row.account_name ?? 'Unknown');
    const lbl = row.usali_line_label ? String(row.usali_line_label) : null;
    const key = `${sub}|${acct}`;
    let amt = Number(row.amount_usd ?? 0);
    if (sub === 'Revenue') amt = -amt;
    if (!map[key]) map[key] = { usali_subcategory: sub, usali_line_label: lbl, account_name: acct, amounts_by_period: {}, total_usd: 0 };
    map[key].amounts_by_period[period] = (map[key].amounts_by_period[period] ?? 0) + amt;
    map[key].total_usd += amt;
  }
  const ORDER = ['Revenue','Cost of Sales','Payroll & Related','Other Operating Expenses','A&G','Utilities','POM','Sales & Marketing','Information & Telecom','Other'];
  return { periods: Array.from(periodSet).sort().reverse(),
    lines: Object.values(map).sort((a, b) => {
      const oa = ORDER.indexOf(a.usali_subcategory), ob = ORDER.indexOf(b.usali_subcategory);
      if (oa !== ob) return (oa < 0 ? 99 : oa) - (ob < 0 ? 99 : ob);
      return Math.abs(b.total_usd) - Math.abs(a.total_usd);
    }) };
}
export const getFnbGlBreakdown = (m: number) => getDeptGlBreakdown('F&B', m);

// Top-seller trend
export interface TopSellerTrend {
  description: string; total_revenue_usd: number; total_units: number;
  monthly: { period: string; revenue: number; units: number }[];
  first_revenue: number; latest_revenue: number; delta_pct: number | null;
  last_sold: string | null; active_months: number; avg_rev_per_active_month: number;
}
export async function getDeptTopSellerTrend(filter: { usali_dept: string; usali_subdept?: string }, startIso = '2026-01-01', topN = 8): Promise<{ periods: string[]; items: TopSellerTrend[] }> {
  let q = supabase.from('mv_classified_transactions')
    .select('description, amount, transaction_date')
    .eq('property_id', PROPERTY_ID).eq('usali_dept', filter.usali_dept).gte('transaction_date', startIso);
  if (filter.usali_subdept) q = q.eq('usali_subdept', filter.usali_subdept);
  const { data } = await q;
  const periodSet = new Set<string>();
  const map: Record<string, { totalRev: number; totalUnits: number; lastSold: string | null; byPeriod: Record<string, { rev: number; units: number }> }> = {};
  for (const r of (data ?? []) as any[]) {
    const desc = (r.description ?? 'Unknown') as string;
    const dateIso = String(r.transaction_date).slice(0, 10);
    const period = dateIso.slice(0, 7);
    const amt = Number(r.amount ?? 0);
    if (amt <= 0) continue;
    periodSet.add(period);
    if (!map[desc]) map[desc] = { totalRev: 0, totalUnits: 0, lastSold: null, byPeriod: {} };
    map[desc].totalRev += amt; map[desc].totalUnits += 1;
    if (!map[desc].lastSold || dateIso > map[desc].lastSold) map[desc].lastSold = dateIso;
    if (!map[desc].byPeriod[period]) map[desc].byPeriod[period] = { rev: 0, units: 0 };
    map[desc].byPeriod[period].rev += amt; map[desc].byPeriod[period].units += 1;
  }
  const periods = Array.from(periodSet).sort();
  const all = Object.entries(map).map(([description, x]) => ({
    description, total_revenue_usd: x.totalRev, total_units: x.totalUnits, last_sold: x.lastSold,
    monthly: periods.map((p) => ({ period: p, revenue: x.byPeriod[p]?.rev ?? 0, units: x.byPeriod[p]?.units ?? 0 })),
  })).sort((a, b) => b.total_revenue_usd - a.total_revenue_usd).slice(0, topN);
  const items: TopSellerTrend[] = all.map((it) => {
    const m = it.monthly.filter((x) => x.revenue > 0);
    const first = m[0]?.revenue ?? 0, latest = m[m.length - 1]?.revenue ?? 0;
    const delta = first > 0 ? ((latest - first) / first) * 100 : null;
    const active = m.length, avg = active > 0 ? it.total_revenue_usd / active : 0;
    return { ...it, first_revenue: first, latest_revenue: latest, delta_pct: delta,
      active_months: active, avg_rev_per_active_month: avg };
  });
  return { periods, items };
}
export const getFnbTopSellerTrend = (s = '2026-01-01', n = 8) => getDeptTopSellerTrend({ usali_dept: 'F&B' }, s, n);

// Raw POS transactions (any dept)
export interface FnbRawTxn {
  transaction_id: string; reservation_id: string | null; transaction_date: string;
  description: string; amount: number; currency: string;
  category: string | null; item_category_name: string | null;
  user_name: string | null; usali_subdept: string | null;
}
export async function getDeptRawTransactions(filter: { usali_dept: string; usali_subdept?: string }, limit = 2000): Promise<FnbRawTxn[]> {
  let q = supabase.from('mv_classified_transactions')
    .select('transaction_id, reservation_id, transaction_date, description, amount, currency, category, item_category_name, user_name, usali_subdept')
    .eq('property_id', PROPERTY_ID).eq('usali_dept', filter.usali_dept)
    .order('transaction_date', { ascending: false }).limit(limit);
  if (filter.usali_subdept) q = q.eq('usali_subdept', filter.usali_subdept);
  const { data } = await q;
  return ((data ?? []) as any[]).map((r) => ({
    transaction_id: String(r.transaction_id),
    reservation_id: r.reservation_id ? String(r.reservation_id) : null,
    transaction_date: String(r.transaction_date),
    description: String(r.description ?? '—'),
    amount: Number(r.amount ?? 0),
    currency: String(r.currency ?? 'USD'),
    category: r.category ? String(r.category) : null,
    item_category_name: r.item_category_name ? String(r.item_category_name) : null,
    user_name: r.user_name ? String(r.user_name) : null,
    usali_subdept: r.usali_subdept ? String(r.usali_subdept) : null,
  }));
}
export const getFnbRawTransactions = (limit = 2000) => getDeptRawTransactions({ usali_dept: 'F&B' }, limit);

// F&B covers proxy (best-effort: distinct reservation × day with F&B charge)
export async function getFnbCovers(fromIso: string, toIso: string): Promise<{ covers: number; days_active: number; revenue: number; avg_check_usd: number } | null> {
  const { data } = await supabase.from('mv_classified_transactions')
    .select('reservation_id, transaction_date, amount')
    .eq('property_id', PROPERTY_ID).eq('usali_dept', 'F&B')
    .gte('transaction_date', fromIso).lte('transaction_date', toIso);
  if (!data || data.length === 0) return null;
  const seen = new Set<string>();
  const days = new Set<string>();
  let revenue = 0;
  for (const r of data as any[]) {
    const day = String(r.transaction_date).slice(0, 10);
    seen.add(`${r.reservation_id}|${day}`);
    days.add(day);
    revenue += Number(r.amount ?? 0);
  }
  const covers = seen.size;
  return { covers, days_active: days.size, revenue, avg_check_usd: covers > 0 ? revenue / covers : 0 };
}

// Spa treatments aggregator (12-month grid)
export async function getSpaTreatments(monthsBack = 12): Promise<{ by_month: { period: string; treatments: number; days_with_treatments: number; avg_per_day: number; revenue: number }[] }> {
  const today = new Date();
  const start = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() - (monthsBack - 1), 1)).toISOString().slice(0, 10);
  const { data } = await supabase.from('mv_classified_transactions')
    .select('transaction_date, amount').eq('property_id', PROPERTY_ID)
    .eq('usali_dept', 'Other Operated').eq('usali_subdept', 'Spa').gte('transaction_date', start);
  const byMonth: Record<string, { treatments: number; days: Set<string>; revenue: number }> = {};
  for (const r of (data ?? []) as any[]) {
    const day = String(r.transaction_date).slice(0, 10), period = day.slice(0, 7);
    if (!byMonth[period]) byMonth[period] = { treatments: 0, days: new Set(), revenue: 0 };
    byMonth[period].treatments += 1;
    byMonth[period].days.add(day);
    byMonth[period].revenue += Number(r.amount ?? 0);
  }
  return { by_month: Object.entries(byMonth).map(([period, x]) => ({
    period, treatments: x.treatments, days_with_treatments: x.days.size,
    avg_per_day: x.days.size > 0 ? x.treatments / x.days.size : 0,
    revenue: x.revenue,
  })).sort((a, b) => a.period.localeCompare(b.period)) };
}

// Dept gross payroll cross-check (ops.v_payroll_dept_monthly)
const DEPT_OPS_CODES: Record<'fnb' | 'spa' | 'activities', string[]> = {
  fnb: ['kitchen', 'roots_service'],
  spa: ['spa'],
  activities: ['activities', 'boat'],
};
export async function getDeptGrossPayroll(dept: 'fnb' | 'spa' | 'activities'): Promise<{ gross_usd: number; headcount: number; period_month: string; by_dept: { dept_code: string; dept_name: string; payroll_usd: number; headcount: number }[] } | null> {
  const codes = DEPT_OPS_CODES[dept];
  const { data } = await supabase.schema('ops').from('v_payroll_dept_monthly')
    .select('period_month, dept_code, dept_name, headcount, total_grand_usd')
    .in('dept_code', codes).order('period_month', { ascending: false }).limit(20);
  if (!data || data.length === 0) return null;
  const latest = String((data[0] as any).period_month);
  const byDept: Record<string, { dept_name: string; payroll_usd: number; headcount: number }> = {};
  let gross = 0, hc = 0;
  for (const r of data as any[]) {
    if (String(r.period_month) !== latest) continue;
    const code = String(r.dept_code);
    if (!byDept[code]) byDept[code] = { dept_name: String(r.dept_name ?? code), payroll_usd: 0, headcount: 0 };
    byDept[code].payroll_usd += Number(r.total_grand_usd ?? 0);
    byDept[code].headcount += Number(r.headcount ?? 0);
    gross += Number(r.total_grand_usd ?? 0);
    hc += Number(r.headcount ?? 0);
  }
  return { gross_usd: gross, headcount: hc, period_month: latest,
    by_dept: Object.entries(byDept).map(([dept_code, x]) => ({ dept_code, ...x })) };
}
