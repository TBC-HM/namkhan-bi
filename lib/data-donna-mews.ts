// lib/data-donna-mews.ts
//
// PBS 2026-05-16: Property-aware fetchers for Donna (property_id=1000001)
// that read from the Mews-imported tables and shape the result like the
// Cloudbeds-side canonical fetchers so the same shells can render either
// property.
//
// 2026-05-18 (claude_md v3.1 §0.5 fix): PostgREST only exposes `public` —
// the original `.from('reservations_mews')` calls silently returned [] because
// the base tables live in `pms`. Now reads via public bridge views:
//   public.pms_reservations_mews        -> pms.reservations_mews
//   public.pms_reservation_rooms_mews   -> pms.reservation_rooms_mews
//   public.pms_rate_plans_mews          -> pms.rate_plans_mews
// The Pulse function's FK embed (`reservations_mews!inner(is_cancelled)`) is
// refactored into a separate cancelled-id fetch + JS filter so it stops
// depending on PostgREST view-FK detection.
//
// Capacity is derived: 66 distinct room_ids observed in reservation_rooms_mews
// for 2025+. When core.properties grows a room_count column, swap this const.

import { supabase } from './supabase';

export const DONNA_PROPERTY_ID = 1000001;
export const DONNA_ROOM_COUNT = 66;

export interface DonnaPulseKpis {
  fromDate: string;
  toDate: string;
  numDays: number;
  rooms: number;
  rnSold: number;
  roomsAvailable: number;
  occupancyPct: number;
  roomsRevenueEur: number;
  adrEur: number;
  revparEur: number;
  trevparEur: number;     // = revpar today (no ancillary revenue in Mews import yet)
  cancelPct: number;
  alosNights: number;
  leadTimeDays: number | null;
  // For chart series
  daily: { day: string; rn: number; revenue_eur: number }[];
}

function daysBetween(from: string, to: string): number {
  const d1 = new Date(from + 'T00:00:00Z').getTime();
  const d2 = new Date(to + 'T00:00:00Z').getTime();
  return Math.max(1, Math.round((d2 - d1) / 86_400_000) + 1);
}

export async function getDonnaPulseKpis(
  fromDate: string,
  toDate: string,
): Promise<DonnaPulseKpis> {
  // 1) Per-night rate rows for the window. PostgREST view-FK detection is
  // unreliable, so we fetch night rows and cancelled IDs separately and
  // filter in JS (claude_md v3.1 §0.5).
  const [{ data: nightRows, error: nightsErr }, { data: cancelledRows }] = await Promise.all([
    supabase
      .from('pms_reservation_rooms_mews')
      .select('night_date, rate, reservation_id')
      .eq('property_id', DONNA_PROPERTY_ID)
      .gte('night_date', fromDate)
      .lte('night_date', toDate),
    supabase
      .from('pms_reservations_mews')
      .select('reservation_id')
      .eq('property_id', DONNA_PROPERTY_ID)
      .eq('is_cancelled', true),
  ]);

  if (nightsErr) {
    // soft-fail: return zeros so the page still renders
    return zeroResult(fromDate, toDate);
  }
  const cancelledIds = new Set<string>((cancelledRows ?? []).map((r: any) => String(r.reservation_id)));
  const rows = ((nightRows ?? []) as any[]).filter((r) => !cancelledIds.has(String(r.reservation_id)));
  const rnSold = rows.length;
  const roomsRevenue = rows.reduce((s, r) => s + Number(r.rate || 0), 0);
  const numDays = daysBetween(fromDate, toDate);
  const roomsAvailable = DONNA_ROOM_COUNT * numDays;

  // Per-day rollup for daily chart
  const dailyMap = new Map<string, { rn: number; revenue_eur: number }>();
  for (const r of rows) {
    const k = String(r.night_date);
    const cur = dailyMap.get(k) ?? { rn: 0, revenue_eur: 0 };
    cur.rn += 1;
    cur.revenue_eur += Number(r.rate || 0);
    dailyMap.set(k, cur);
  }
  const daily = Array.from(dailyMap.entries())
    .map(([day, v]) => ({ day, rn: v.rn, revenue_eur: Math.round(v.revenue_eur) }))
    .sort((a, b) => (a.day < b.day ? -1 : 1));

  // 2) Reservation-level rollup for cancel% + ALOS + lead time
  const { data: resvRows } = await supabase
    .from('pms_reservations_mews')
    .select('reservation_id, nights, check_in_date, booking_date, is_cancelled')
    .eq('property_id', DONNA_PROPERTY_ID)
    .gte('check_in_date', fromDate)
    .lte('check_in_date', toDate);
  const resvs = (resvRows ?? []) as any[];
  const totalResvs = resvs.length;
  const cancelled = resvs.filter((r) => r.is_cancelled === true).length;
  const cancelPct = totalResvs > 0 ? (cancelled / totalResvs) * 100 : 0;

  const live = resvs.filter((r) => r.is_cancelled !== true);
  const sumNights = live.reduce((s, r) => s + Number(r.nights || 0), 0);
  const alos = live.length > 0 ? sumNights / live.length : 0;

  const leadTimes = live
    .filter((r) => r.booking_date && r.check_in_date)
    .map((r) => {
      const bd = new Date(String(r.booking_date)).getTime();
      const ci = new Date(String(r.check_in_date) + 'T00:00:00Z').getTime();
      return Math.max(0, Math.round((ci - bd) / 86_400_000));
    });
  const leadTime = leadTimes.length > 0 ? leadTimes.reduce((s, n) => s + n, 0) / leadTimes.length : null;

  const adr = rnSold > 0 ? roomsRevenue / rnSold : 0;
  const occupancyPct = roomsAvailable > 0 ? (rnSold / roomsAvailable) * 100 : 0;
  const revpar = roomsAvailable > 0 ? roomsRevenue / roomsAvailable : 0;

  return {
    fromDate, toDate, numDays,
    rooms: DONNA_ROOM_COUNT,
    rnSold,
    roomsAvailable,
    occupancyPct,
    roomsRevenueEur: roomsRevenue,
    adrEur: adr,
    revparEur: revpar,
    trevparEur: revpar, // F&B / spa ancillary not yet in Mews import
    cancelPct,
    alosNights: alos,
    leadTimeDays: leadTime,
    daily,
  };
}

// ─── PACE (OTB / future-looking) ─────────────────────────────────────────────

export interface DonnaPaceKpis {
  fromDate: string;
  toDate: string;
  numDays: number;
  otbReservations: number;
  otbRn: number;
  otbRevenueEur: number;
  otbAdrEur: number;
  otbOccupancyPct: number;
  alosNights: number;
  cancelPctOnWindow: number;
  byMonth: { month: string; rn: number; revenue_eur: number; reservations: number }[];
}

export async function getDonnaPaceKpis(fromDate: string, toDate: string): Promise<DonnaPaceKpis> {
  const numDays = daysBetween(fromDate, toDate);
  const { data: resvAll } = await supabase
    .from('pms_reservations_mews')
    .select('reservation_id, nights, total_amount, check_in_date, is_cancelled')
    .eq('property_id', DONNA_PROPERTY_ID)
    .gte('check_in_date', fromDate)
    .lte('check_in_date', toDate);
  const all = (resvAll ?? []) as any[];
  const live = all.filter((r) => r.is_cancelled !== true);
  const cancelled = all.length - live.length;
  const cancelPct = all.length > 0 ? (cancelled / all.length) * 100 : 0;

  const rn = live.reduce((s, r) => s + Number(r.nights || 0), 0);
  const rev = live.reduce((s, r) => s + Number(r.total_amount || 0), 0);
  const adr = rn > 0 ? rev / rn : 0;
  const occ = numDays > 0 ? (rn / (DONNA_ROOM_COUNT * numDays)) * 100 : 0;
  const alos = live.length > 0 ? rn / live.length : 0;

  const monthMap = new Map<string, { rn: number; revenue_eur: number; reservations: number }>();
  for (const r of live) {
    const k = String(r.check_in_date).slice(0, 7);
    const cur = monthMap.get(k) ?? { rn: 0, revenue_eur: 0, reservations: 0 };
    cur.rn += Number(r.nights || 0);
    cur.revenue_eur += Number(r.total_amount || 0);
    cur.reservations += 1;
    monthMap.set(k, cur);
  }
  const byMonth = Array.from(monthMap.entries())
    .map(([month, v]) => ({ month, rn: v.rn, revenue_eur: Math.round(v.revenue_eur), reservations: v.reservations }))
    .sort((a, b) => (a.month < b.month ? -1 : 1));

  return {
    fromDate, toDate, numDays,
    otbReservations: live.length,
    otbRn: rn,
    otbRevenueEur: rev,
    otbAdrEur: adr,
    otbOccupancyPct: occ,
    alosNights: alos,
    cancelPctOnWindow: cancelPct,
    byMonth,
  };
}

// ─── CHANNELS ────────────────────────────────────────────────────────────────

export type ChannelCategory = 'Direct' | 'OTA' | 'Wholesale' | 'Other';

const DIRECT_RX = /witbooking|email|telephone|in[- ]?person|website|walk[- ]?in|direct|booking engine/i;
const OTA_RX = /booking\.com|expedia|hotels\.com|agoda|airbnb|trip\.com|ctrip/i;
const WHOLESALE_RX = /sunhotels|hotelbeds|webbeds|tourico|gta|miki|dmc|wholesaler|jetline|getaroom/i;

export function classifyChannel(sourceName: string | null | undefined): ChannelCategory {
  const s = (sourceName ?? '').trim();
  if (DIRECT_RX.test(s)) return 'Direct';
  if (OTA_RX.test(s)) return 'OTA';
  if (WHOLESALE_RX.test(s)) return 'Wholesale';
  return 'Other';
}

export interface DonnaChannelRow {
  source_name: string;
  category: ChannelCategory;
  reservations: number;
  rn: number;
  revenue_eur: number;
  avg_lead_time_days: number | null;
}

export interface DonnaChannelsKpis {
  fromDate: string;
  toDate: string;
  totalRevenueEur: number;
  directPct: number;
  otaPct: number;
  wholesalePct: number;
  otherPct: number;
  avgLeadTimeDays: number | null;
  rows: DonnaChannelRow[];
}

export async function getDonnaChannelsKpis(fromDate: string, toDate: string): Promise<DonnaChannelsKpis> {
  const { data: resvRows } = await supabase
    .from('pms_reservations_mews')
    .select('source_name, nights, total_amount, check_in_date, booking_date, is_cancelled')
    .eq('property_id', DONNA_PROPERTY_ID)
    .gte('check_in_date', fromDate)
    .lte('check_in_date', toDate);
  const live = ((resvRows ?? []) as any[]).filter((r) => r.is_cancelled !== true);

  const agg = new Map<string, { reservations: number; rn: number; revenue_eur: number; leadTimeSum: number; leadTimeCount: number }>();
  for (const r of live) {
    const key = String(r.source_name ?? '— unknown —');
    const cur = agg.get(key) ?? { reservations: 0, rn: 0, revenue_eur: 0, leadTimeSum: 0, leadTimeCount: 0 };
    cur.reservations += 1;
    cur.rn += Number(r.nights || 0);
    cur.revenue_eur += Number(r.total_amount || 0);
    if (r.booking_date && r.check_in_date) {
      const bd = new Date(String(r.booking_date)).getTime();
      const ci = new Date(String(r.check_in_date) + 'T00:00:00Z').getTime();
      cur.leadTimeSum += Math.max(0, Math.round((ci - bd) / 86_400_000));
      cur.leadTimeCount += 1;
    }
    agg.set(key, cur);
  }

  const rows: DonnaChannelRow[] = Array.from(agg.entries())
    .map(([source_name, v]) => ({
      source_name,
      category: classifyChannel(source_name),
      reservations: v.reservations,
      rn: v.rn,
      revenue_eur: Math.round(v.revenue_eur),
      avg_lead_time_days: v.leadTimeCount > 0 ? Math.round(v.leadTimeSum / v.leadTimeCount) : null,
    }))
    .sort((a, b) => b.revenue_eur - a.revenue_eur);

  const totalRev = rows.reduce((s, r) => s + r.revenue_eur, 0);
  const sumCat = (c: ChannelCategory) => rows.filter((r) => r.category === c).reduce((s, r) => s + r.revenue_eur, 0);
  const direct = sumCat('Direct');
  const ota = sumCat('OTA');
  const wholesale = sumCat('Wholesale');
  const other = sumCat('Other');

  const totalLead = rows.reduce((s, r) => s + (r.avg_lead_time_days ?? 0) * r.reservations, 0);
  const totalRsvWithLead = rows.reduce((s, r) => s + (r.avg_lead_time_days != null ? r.reservations : 0), 0);
  const avgLead = totalRsvWithLead > 0 ? Math.round(totalLead / totalRsvWithLead) : null;

  return {
    fromDate, toDate,
    totalRevenueEur: totalRev,
    directPct: totalRev > 0 ? (direct / totalRev) * 100 : 0,
    otaPct: totalRev > 0 ? (ota / totalRev) * 100 : 0,
    wholesalePct: totalRev > 0 ? (wholesale / totalRev) * 100 : 0,
    otherPct: totalRev > 0 ? (other / totalRev) * 100 : 0,
    avgLeadTimeDays: avgLead,
    rows,
  };
}

// ─── RATE PLANS ──────────────────────────────────────────────────────────────

export interface DonnaRatePlanRow {
  rate_plan: string;
  reservations: number;
  rn: number;
  revenue_eur: number;
  adr_eur: number;
}

export interface DonnaRateplansKpis {
  fromDate: string;
  toDate: string;
  activePlans: number;
  sleepingPlans: number;
  top3ConcentrationPct: number;
  rows: DonnaRatePlanRow[];
}

export async function getDonnaRateplansKpis(fromDate: string, toDate: string): Promise<DonnaRateplansKpis> {
  const { data: resvRows } = await supabase
    .from('pms_reservations_mews')
    .select('rate_plan, nights, total_amount, is_cancelled')
    .eq('property_id', DONNA_PROPERTY_ID)
    .gte('check_in_date', fromDate)
    .lte('check_in_date', toDate);
  const live = ((resvRows ?? []) as any[]).filter((r) => r.is_cancelled !== true);

  const agg = new Map<string, { reservations: number; rn: number; revenue_eur: number }>();
  for (const r of live) {
    const key = String(r.rate_plan ?? '— unknown —');
    const cur = agg.get(key) ?? { reservations: 0, rn: 0, revenue_eur: 0 };
    cur.reservations += 1;
    cur.rn += Number(r.nights || 0);
    cur.revenue_eur += Number(r.total_amount || 0);
    agg.set(key, cur);
  }
  const rows: DonnaRatePlanRow[] = Array.from(agg.entries())
    .map(([rate_plan, v]) => ({
      rate_plan,
      reservations: v.reservations,
      rn: v.rn,
      revenue_eur: Math.round(v.revenue_eur),
      adr_eur: v.rn > 0 ? Math.round(v.revenue_eur / v.rn) : 0,
    }))
    .sort((a, b) => b.reservations - a.reservations);

  const totalResv = rows.reduce((s, r) => s + r.reservations, 0);
  const top3 = rows.slice(0, 3).reduce((s, r) => s + r.reservations, 0);
  const top3pct = totalResv > 0 ? (top3 / totalResv) * 100 : 0;

  // "Sleeping" = pre-seeded in rate_plans_mews but no reservations in window
  const { count: seededCount } = await supabase
    .from('pms_rate_plans_mews')
    .select('rate_id', { count: 'exact', head: true })
    .eq('property_id', DONNA_PROPERTY_ID);
  const sleepingPlans = Math.max(0, (seededCount ?? 0) - rows.length);

  return {
    fromDate, toDate,
    activePlans: rows.length,
    sleepingPlans,
    top3ConcentrationPct: top3pct,
    rows,
  };
}

function zeroResult(fromDate: string, toDate: string): DonnaPulseKpis {
  return {
    fromDate, toDate,
    numDays: daysBetween(fromDate, toDate),
    rooms: DONNA_ROOM_COUNT,
    rnSold: 0,
    roomsAvailable: DONNA_ROOM_COUNT * daysBetween(fromDate, toDate),
    occupancyPct: 0,
    roomsRevenueEur: 0,
    adrEur: 0,
    revparEur: 0,
    trevparEur: 0,
    cancelPct: 0,
    alosNights: 0,
    leadTimeDays: null,
    daily: [],
  };
}
