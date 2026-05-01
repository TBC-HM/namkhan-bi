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
// Exact-match buckets in mv_channel_economics. Other windows → live aggregator.
const MV_BUCKETS = new Set([7, 30, 60, 90, 180, 365]);

export async function getChannelEconomics(period?: ResolvedPeriod): Promise<ChannelEconRow[]> {
  const days = period?.days ?? 90;

  // Today (1d), YTD-mid-year, and any non-bucket window must NOT round up — that
  // gives misleading numbers (Today shows last 7d, etc.). Live aggregate instead.
  if (!MV_BUCKETS.has(days)) {
    return getChannelEconomicsLive(period);
  }

  const { data, error } = await supabase
    .from('mv_channel_economics')
    .select('*')
    .eq('property_id', PROPERTY_ID)
    .eq('window_days', days)
    .gt('bookings', 0)
    .order('gross_revenue', { ascending: false, nullsFirst: false });

  if (error) {
    console.error('getChannelEconomics error', error);
    return [];
  }
  return (data ?? []) as ChannelEconRow[];
}

// Live aggregator: bookings made within [period.from, period.to] grouped by source.
// Same semantics as the matview, just for arbitrary windows.
export async function getChannelEconomicsLive(period?: ResolvedPeriod): Promise<ChannelEconRow[]> {
  if (!period) return [];
  const fromDate = period.from;
  const toDate = period.to;

  // Build query with optional segment filter on market_segment
  const { segmentFilter } = await import('./period');
  const seg = segmentFilter(period.seg);

  let resQ = supabase
    .from('reservations')
    .select('source_name, status, total_amount, nights, check_in_date, booking_date, market_segment')
    .eq('property_id', PROPERTY_ID)
    .gte('booking_date', fromDate)
    .lte('booking_date', toDate);
  if (seg.column && seg.isNull) resQ = resQ.is(seg.column, null);
  else if (seg.column && seg.values && seg.values.length > 0) resQ = resQ.in(seg.column, seg.values);

  const [{ data: resRaw, error: e1 }, { data: comm, error: e2 }] = await Promise.all([
    resQ,
    supabase
      .from('v_commission_lookup')
      .select('source_name, commission_pct'),
  ]);

  if (e1) console.error('[channels live] reservations error', e1);
  if (e2) console.error('[channels live] commission error', e2);

  const commMap = new Map<string, number>();
  for (const c of (comm ?? []) as Array<{ source_name: string; commission_pct: number }>) {
    commMap.set(c.source_name ?? '', Number(c.commission_pct) || 0);
  }

  type Acc = { bookings: number; canceled: number; gross_revenue: number; roomnights: number; lead_sum: number; los_sum: number };
  const agg = new Map<string, Acc>();
  for (const r of (resRaw ?? []) as any[]) {
    const src = String(r.source_name ?? '(unknown)');
    if (!agg.has(src)) agg.set(src, { bookings: 0, canceled: 0, gross_revenue: 0, roomnights: 0, lead_sum: 0, los_sum: 0 });
    const a = agg.get(src)!;
    const cancelled = r.status === 'canceled' || r.status === 'no_show';
    if (cancelled) {
      a.canceled += 1;
    } else {
      a.bookings += 1;
      a.gross_revenue += Number(r.total_amount) || 0;
      a.roomnights += Number(r.nights) || 0;
      a.los_sum += Number(r.nights) || 0;
      if (r.check_in_date && r.booking_date) {
        const ci = new Date(r.check_in_date).getTime();
        const bk = new Date(r.booking_date).getTime();
        a.lead_sum += Math.max(0, (ci - bk) / 86400000);
      }
    }
  }

  const out: ChannelEconRow[] = [];
  for (const [src, a] of agg) {
    if (a.bookings === 0 && a.canceled === 0) continue;
    const commission_pct = commMap.get(src) ?? 0;
    const gross_revenue = a.gross_revenue;
    const commission_usd = Math.round((gross_revenue * commission_pct) / 100 * 100) / 100;
    const net_revenue = Math.round(gross_revenue * (1 - commission_pct / 100) * 100) / 100;
    const adr = a.bookings > 0 ? Math.round((gross_revenue / a.bookings) * 100) / 100 : 0;
    const cancel_pct = a.bookings > 0 ? Math.round((a.canceled * 10000) / a.bookings) / 100 : 0;
    const avg_lead_days = a.bookings > 0 ? Math.round((a.lead_sum / a.bookings) * 10) / 10 : 0;
    const avg_los = a.bookings > 0 ? Math.round((a.los_sum / a.bookings) * 100) / 100 : 0;
    out.push({
      property_id: PROPERTY_ID,
      source_name: src,
      window_days: period.days,
      bookings: a.bookings,
      canceled: a.canceled,
      gross_revenue,
      roomnights: a.roomnights,
      commission_pct,
      commission_usd,
      net_revenue,
      adr,
      cancel_pct,
      avg_lead_days,
      avg_los,
    });
  }
  out.sort((a, b) => b.gross_revenue - a.gross_revenue);
  return out.filter((r) => r.bookings > 0);
}

/**
 * OTA × Room-type matrix. Matview keyed by window_days ∈ {30, 90, 365}.
 * For other windows we round up to the nearest available bucket.
 */
const MATRIX_BUCKETS = new Set([30, 90, 365]);

export async function getChannelXRoomtype(period?: ResolvedPeriod): Promise<ChannelXRoomRow[]> {
  const d = period?.days ?? 90;

  // For windows that don't match a matrix bucket exactly → live aggregate.
  if (!MATRIX_BUCKETS.has(d)) {
    return getChannelXRoomtypeLive(period);
  }

  const { data, error } = await supabase
    .from('mv_channel_x_roomtype')
    .select('*')
    .eq('property_id', PROPERTY_ID)
    .eq('window_days', d)
    .gt('bookings', 0);

  if (error) {
    console.error('getChannelXRoomtype error', error);
    return [];
  }
  return (data ?? []) as ChannelXRoomRow[];
}

export async function getChannelXRoomtypeLive(period?: ResolvedPeriod): Promise<ChannelXRoomRow[]> {
  if (!period) return [];
  const { segmentFilter } = await import('./period');
  const seg = segmentFilter(period.seg);
  let q = supabase
    .from('reservations')
    .select('source_name, room_type_name, status, total_amount, nights, booking_date, market_segment')
    .eq('property_id', PROPERTY_ID)
    .gte('booking_date', period.from)
    .lte('booking_date', period.to);
  if (seg.column && seg.isNull) q = q.is(seg.column, null);
  else if (seg.column && seg.values && seg.values.length > 0) q = q.in(seg.column, seg.values);
  const { data, error } = await q;
  if (error) {
    console.error('[matrix live] error', error);
    return [];
  }

  type Acc = { bookings: number; canceled: number; revenue: number; roomnights: number };
  const m = new Map<string, Acc & { source_name: string; room_type_name: string }>();
  for (const r of (data ?? []) as any[]) {
    const src = String(r.source_name ?? '(unknown)');
    const room = String(r.room_type_name ?? '(unknown)');
    const key = src + '|' + room;
    if (!m.has(key)) m.set(key, { source_name: src, room_type_name: room, bookings: 0, canceled: 0, revenue: 0, roomnights: 0 });
    const a = m.get(key)!;
    if (r.status === 'canceled' || r.status === 'no_show') {
      a.canceled += 1;
    } else {
      a.bookings += 1;
      a.revenue += Number(r.total_amount) || 0;
      a.roomnights += Number(r.nights) || 0;
    }
  }
  const out: ChannelXRoomRow[] = [];
  for (const a of m.values()) {
    if (a.bookings === 0) continue;
    const adr = a.bookings > 0 ? Math.round((a.revenue / a.bookings) * 100) / 100 : 0;
    const cancel_pct = a.bookings > 0 ? Math.round((a.canceled * 10000) / a.bookings) / 100 : 0;
    out.push({
      property_id: PROPERTY_ID,
      source_name: a.source_name,
      room_type_name: a.room_type_name,
      room_type_name_short: a.room_type_name,
      window_days: period.days,
      bookings: a.bookings,
      canceled: a.canceled,
      revenue: a.revenue,
      roomnights: a.roomnights,
      adr,
      cancel_pct,
    });
  }
  return out;
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
