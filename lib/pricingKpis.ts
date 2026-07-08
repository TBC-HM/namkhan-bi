// lib/pricingKpis.ts
// PBS 2026-05-09: KPI-strip data for /revenue/pricing.
//   1. Current BAR — today's lowest sellable rate from rate_inventory
//   2. Comp gap — today's BAR minus median compset rate
//   3. Occupancy fence — today's rooms_sold / capacity (per-property)
//   4. Sellable count — cells with rate >= RATE_MIN over next 14 days
//
// 2026-05-22: every helper accepts an optional propertyId. CAPACITY +
// occupancy source switch per property (Namkhan=30 via v_kpi_daily,
// Donna=64 via v_otb_pace — v_kpi_daily has no property column).
// rate_inventory stays Namkhan-only at the schema level — returns null/0
// for Donna, which the KPI tiles render as "—" (empty-state).
//
// IMPORTANT: the shared `lib/supabase` client uses service_role, but
// service_role currently LACKS SELECT on the revenue.* tables that the
// v_compset_* views reflect (only anon + authenticated do). The compset
// query mirrors /revenue/compset's local-anon-client workaround.

import { createClient } from '@supabase/supabase-js';
import { supabase, PROPERTY_ID } from './supabase';

const compsetAnon = createClient(
  (process.env.NEXT_PUBLIC_SUPABASE_URL || "https://build-placeholder.supabase.co"),
  (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "build-placeholder-anon"),
  { auth: { persistSession: false } },
);

export const RATE_MIN = 10;
const CAPACITY_BY_PROPERTY: Record<number, number> = { 260955: 30, 1000001: 64 };
export const CAPACITY_FIXED = 30; // legacy export — Namkhan default
function capacityFor(propertyId: number): number {
  return CAPACITY_BY_PROPERTY[propertyId] ?? 30;
}

export interface PricingKpis {
  barToday: number | null;
  barYest: number | null;
  compMedian: number | null;
  compMedianYest: number | null;
  compRows: number;
  roomsSold: number | null;
  roomsAvailable: number;
  occPctToday: number | null;
  occPctYest: number | null;
  sellable14d: number | null;
  sellable14dPrev: number | null;
}

function todayIso(): string { return new Date().toISOString().slice(0, 10); }
function isoOffset(days: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

async function bar(date: string, propertyId: number): Promise<number | null> {
  const { data, error } = await supabase
    .from('rate_inventory')
    .select('rate')
    .eq('property_id', propertyId)
    .eq('inventory_date', date)
    .gte('rate', RATE_MIN)
    .or('stop_sell.is.null,stop_sell.eq.false');
  if (error || !data || data.length === 0) return null;
  let min = Number.POSITIVE_INFINITY;
  for (const r of data) {
    const v = Number((r as Record<string, unknown>).rate) || 0;
    if (v >= RATE_MIN && v < min) min = v;
  }
  return min === Number.POSITIVE_INFINITY ? null : min;
}

async function compMedian(date: string): Promise<{ median: number | null; rows: number }> {
  const { data, error } = await compsetAnon
    .from('v_compset_competitor_rate_matrix')
    .select('*')
    .limit(5000);
  if (error || !data) {
    if (error) console.error('[pricingKpis] compMedian', error);
    return { median: null, rows: 0 };
  }
  const rates = (data as Array<Record<string, unknown>>)
    .filter((r) => String(r.stay_date) === date)
    .filter((r) => r.is_available !== false)
    .map((r) => Number(r.rate_usd))
    .filter((n) => Number.isFinite(n) && n > 0)
    .sort((a, b) => a - b);
  if (rates.length === 0) return { median: null, rows: 0 };
  const mid = Math.floor(rates.length / 2);
  const median = rates.length % 2 === 0 ? (rates[mid - 1] + rates[mid]) / 2 : rates[mid];
  return { median, rows: rates.length };
}

// occToday: Namkhan reads v_kpi_daily (the legacy property-less view);
// Donna falls back to v_otb_pace which IS property-aware. Both produce
// rooms_sold + occ % against the property's capacity.
async function occToday(date: string, propertyId: number): Promise<{ roomsSold: number | null; occPct: number | null }> {
  const cap = capacityFor(propertyId);
  if (propertyId === 260955) {
    const { data, error } = await supabase
      .from('v_kpi_daily')
      .select('rooms_sold, rooms_available, occupancy_pct')
      .eq('metric_date', date)
      .maybeSingle();
    if (error || !data) return { roomsSold: null, occPct: null };
    const sold = Number((data as Record<string, unknown>).rooms_sold ?? 0);
    return { roomsSold: sold, occPct: cap > 0 ? (sold / cap) * 100 : 0 };
  }
  // Donna (and any other property): derive from v_otb_pace
  const { data, error } = await supabase
    .from('v_otb_pace')
    .select('confirmed_rooms')
    .eq('property_id', propertyId)
    .eq('night_date', date)
    .maybeSingle();
  if (error || !data) return { roomsSold: null, occPct: null };
  const sold = Number((data as Record<string, unknown>).confirmed_rooms ?? 0);
  return { roomsSold: sold, occPct: cap > 0 ? (sold / cap) * 100 : 0 };
}

async function sellableCount(fromIso: string, toIso: string, propertyId: number): Promise<number | null> {
  // PBS 2026-07-08: distinct (inventory_date, room_type_id) combos with ≥1
  // sellable rate. Server-side RPC because PostgREST would cap us at 1000 rows
  // and deduping in JS would silently under-count (~39 vs true 140 on Namkhan).
  const { data, error } = await supabase.rpc('fn_sellable_room_days', {
    p_property_id: propertyId,
    p_from_date:   fromIso,
    p_to_date:     toIso,
  });
  if (error) {
    console.error('[pricingKpis/sellableCount] rpc error', error);
    return null;
  }
  return typeof data === 'number' ? data : Number(data ?? 0);
}

export async function getPricingKpis(propertyId: number = PROPERTY_ID): Promise<PricingKpis> {
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
    bar(today, propertyId),
    bar(yest, propertyId),
    compMedian(today),
    compMedian(yest),
    occToday(today, propertyId),
    occToday(yest, propertyId),
    sellableCount(today, plus14, propertyId),
    sellableCount(minus14, today, propertyId),
  ]);

  return {
    barToday: barT,
    barYest: barY,
    compMedian: compT.median,
    compMedianYest: compY.median,
    compRows: compT.rows,
    roomsSold: occT.roomsSold,
    roomsAvailable: capacityFor(propertyId),
    occPctToday: occT.occPct,
    occPctYest: occY.occPct,
    sellable14d: sell14,
    sellable14dPrev: sell14prev,
  };
}
