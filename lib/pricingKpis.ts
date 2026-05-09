// lib/pricingKpis.ts
// PBS 2026-05-09: KPI-strip data for /revenue/pricing.
//   1. Current BAR — today's lowest sellable rate from rate_inventory (rate >= RATE_MIN, stop_sell=false)
//   2. Comp gap — today's BAR minus median compset rate from v_compset_competitor_rate_matrix
//   3. Occupancy fence — today's rooms_sold / 30 (PBS-locked capacity)
//   4. Sellable count — count of room-night cells with rate >= RATE_MIN over next 14 days
//
// Each metric also returns yesterday's value so KpiBox can render a delta.
//
// IMPORTANT: the shared `lib/supabase` client uses service_role, but
// service_role currently LACKS SELECT on the underlying revenue.* tables that
// the v_compset_* views reflect (only anon + authenticated do). PostgREST
// therefore returns [] silently for service-role on every v_compset_* view.
// /revenue/compset works around this by spinning up a local anon client; we
// mirror that for the comp-gap query only. All other queries use service_role.

import { createClient } from '@supabase/supabase-js';
import { supabase, PROPERTY_ID } from './supabase';

// Local anon client for v_compset_* views (revenue.* schema is service-role
// blind — see lib comment + app/revenue/compset/page.tsx lines 97-112).
const compsetAnon = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  { auth: { persistSession: false } },
);

export const RATE_MIN = 10;
export const CAPACITY_FIXED = 30;

export interface PricingKpis {
  // Current BAR
  barToday: number | null;
  barYest: number | null;

  // Comp gap (BAR - median compset)
  compMedian: number | null;
  compMedianYest: number | null;
  compRows: number;

  // Occupancy fence
  roomsSold: number | null;
  roomsAvailable: number;        // capped at CAPACITY_FIXED
  occPctToday: number | null;
  occPctYest: number | null;

  // Sellable count next 14d
  sellable14d: number | null;
  sellable14dPrev: number | null; // 14d ending today (rolling-back baseline)
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}
function isoOffset(days: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

async function bar(date: string): Promise<number | null> {
  const { data, error } = await supabase
    .from('rate_inventory')
    .select('rate')
    .eq('property_id', PROPERTY_ID)
    .eq('inventory_date', date)
    .gte('rate', RATE_MIN)
    .or('stop_sell.is.null,stop_sell.eq.false');
  if (error || !data) return null;
  if (data.length === 0) return null;
  let min = Number.POSITIVE_INFINITY;
  for (const r of data) {
    const v = Number((r as any).rate) || 0;
    if (v >= RATE_MIN && v < min) min = v;
  }
  return min === Number.POSITIVE_INFINITY ? null : min;
}

async function compMedian(date: string): Promise<{ median: number | null; rows: number }> {
  // MUST use anon client (service_role can't read revenue.* underneath the
  // v_compset_* views — see file header). Mirror the proven /revenue/compset
  // pattern: select * with high limit, filter client-side.
  const { data, error } = await compsetAnon
    .from('v_compset_competitor_rate_matrix')
    .select('*')
    .limit(5000);
  if (error || !data) {
    if (error) console.error('[pricingKpis] compMedian', error);
    return { median: null, rows: 0 };
  }
  const rates = data
    .filter((r: any) => String(r.stay_date) === date)
    .filter((r: any) => r.is_available !== false)
    .map((r: any) => Number(r.rate_usd))
    .filter((n: number) => Number.isFinite(n) && n > 0)
    .sort((a, b) => a - b);
  if (rates.length === 0) return { median: null, rows: 0 };
  const mid = Math.floor(rates.length / 2);
  const median = rates.length % 2 === 0
    ? (rates[mid - 1] + rates[mid]) / 2
    : rates[mid];
  return { median, rows: rates.length };
}

async function occToday(date: string): Promise<{ roomsSold: number | null; occPct: number | null }> {
  const { data, error } = await supabase
    .from('v_kpi_daily')
    .select('rooms_sold, rooms_available, occupancy_pct')
    .eq('metric_date', date)
    .maybeSingle();
  if (error || !data) return { roomsSold: null, occPct: null };
  const sold = Number((data as any).rooms_sold ?? 0);
  // Always render against fixed capacity 30 per PBS lock
  const pct = CAPACITY_FIXED > 0 ? (sold / CAPACITY_FIXED) * 100 : 0;
  return { roomsSold: sold, occPct: pct };
}

async function sellableCount(fromIso: string, toIso: string): Promise<number | null> {
  const { count, error } = await supabase
    .from('rate_inventory')
    .select('*', { count: 'exact', head: true })
    .eq('property_id', PROPERTY_ID)
    .gte('inventory_date', fromIso)
    .lt('inventory_date', toIso)
    .gte('rate', RATE_MIN)
    .or('stop_sell.is.null,stop_sell.eq.false');
  if (error) return null;
  return count ?? 0;
}

export async function getPricingKpis(): Promise<PricingKpis> {
  const today = todayIso();
  const yest = isoOffset(-1);
  const plus14 = isoOffset(14);
  const minus14 = isoOffset(-14);

  const [
    barT, barY,
    compT, compY,
    occT, occY,
    sell14, sell14prev,
  ] = await Promise.all([
    bar(today),
    bar(yest),
    compMedian(today),
    compMedian(yest),
    occToday(today),
    occToday(yest),
    sellableCount(today, plus14),
    sellableCount(minus14, today),
  ]);

  return {
    barToday: barT,
    barYest: barY,
    compMedian: compT.median,
    compMedianYest: compY.median,
    compRows: compT.rows,
    roomsSold: occT.roomsSold,
    roomsAvailable: CAPACITY_FIXED,
    occPctToday: occT.occPct,
    occPctYest: occY.occPct,
    sellable14d: sell14,
    sellable14dPrev: sell14prev,
  };
}
