import { supabase, PROPERTY_ID } from './supabase';

// Server-side data fetchers. All target the BI materialized views created in
// migration "create_bi_materialized_views_v1" / "rebuild_views_using_classified_mv".
// Every fetch is property-scoped.

export async function getKpiToday() {
  const { data, error } = await supabase
    .from('mv_kpi_today')
    .select('*')
    .eq('property_id', PROPERTY_ID)
    .single();
  if (error) throw error;
  return data;
}

export async function getKpiDaily(fromDate: string, toDate: string) {
  const { data, error } = await supabase
    .from('mv_kpi_daily')
    .select('*')
    .eq('property_id', PROPERTY_ID)
    .gte('night_date', fromDate)
    .lte('night_date', toDate)
    .order('night_date', { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function getRevenueByUsali(fromMonth: string, toMonth: string) {
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

export async function getChannelPerf() {
  const { data, error } = await supabase
    .from('mv_channel_perf')
    .select('*')
    .eq('property_id', PROPERTY_ID)
    .order('revenue_90d', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function getPaceOtb() {
  const { data, error } = await supabase
    .from('mv_pace_otb')
    .select('*')
    .eq('property_id', PROPERTY_ID)
    .order('ci_month', { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function getArrivalsDeparturesToday() {
  const { data, error } = await supabase
    .from('mv_arrivals_departures_today')
    .select('*')
    .eq('property_id', PROPERTY_ID)
    .order('check_in_date', { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function getAgedAr() {
  const { data, error } = await supabase
    .from('mv_aged_ar')
    .select('*')
    .eq('property_id', PROPERTY_ID)
    .order('days_overdue', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function getCaptureRates() {
  const { data, error } = await supabase
    .from('mv_capture_rates')
    .select('*')
    .eq('property_id', PROPERTY_ID)
    .single();
  if (error) throw error;
  return data;
}

export async function getRateInventoryCalendar(fromDate: string, toDate: string) {
  const { data, error } = await supabase
    .from('mv_rate_inventory_calendar')
    .select('*')
    .eq('property_id', PROPERTY_ID)
    .gte('inventory_date', fromDate)
    .lte('inventory_date', toDate)
    .order('inventory_date', { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function getDqIssues() {
  const { data, error } = await supabase
    .from('dq_known_issues')
    .select('*')
    .neq('status', 'fixed')
    .order('severity', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

// Helper: month-from / month-to that fit common views
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

// Aggregate helper for "current month" headline KPIs.
// Re-aggregates at the daily-grain to stay consistent with the displayed chart.
export function aggregateDaily(rows: any[]) {
  if (!rows.length) return null;
  const totals = rows.reduce((a, r) => {
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
    a.total_rooms = Number(r.total_rooms || 0); // last seen
    return a;
  }, {
    rooms_sold: 0, rooms_revenue: 0, fnb_revenue: 0, fnb_food_revenue: 0,
    fnb_beverage_revenue: 0, spa_revenue: 0, activity_revenue: 0,
    retail_revenue: 0, total_ancillary_revenue: 0, unclassified_revenue: 0,
    days: 0, total_rooms: 0
  });
  const availableRn = totals.days * totals.total_rooms;
  return {
    ...totals,
    available_roomnights: availableRn,
    occupancy_pct: availableRn ? (totals.rooms_sold / availableRn) * 100 : 0,
    adr: totals.rooms_sold ? totals.rooms_revenue / totals.rooms_sold : 0,
    revpar: availableRn ? totals.rooms_revenue / availableRn : 0,
    trevpar: availableRn ? (totals.rooms_revenue + totals.total_ancillary_revenue) / availableRn : 0
  };
}
