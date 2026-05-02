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
const CMP_MAP: Record<string, string> = {
  none: 'NONE',
  pp:   'PREV_PERIOD',
  stly: 'YOY',
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
  const { data, error } = await supabase
    .from('dq_known_issues')
    .select('*')
    .neq('status', 'fixed')
    .order('severity', { ascending: false });
  if (error) throw error;
  return data ?? [];
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
