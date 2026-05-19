// Server data fetcher + aggregator for the F&B Outlets page.
// Same shape returned for every property. Donna's views currently return
// 0 rows — the snapshot just contains 0s; the page renders identically.

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

async function fetchMix(propertyId: number, monthIso: string): Promise<OutletMixRow[]> {
  const { data, error } = await supabase
    .from('v_outlet_product_mix_monthly')
    .select('property_id, month, outlet, item, units_sold, revenue, avg_unit_price, check_count, avg_check')
    .eq('property_id', propertyId)
    .eq('month', monthIso)
    .order('revenue', { ascending: false })
    .limit(500);
  if (error) { console.error('[outlets] mix error', error); return []; }
  return (data ?? []) as OutletMixRow[];
}

function aggregate(daily: OutletDailyRow[], mix: OutletMixRow[], monthIsoFirst: string, fromIso: string, toIso: string): OutletsSnapshot {
  // MTD totals from daily rows whose revenue_date is in the current month.
  const monthDaily = daily.filter((r) => r.revenue_date >= monthIsoFirst);
  const mtdRevenue = monthDaily.reduce((s, r) => s + Number(r.revenue || 0), 0);
  const mtdCovers  = monthDaily.reduce((s, r) => s + Number(r.covers_reservation_distinct || 0), 0);
  const mtdAvgCheck = mtdCovers > 0 ? mtdRevenue / mtdCovers : 0;

  // By-outlet totals over the full daily window (last 30d).
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

  // Pivot daily by outlet — one row per date, one column per outlet, plus total.
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

  // Top products this month (pre-sorted from query).
  const topProducts = mix.slice(0, 50);

  return {
    mtdRevenue, mtdCovers, mtdAvgCheck,
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
    monthLabel: monthLabel(monthIsoFirst),
  };
}

export async function fetchOutletsSnapshot(propertyId: number): Promise<OutletsSnapshot> {
  const to = todayIso();
  const from = shiftDaysIso(to, -29);
  const monthFirst = monthStartIso(to);
  const [daily, mix] = await Promise.all([
    fetchDaily(propertyId, from, to),
    fetchMix(propertyId, monthFirst),
  ]);
  return aggregate(daily, mix, monthFirst, from, to);
}
