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
