// lib/data-channels.ts — REPLACEMENT (2026-05-02)
//
// Fixes:
//   1. matchWindow() now respects win=today (→ 1), win=ytd (→ 9999),
//      and forward windows next7/30/90 (→ -7/-30/-90).
//      Previously today silently fell through to the 7d bucket.
//   2. getChannelXRoomtype now also supports the same window keys.
//   3. Forward windows query check_in_date-bound buckets, backward windows
//      query booking_date-bound buckets — now matches mv definition.
//
// Required SQL: phase2_fix_timezone_property_local_for_today_windows
// (already applied to kpenyneooigsyuuomgct).
//
// Cowork patch (2026-05-02): replaced `period.forward` with
// `period.direction === 'fwd'` (ResolvedPeriod uses `direction`, not `forward`).
// Removed unreachable '60d' / 'mtd' switch cases — not in WindowKey union.

import { supabase, PROPERTY_ID } from './supabase';
import type { ResolvedPeriod } from './period';

// Bucket the user's requested window into the matview's window_days key.
// Convention used in mv_channel_economics & mv_channel_x_roomtype:
//   1     = TODAY      (booking_date = property_today)
//   7,30,60,90,180,365 = backward windows on booking_date
//   9999  = YTD
//   -7,-30,-90 = forward arrival windows on check_in_date
function matchWindow(period?: ResolvedPeriod): number {
  if (!period) return 30;

  // Map directly off the WindowKey enum first (preferred path)
  switch (period.win) {
    case 'today':   return 1;
    case '7d':      return 7;
    case '30d':     return 30;
    case '90d':     return 90;
    case 'l12m':    return 365;
    case 'ytd':     return 9999;
    case 'next7':   return -7;
    case 'next30':  return -30;
    case 'next90':  return -90;
    case 'next180': return 180;
    case 'next365': return 365;
  }

  // Fallback: inspect period.days (legacy callers)
  const d = period.days ?? 30;
  if (period.direction === 'fwd') {
    if (d <= 7)  return -7;
    if (d <= 30) return -30;
    return -90;
  }
  if (d <= 1)   return 1;
  if (d <= 7)   return 7;
  if (d <= 30)  return 30;
  if (d <= 60)  return 60;
  if (d <= 90)  return 90;
  if (d <= 180) return 180;
  return 365;
}

// Same logic but for the OTA × Room-type matrix matview.
// It now exposes the SAME windows as mv_channel_economics
// (was previously limited to {30,90,365}).
function matchWindowMatrix(period?: ResolvedPeriod): number {
  return matchWindow(period);
}

export interface ChannelEconRow {
  property_id: number;
  source_name: string;
  window_days: number;
  bookings: number;
  canceled: number;
  gross_revenue: number;
  roomnights: number;
  commission_pct: number;
  commission_usd: number;
  net_revenue: number;
  adr: number;
  cancel_pct: number;
  avg_lead_days: number;
  avg_los: number;
}

export interface ChannelXRoomRow {
  property_id: number;
  source_name: string;
  room_type_name: string;
  room_type_name_short: string;
  window_days: number;
  bookings: number;
  canceled: number;
  revenue: number;
  roomnights: number;
  adr: number;
  cancel_pct: number;
}

/**
 * Channel economics for the requested period window.
 * Falls back gracefully if matview not yet refreshed (returns []).
 */
export async function getChannelEconomics(period?: ResolvedPeriod): Promise<ChannelEconRow[]> {
  const window_days = matchWindow(period);
  const { data, error } = await supabase
    .from('mv_channel_economics')
    .select('*')
    .eq('property_id', PROPERTY_ID)
    .eq('window_days', window_days)
    .gt('bookings', 0)
    .order('gross_revenue', { ascending: false, nullsFirst: false });

  if (error) {
    console.error('getChannelEconomics error', error);
    return [];
  }
  return (data ?? []) as ChannelEconRow[];
}

/**
 * OTA × Room-type matrix. Now accepts ALL the same window keys as
 * getChannelEconomics (1, 7, 30, 60, 90, 180, 365, 9999, -7, -30, -90).
 */
export async function getChannelXRoomtype(period?: ResolvedPeriod): Promise<ChannelXRoomRow[]> {
  const window_days = matchWindowMatrix(period);
  const { data, error } = await supabase
    .from('mv_channel_x_roomtype')
    .select('*')
    .eq('property_id', PROPERTY_ID)
    .eq('window_days', window_days)
    .gt('bookings', 0);

  if (error) {
    console.error('getChannelXRoomtype error', error);
    return [];
  }
  return (data ?? []) as ChannelXRoomRow[];
}

export function pivotChannelXRoom(rows: ChannelXRoomRow[]) {
  const sourceTotals: Record<string, number> = {};
  const roomTotals: Record<string, number> = {};
  const cells: Record<string, ChannelXRoomRow> = {};

  rows.forEach(r => {
    sourceTotals[r.source_name] = (sourceTotals[r.source_name] || 0) + Number(r.revenue || 0);
    roomTotals[r.room_type_name] = (roomTotals[r.room_type_name] || 0) + Number(r.revenue || 0);
    cells[`${r.source_name}|${r.room_type_name}`] = r;
  });

  const sources = Object.keys(sourceTotals).sort((a, b) => sourceTotals[b] - sourceTotals[a]);
  const roomTypes = Object.keys(roomTotals).sort((a, b) => roomTotals[b] - roomTotals[a]);

  return { sources, roomTypes, cells, sourceTotals, roomTotals };
}

// ─── Restored 2026-05-06 — readers for /revenue/channels mini graphs and per-OTA detail page ──────

export interface ChannelMixWeeklyRow { week_start: string; category: string; gross_revenue: number; share_pct: number; }
export interface ChannelNetValueRow { source_name: string; bookings: number; net_value_per_booking: number; gross_revenue: number; commission_pct: number; cancel_pct: number; }
export interface ChannelVelocityRow { day: string; category: string; bookings: number; }
export interface ChannelDailyRow { day: string; bookings: number; room_nights: number; gross_revenue: number; }
export interface ChannelRoomMixRow { room_type_name: string; bookings: number; room_nights: number; gross_revenue: number; share_pct: number; }

/** Per-source channel economics for an arbitrary date range. Backed by `f_channel_econ_for_range`. */
export async function getChannelEconomicsForRange(fromDate: string, toDate: string): Promise<ChannelEconRow[]> {
  const { data, error } = await supabase.rpc('f_channel_econ_for_range', { p_from: fromDate, p_to: toDate });
  if (error) { console.error('getChannelEconomicsForRange error', error); return []; }
  return ((data ?? []) as any[]).map((r) => ({
    property_id: Number(r.property_id ?? PROPERTY_ID),
    source_name: String(r.source_name),
    window_days: Number(r.window_days ?? 0),
    bookings: Number(r.bookings ?? 0),
    canceled: Number(r.canceled ?? 0),
    gross_revenue: Number(r.gross_revenue ?? 0),
    roomnights: Number(r.roomnights ?? 0),
    commission_pct: Number(r.commission_pct ?? 0),
    commission_usd: Number(r.commission_usd ?? 0),
    net_revenue: Number(r.net_revenue ?? 0),
    adr: Number(r.adr ?? 0),
    cancel_pct: Number(r.cancel_pct ?? 0),
    avg_lead_days: Number(r.avg_lead_days ?? 0),
    avg_los: Number(r.avg_los ?? 0),
  }));
}

export async function getChannelMixWeeklyTrend(fromDate: string, toDate: string): Promise<ChannelMixWeeklyRow[]> {
  const { data, error } = await supabase.rpc('f_channel_mix_weekly_trend', { p_from: fromDate, p_to: toDate });
  if (error) return [];
  return ((data ?? []) as any[]).map((r) => ({
    week_start: String(r.week_start),
    category: String(r.category),
    gross_revenue: Number(r.gross_revenue ?? 0),
    share_pct: Number(r.share_pct ?? 0),
  }));
}

export async function getChannelNetValueForRange(fromDate: string, toDate: string): Promise<ChannelNetValueRow[]> {
  const { data, error } = await supabase.rpc('f_channel_net_value_for_range', { p_from: fromDate, p_to: toDate });
  if (error) return [];
  return ((data ?? []) as any[]).map((r) => ({
    source_name: String(r.source_name),
    bookings: Number(r.bookings ?? 0),
    net_value_per_booking: Number(r.net_value_per_booking ?? 0),
    gross_revenue: Number(r.gross_revenue ?? 0),
    commission_pct: Number(r.commission_pct ?? 0),
    cancel_pct: Number(r.cancel_pct ?? 0),
  }));
}

export async function getChannelVelocity28dByCat(): Promise<ChannelVelocityRow[]> {
  const { data, error } = await supabase.rpc('f_channel_velocity_28d_by_cat');
  if (error) return [];
  return ((data ?? []) as any[]).map((r) => ({
    day: String(r.day),
    category: String(r.category),
    bookings: Number(r.bookings ?? 0),
  }));
}

export async function getChannelDailyForRange(sourceName: string, fromDate: string, toDate: string): Promise<ChannelDailyRow[]> {
  const { data, error } = await supabase.rpc('f_channel_daily_for_range', { p_source_name: sourceName, p_from: fromDate, p_to: toDate });
  if (error) return [];
  return ((data ?? []) as any[]).map((r) => ({
    day: String(r.day),
    bookings: Number(r.bookings ?? 0),
    room_nights: Number(r.room_nights ?? 0),
    gross_revenue: Number(r.gross_revenue ?? 0),
  }));
}

export async function getChannelRoomMixForRange(sourceName: string, fromDate: string, toDate: string): Promise<ChannelRoomMixRow[]> {
  const { data, error } = await supabase.rpc('f_channel_room_mix_for_range', { p_source_name: sourceName, p_from: fromDate, p_to: toDate });
  if (error) return [];
  return ((data ?? []) as any[]).map((r) => ({
    room_type_name: String(r.room_type_name ?? '—'),
    bookings: Number(r.bookings ?? 0),
    room_nights: Number(r.room_nights ?? 0),
    gross_revenue: Number(r.gross_revenue ?? 0),
    share_pct: Number(r.share_pct ?? 0),
  }));
}

export async function getChannelPickupForSource(sourceName: string, lookbackDays = 28): Promise<ChannelDailyRow[]> {
  const { data, error } = await supabase.rpc('f_channel_pickup_for_source', { p_source_name: sourceName, p_lookback_days: lookbackDays });
  if (error) return [];
  return ((data ?? []) as any[]).map((r) => ({
    day: String(r.day),
    bookings: Number(r.bookings ?? 0),
    room_nights: 0,
    gross_revenue: 0,
  }));
}
