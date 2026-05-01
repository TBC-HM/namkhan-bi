// lib/data-channels.ts
// Append-friendly module: new helpers for the period-keyed channel economics
// matviews introduced in sql/02_channel_economics_window.sql.
//
// Why a separate file:
//   • Keeps the diff tiny — no surgery on the existing lib/data.ts
//   • If sql/02 is not yet applied, importing this won't break anything
//     unrelated; consumer pages will fall back to empty arrays
//
// To use: add to your page imports as:
//   import { getChannelEconomics, getChannelXRoomtype } from '@/lib/data-channels';

import { supabase, PROPERTY_ID } from './supabase';
import type { ResolvedPeriod } from './period';

// Bucket the user's requested window into the closest matview bucket
// (matview is keyed by window_days ∈ {7,30,60,90,180,365}).
function matchWindow(period?: ResolvedPeriod): number {
  if (!period) return 90;
  const d = period.days;
  // Prefer exact-or-slightly-larger bucket
  if (d <= 7) return 7;
  if (d <= 30) return 30;
  if (d <= 60) return 60;
  if (d <= 90) return 90;
  if (d <= 180) return 180;
  return 365;
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
 * Channel economics for the requested period window. Matviews built by
 * sql/02_channel_economics_window.sql. Returns rows ordered by gross_revenue desc.
 *
 * Falls back gracefully if matview not yet created (returns []).
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
 * OTA × Room-type matrix. Matview keyed by window_days ∈ {30, 90, 365}.
 * For other windows we round up to the nearest available bucket.
 */
export async function getChannelXRoomtype(period?: ResolvedPeriod): Promise<ChannelXRoomRow[]> {
  const d = period?.days ?? 90;
  const window_days = d <= 30 ? 30 : d <= 90 ? 90 : 365;

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

/**
 * Pivot the matrix rows into a tabular structure for rendering.
 *   { roomTypes: ['Riverview Suite', ...],
 *     sources:   ['Booking.com', 'Direct', ...],
 *     cells:     { 'Booking.com|Riverview Suite': { revenue, bookings, adr, cancel_pct } } }
 */
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
