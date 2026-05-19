// Server data fetcher + aggregator for the F&B Outlets page.
//
// 2026-05-19 — headline tiles now use the rolling 30-day window, not MTD.
// Reason: data lake currently ends ~3 weeks behind today, so MTD-of-the-
// current-month returns 0 rows even when last-30d is rich. Legacy page used
// the 30d aggregate for the same reason. Window: max(revenue_date) - 29d.

import { supabase } from '@/lib/supabase';
import type {
  OutletDailyRow, OutletMixRow, OutletsSnapshot, ByOutletAgg, DailyByOutletPivot,
} from './types';

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function shiftDaysIso(iso: string, deltaDays: number): string {
  const d = new Date(iso + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + deltaDays);
  return d.toISOString().slice(0, 10);
}

function monthStartIso(iso: string): string {
  return iso.slice(0, 7) + '-01';
}

function monthLabel(iso: string): string {
  const d = new Date(iso + 'T00:00:00Z');
  return d.toLocaleString('en-US', { month: 'long', year: 'numeric' });
}

async function fetchDaily(propertyId: number, fromIso: string, toIso: string): Promise<OutletDailyRow[]> {
  const { data, error } = await supabase
    .from('v_outlet_revenue_daily')
    .select('property_id, revenue_date, outlet, subdept, meal_period, line_count, covers_reservation_distinct, revenue')
    .eq('property_id', propertyId)
    .gte('revenue_date', fromIso)
    .lte('revenue_date', toIso)
    .order('revenue_date');
  if (error) { console.error('[outlets] daily error', error); return []; }
  return (data ?? []) as OutletDailyRow[];
}

async function fetchMaxRevenueDate(propertyId: number): Promise<string | null> {
  const { data } = await supabase
    .from('v_outlet_revenue_daily')
    .select('revenue_date')
    .eq('property_id', propertyId)
    .order('revenue_date', { ascending: false })
    .limit(1);
  if (!data || data.length === 0) return null;
  return (data[0] as { revenue_date: string }).revenue_date;
}

async function fetchMix(propertyId: number, monthIso: string): Promise<OutletMixRow[]> {
  // Prefer the latest month available so the "Top products" list isn't empty
  // when the data lake lags. Falls back to monthIso if the latest-month
  // lookup finds nothing.
  const { data: latest } = await supabase
    .from('v_outlet_product_mix_monthly')
    .select('month')
    .eq('property_id', propertyId)
    .order('month', { ascending: false })
    .limit(1);
  const targetMonth = (latest && latest.length > 0)
    ? (latest[0] as { month: string }).month
    : monthIso;
  const { data, error } = await supabase
    .from('v_outlet_product_mix_monthly')
    .select('property_id, month, outlet, item, units_sold, revenue, avg_unit_price, check_count, avg_check')
    .eq('property_id', propertyId)
    .eq('month', targetMonth)
    .order('revenue', { ascending: false })
    .limit(500);
  if (error) { console.error('[outlets] mix error', error); return []; }
  return (data ?? []) as OutletMixRow[];
}

function aggregate(
  daily: OutletDailyRow[],
  mix: OutletMixRow[],
  fromIso: string,
  toIso: string,
  monthLabelStr: string,
): OutletsSnapshot {
  // 30-day window totals (not MTD — see file header).
  const winRevenue = daily.reduce((s, r) => s + Number(r.revenue || 0), 0);
  const winCovers  = daily.reduce((s, r) => s + Number(r.covers_reservation_distinct || 0), 0);
  const winAvgCheck = winCovers > 0 ? winRevenue / winCovers : 0;

  const sumBySubdept = (label: string): number =>
    daily
      .filter((r) => (r.subdept ?? '').toLowerCase() === label.toLowerCase())
      .reduce((s, r) => s + Number(r.revenue || 0), 0);
  const foodRev    = sumBySubdept('Food');
  const bevRev     = sumBySubdept('Beverage');
  const minibarRev = sumBySubdept('Minibar');

  const byOutletMap = new Map<string, ByOutletAgg>();
  for (const r of daily) {
    const cur = byOutletMap.get(r.outlet) ?? { outlet: r.outlet, revenue: 0, covers: 0, avg_check: 0 };
    cur.revenue += Number(r.revenue || 0);
    cur.covers  += Number(r.covers_reservation_distinct || 0);
    byOutletMap.set(r.outlet, cur);
  }
  const byOutlet: ByOutletAgg[] = Array.from(byOutletMap.values()).map((a) => ({
    ...a,
    avg_check: a.covers > 0 ? a.revenue / a.covers : 0,
  })).sort((a, b) => b.revenue - a.revenue);

  const topOutlet = byOutlet.length > 0 ? { name: byOutlet[0].outlet, revenue: byOutlet[0].revenue } : null;

  const outletKeys = byOutlet.map((o) => o.outlet);
  const pivotMap = new Map<string, DailyByOutletPivot>();
  for (const r of daily) {
    const row = pivotMap.get(r.revenue_date) ?? (() => {
      const base: DailyByOutletPivot = { revenue_date: r.revenue_date, total: 0 };
      for (const k of outletKeys) base[k] = 0;
      return base;
    })();
    row[r.outlet] = (Number(row[r.outlet] ?? 0)) + Number(r.revenue || 0);
    row.total = Number(row.total) + Number(r.revenue || 0);
    pivotMap.set(r.revenue_date, row);
  }
  const dailyByOutlet = Array.from(pivotMap.values()).sort((a, b) => a.revenue_date.localeCompare(b.revenue_date));

  const topProducts = mix.slice(0, 50);

  return {
    mtdRevenue: winRevenue,           // field name preserved; semantics = 30d window
    mtdCovers: winCovers,
    mtdAvgCheck: winAvgCheck,
    topOutlet,
    byOutlet,
    dailyByOutlet,
    outletKeys,
    topProducts,
    productCount: mix.length,
    hasData: daily.length > 0 || mix.length > 0,
    daysCovered: new Set(daily.map((r) => r.revenue_date)).size,
    rangeFromIso: fromIso,
    rangeToIso: toIso,
    monthLabel: monthLabelStr,
    foodRevMtd: foodRev,
    bevRevMtd: bevRev,
    minibarRevMtd: minibarRev,
    fnbPerOccRn: 0,
    capturePct: 0,
    staffCanteenUsd: 0,
    canteenPerOccRn: 0,
    breakfastAllocUsd: 0,
    effectiveFnbRev: 0,
    effectiveGopUsd: 0,
    effectiveGopPct: 0,
    effLaborPct: 0,
    effFoodPct: 0,
    monthlyTrend: [],
    pnlMonthlyRollup: [],
    topSellerTrend: [],
    glDetail: [],
    posTransactions: [],
  };
}

export async function fetchOutletsSnapshot(propertyId: number): Promise<OutletsSnapshot> {
  // Anchor the 30-day window on the LATEST revenue_date we have for this
  // property, not on "today". The data lake lags ~3 weeks behind real time
  // for outlet revenue today.
  const today = todayIso();
  const maxDate = (await fetchMaxRevenueDate(propertyId)) ?? today;
  const to = maxDate;
  const from = shiftDaysIso(to, -29);
  const monthFirst = monthStartIso(to);
  const [daily, mix] = await Promise.all([
    fetchDaily(propertyId, from, to),
    fetchMix(propertyId, monthFirst),
  ]);
  return aggregate(daily, mix, from, to, monthLabel(monthFirst));
}
