// lib/data.ts
// Period-aware data fetchers. Every function accepts ResolvedPeriod and uses
// its from/to/segment/compare values instead of hardcoded windows.
//
// IMPORTANT: This is a DROP-IN REPLACEMENT for the existing lib/data.ts.
// If your deployed version has additional functions not listed here, copy
// them over and update their signatures to take `period: ResolvedPeriod`.

import { supabase } from '@/lib/supabase';
import type { ResolvedPeriod, Segment } from '@/lib/period';
import { segmentFilter } from '@/lib/period';

// ============================================================================
// SHARED TYPES
// ============================================================================

export interface KpiSet {
  occupancy: number;            // 0-1
  adr_usd: number;
  adr_lak: number;
  revpar_usd: number;
  revpar_lak: number;
  trevpar_usd: number;
  trevpar_lak: number;
  goppar_usd: number | null;
  cancel_pct: number;
  noshow_pct: number;
  fb_per_occ_usd: number;
  fb_per_occ_lak: number;
  spa_per_occ_usd: number;
  spa_per_occ_lak: number;
  activity_per_occ_usd: number;
  activity_per_occ_lak: number;
  rooms_sold: number;
  room_revenue_usd: number;
  total_revenue_usd: number;
}

export interface KpiSetWithCompare extends KpiSet {
  compare?: KpiSet | null;
  compareLabel?: string;
}

export interface DailySeriesPoint {
  date: string;
  rooms_sold: number;
  room_revenue_usd: number;
  occupancy: number;
}

export interface ChannelRow {
  source: string;
  bookings: number;
  revenue_usd: number;
  revenue_lak: number;
  pct_mix: number;
  adr_usd: number;
}

export interface TodaySnapshot {
  in_house: number;
  arriving: number;
  departing: number;
  otb_next_90d: number;
}

// ============================================================================
// CORE: KPIs FOR ANY PERIOD
// ============================================================================

/**
 * Fetch KPIs for the resolved period. If period.cmp is set, also fetches
 * the comparison range and attaches it.
 */
export async function getKpis(period: ResolvedPeriod): Promise<KpiSetWithCompare> {
  const main = await fetchKpisForRange(period.from, period.to, period.seg);

  let compare: KpiSet | null = null;
  let compareLabel: string | undefined;
  if (period.compareFrom && period.compareTo) {
    compare = await fetchKpisForRange(period.compareFrom, period.compareTo, period.seg);
    compareLabel = period.cmp === 'stly' ? 'vs STLY'
                : period.cmp === 'prior' ? 'vs Prior'
                : 'vs Budget';
  }

  return { ...main, compare, compareLabel };
}

async function fetchKpisForRange(from: string, to: string, seg: Segment): Promise<KpiSet> {
  // Pull room nights, room revenue from reservation_rooms
  const segF = segmentFilter(seg);

  // Reservations in range
  let resQuery = supabase
    .from('reservations')
    .select('reservation_id,total_amount,is_cancelled,status,source,nights,check_in_date,check_out_date')
    .lte('check_in_date', to)
    .gte('check_out_date', from);

  if (segF.column && segF.values && segF.values.length) {
    resQuery = resQuery.in(segF.column, segF.values);
  }

  const { data: reservations, error: rErr } = await resQuery;
  if (rErr) console.error('fetchKpisForRange reservations error:', rErr);

  const allRes = reservations ?? [];
  const nonCancelled = allRes.filter(r => !r.is_cancelled);
  const cancelled = allRes.filter(r => r.is_cancelled);
  const noShows = allRes.filter(r => (r.status ?? '').toLowerCase() === 'no_show' || (r.status ?? '').toLowerCase() === 'no-show');

  // Rooms sold = sum of nights for non-cancelled reservations falling in range
  const roomsSold = nonCancelled.reduce((s, r) => {
    if (!r.check_in_date || !r.check_out_date) return s;
    const ci = new Date(r.check_in_date) > new Date(from) ? r.check_in_date : from;
    const co = new Date(r.check_out_date) < new Date(to) ? r.check_out_date : to;
    const nights = Math.max(0, Math.round(
      (new Date(co).getTime() - new Date(ci).getTime()) / 86_400_000
    ));
    return s + nights;
  }, 0);

  const roomRevenueUsd = nonCancelled.reduce((s, r) => s + Number(r.total_amount || 0), 0);

  // Capacity: sellable rooms × days in range (19 sellable rooms after Tent 7 retired)
  const SELLABLE_ROOMS = 19;
  const days = Math.max(1, Math.round(
    (new Date(to).getTime() - new Date(from).getTime()) / 86_400_000
  ));
  const capacity = SELLABLE_ROOMS * days;

  const occupancy = capacity > 0 ? roomsSold / capacity : 0;
  const adrUsd = roomsSold > 0 ? roomRevenueUsd / roomsSold : 0;
  const revparUsd = capacity > 0 ? roomRevenueUsd / capacity : 0;

  // F&B / Spa / Activity from transactions
  const totals = await fetchAncillaryTotals(from, to, seg);
  const totalRevenueUsd = roomRevenueUsd + totals.fb_usd + totals.spa_usd + totals.activity_usd;
  const trevparUsd = capacity > 0 ? totalRevenueUsd / capacity : 0;

  const cancelPct = allRes.length > 0 ? cancelled.length / allRes.length : 0;
  const noshowPct = allRes.length > 0 ? noShows.length / allRes.length : 0;

  const fbPerOccUsd       = roomsSold > 0 ? totals.fb_usd / roomsSold : 0;
  const spaPerOccUsd      = roomsSold > 0 ? totals.spa_usd / roomsSold : 0;
  const activityPerOccUsd = roomsSold > 0 ? totals.activity_usd / roomsSold : 0;

  const FX = Number(process.env.NEXT_PUBLIC_FX_LAK_USD ?? 21800);

  return {
    occupancy,
    adr_usd: adrUsd, adr_lak: adrUsd * FX,
    revpar_usd: revparUsd, revpar_lak: revparUsd * FX,
    trevpar_usd: trevparUsd, trevpar_lak: trevparUsd * FX,
    goppar_usd: null,
    cancel_pct: cancelPct, noshow_pct: noshowPct,
    fb_per_occ_usd: fbPerOccUsd, fb_per_occ_lak: fbPerOccUsd * FX,
    spa_per_occ_usd: spaPerOccUsd, spa_per_occ_lak: spaPerOccUsd * FX,
    activity_per_occ_usd: activityPerOccUsd, activity_per_occ_lak: activityPerOccUsd * FX,
    rooms_sold: roomsSold,
    room_revenue_usd: roomRevenueUsd,
    total_revenue_usd: totalRevenueUsd,
  };
}

async function fetchAncillaryTotals(from: string, to: string, seg: Segment): Promise<{
  fb_usd: number; spa_usd: number; activity_usd: number;
}> {
  // Pull from mv_classified_transactions (or transactions + classifier)
  const { data, error } = await supabase
    .from('mv_classified_transactions')
    .select('usali_dept,amount_usd,date')
    .gte('date', from).lte('date', to)
    .in('usali_dept', ['F&B', 'Spa', 'Activities', 'Activity']);

  if (error || !data) return { fb_usd: 0, spa_usd: 0, activity_usd: 0 };

  let fb = 0, spa = 0, activity = 0;
  for (const t of data) {
    const a = Number(t.amount_usd || 0);
    if (t.usali_dept === 'F&B') fb += a;
    else if (t.usali_dept === 'Spa') spa += a;
    else activity += a;
  }
  return { fb_usd: fb, spa_usd: spa, activity_usd: activity };
}

// ============================================================================
// DAILY SERIES FOR CHART
// ============================================================================

export async function getDailySeries(period: ResolvedPeriod): Promise<DailySeriesPoint[]> {
  const SELLABLE_ROOMS = 19;
  const FX = Number(process.env.NEXT_PUBLIC_FX_LAK_USD ?? 21800);
  const segF = segmentFilter(period.seg);

  // Fetch reservation_rooms in range
  let q = supabase
    .from('reservation_rooms')
    .select('date,rate,reservation_id')
    .gte('date', period.from).lte('date', period.to);

  // Apply segment via reservations join (less efficient, but correct)
  if (segF.column && segF.values && segF.values.length) {
    // Get reservation_ids in segment first
    const { data: ids } = await supabase
      .from('reservations')
      .select('reservation_id')
      .in(segF.column, segF.values);
    const idSet = new Set((ids ?? []).map((r: any) => r.reservation_id));
    if (idSet.size === 0) return [];
    q = q.in('reservation_id', Array.from(idSet));
  }

  const { data, error } = await q;
  if (error || !data) return [];

  // Group by date
  const map = new Map<string, { rooms: number; revenue: number }>();
  for (const r of data as any[]) {
    if (!r.date) continue;
    const cur = map.get(r.date) ?? { rooms: 0, revenue: 0 };
    cur.rooms += 1;
    cur.revenue += Number(r.rate || 0);
    map.set(r.date, cur);
  }

  return Array.from(map.entries())
    .map(([date, v]) => ({
      date,
      rooms_sold: v.rooms,
      room_revenue_usd: v.revenue,
      occupancy: v.rooms / SELLABLE_ROOMS,
    }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

// ============================================================================
// CHANNEL MIX
// ============================================================================

export async function getChannelMix(period: ResolvedPeriod, limit = 10): Promise<ChannelRow[]> {
  const FX = Number(process.env.NEXT_PUBLIC_FX_LAK_USD ?? 21800);

  let q = supabase
    .from('reservations')
    .select('source,total_amount,nights,is_cancelled,check_in_date,check_out_date')
    .lte('check_in_date', period.to)
    .gte('check_out_date', period.from);

  const segF = segmentFilter(period.seg);
  if (segF.column && segF.values && segF.values.length) {
    q = q.in(segF.column, segF.values);
  }

  const { data, error } = await q;
  if (error || !data) return [];

  const non = (data as any[]).filter(r => !r.is_cancelled);
  const map = new Map<string, { bookings: number; revenue: number; nights: number }>();
  for (const r of non) {
    const k = r.source ?? 'Unknown';
    const cur = map.get(k) ?? { bookings: 0, revenue: 0, nights: 0 };
    cur.bookings += 1;
    cur.revenue  += Number(r.total_amount || 0);
    cur.nights   += Number(r.nights || 0);
    map.set(k, cur);
  }

  const totalRev = Array.from(map.values()).reduce((s, v) => s + v.revenue, 0);
  return Array.from(map.entries())
    .map(([source, v]) => ({
      source,
      bookings: v.bookings,
      revenue_usd: v.revenue,
      revenue_lak: v.revenue * FX,
      pct_mix: totalRev > 0 ? v.revenue / totalRev : 0,
      adr_usd: v.nights > 0 ? v.revenue / v.nights : 0,
    }))
    .sort((a, b) => b.revenue_usd - a.revenue_usd)
    .slice(0, limit);
}

// ============================================================================
// TODAY SNAPSHOT — Right Now strip on Overview
// ============================================================================

export async function getTodaySnapshot(): Promise<TodaySnapshot> {
  const today = new Date().toISOString().slice(0, 10);
  const in90 = new Date(Date.now() + 90 * 86_400_000).toISOString().slice(0, 10);

  const [inHouse, arriving, departing, otb] = await Promise.all([
    supabase.from('reservations').select('reservation_id', { count: 'exact', head: true })
      .eq('is_cancelled', false).lte('check_in_date', today).gt('check_out_date', today),
    supabase.from('reservations').select('reservation_id', { count: 'exact', head: true })
      .eq('is_cancelled', false).eq('check_in_date', today),
    supabase.from('reservations').select('reservation_id', { count: 'exact', head: true })
      .eq('is_cancelled', false).eq('check_out_date', today),
    supabase.from('reservations').select('reservation_id', { count: 'exact', head: true })
      .eq('is_cancelled', false).gte('check_in_date', today).lte('check_in_date', in90),
  ]);

  return {
    in_house:    inHouse.count ?? 0,
    arriving:    arriving.count ?? 0,
    departing:   departing.count ?? 0,
    otb_next_90d: otb.count ?? 0,
  };
}

// ============================================================================
// DQ (count of open issues) — period-independent but kept here for convenience
// ============================================================================

export async function getDqOpenCount(): Promise<number> {
  const { count } = await supabase
    .from('dq_issues')
    .select('id', { count: 'exact', head: true })
    .neq('severity', 'low');
  return count ?? 0;
}
