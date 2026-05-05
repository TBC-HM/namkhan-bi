// lib/pulseData.ts
// Server-side fetchers for the 5 Pulse views deployed 2026-05-03 by the Cowork
// backend pass. Each function maps directly to one view; window selection is
// done at the page level so this file stays pure.
//
// Views (all in `public`, GRANT SELECT TO anon, authenticated):
//   v_room_type_pulse_{7,30,90}d   per-room-type occ/ADR/revenue + STLY
//   v_pace_curve                   day-by-day rooms occupied + STLY/Budget overlay (-90d..+120d)
//   v_pickup_velocity_28d          daily new bookings + 7d MA
//   v_channel_mix_categorized_30d  Direct/OTA/Wholesale/Group/Other rollup
//   v_daily_revenue_90d            daily revenue + STLY overlay (90d)
//
// Source-of-truth: COWORK_HANDOVER_PULSE_2026-05-03.md (verified live 2026-05-03).

import { supabase } from './supabase';
import type { WindowKey } from './period';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface RoomTypePulseRow {
  room_type_id: number;
  room_type_name: string;
  rooms: number;
  capacity_nights: number;
  room_nights_sold: number;
  occupancy_pct: number | null;
  adr_usd: number | null;
  revenue_usd: number | null;
  occupancy_pct_stly: number | null;
  adr_usd_stly: number | null;
  revenue_usd_stly: number | null;
}

export interface PaceCurveRow {
  day: string;                         // yyyy-mm-dd
  rooms_actual: number | null;
  rooms_otb: number | null;
  rooms_stly_daily_avg: number | null;
  rooms_budget_daily_avg: number | null;
  stly_month_total: number | null;
  budget_month_total: number | null;
}

export interface PickupVelocityRow {
  day: string;
  bookings_made: number;
  ma_7d: number;
  bucket: 'last_2_days' | 'last_3_wks' | '4_wks_ago' | string;
}

export interface ChannelMixCatRow {
  category: 'OTA' | 'Direct' | 'Wholesale' | 'Group' | 'Other' | string;
  bookings: number;
  room_nights: number;
  gross_revenue: number;
  net_revenue: number;
  net_revenue_pct: number;
  commission_leak: number;
}

export interface DailyRevenueRow {
  day: string;
  revenue_actual_usd: number;
  revenue_stly_daily_avg_usd: number | null;
}

// ─── Window coercion ──────────────────────────────────────────────────────────
// Pulse views only exist at 7d/30d/90d. Other URL windows are coerced to the
// nearest available bucket so the page never errors.
//
// Mapping logic:
//   7d / today  -> 7d
//   30d         -> 30d
//   90d / ytd / l12m / next180 / next365 -> 90d (longest available)
//   next7       -> 7d  (forward-looking, but bucket is past-only — best-effort)
//   next30      -> 30d
//   next90      -> 90d
export function pulseRoomTypeWin(win: WindowKey): '7d' | '30d' | '90d' {
  if (win === '7d' || win === 'today' || win === 'next7') return '7d';
  if (win === '30d' || win === 'next30') return '30d';
  return '90d'; // 90d, ytd, l12m, next90, next180, next365
}

// ─── Fetchers ─────────────────────────────────────────────────────────────────

/**
 * Per-room-type occupancy / ADR / revenue + STLY for ANY backward window.
 * Calls `public.f_room_type_pulse(p_window_days)` directly so YTD, L12M,
 * Today, and other non-7/30/90 backward windows all return true aggregates
 * instead of being silently coerced to 90d.
 *
 * Forward windows (next7/30/90/180/365) don't have a per-room-type
 * forward-OTB aggregation available — we fall back to 90d backward as a
 * sensible proxy. The page title surfaces "Last 90d (forward window)" so
 * the operator knows.
 */
export async function getRoomTypePulse(
  windowDays: number
): Promise<RoomTypePulseRow[]> {
  const days = Math.max(1, Math.min(windowDays, 366));
  const { data, error } = await supabase.rpc('f_room_type_pulse', {
    p_window_days: days,
  });
  if (error) return [];
  return ((data ?? []) as any[]).map((r) => ({
    room_type_id: Number(r.room_type_id),
    room_type_name: String(r.room_type_name ?? ''),
    rooms: Number(r.rooms ?? 0),
    capacity_nights: Number(r.capacity_nights ?? 0),
    room_nights_sold: Number(r.room_nights_sold ?? 0),
    occupancy_pct: r.occupancy_pct == null ? null : Number(r.occupancy_pct),
    adr_usd: r.adr_usd == null ? null : Number(r.adr_usd),
    revenue_usd: r.revenue_usd == null ? null : Number(r.revenue_usd),
    occupancy_pct_stly: r.occupancy_pct_stly == null ? null : Number(r.occupancy_pct_stly),
    adr_usd_stly: r.adr_usd_stly == null ? null : Number(r.adr_usd_stly),
    revenue_usd_stly: r.revenue_usd_stly == null ? null : Number(r.revenue_usd_stly),
  }));
}

/**
 * Pace curve, scoped to a window centered around today.
 * Default: -30d..+30d (matches the "Booking pace curve · May 2026" mockup feel).
 */
export async function getPaceCurve(daysBack = 30, daysForward = 30): Promise<PaceCurveRow[]> {
  const today = new Date();
  const fmt = (d: Date) => d.toISOString().slice(0, 10);
  const from = new Date(today); from.setDate(from.getDate() - daysBack);
  const to   = new Date(today); to.setDate(to.getDate() + daysForward);
  const { data, error } = await supabase
    .from('v_pace_curve')
    .select('day, rooms_actual, rooms_otb, rooms_stly_daily_avg, rooms_budget_daily_avg, stly_month_total, budget_month_total')
    .gte('day', fmt(from))
    .lte('day', fmt(to))
    .order('day', { ascending: true });
  if (error) return [];
  return ((data ?? []) as any[]).map((r) => ({
    day: String(r.day),
    rooms_actual: r.rooms_actual == null ? null : Number(r.rooms_actual),
    rooms_otb: r.rooms_otb == null ? null : Number(r.rooms_otb),
    rooms_stly_daily_avg: r.rooms_stly_daily_avg == null ? null : Number(r.rooms_stly_daily_avg),
    rooms_budget_daily_avg: r.rooms_budget_daily_avg == null ? null : Number(r.rooms_budget_daily_avg),
    stly_month_total: r.stly_month_total == null ? null : Number(r.stly_month_total),
    budget_month_total: r.budget_month_total == null ? null : Number(r.budget_month_total),
  }));
}

export async function getPickupVelocity28d(): Promise<PickupVelocityRow[]> {
  const { data, error } = await supabase
    .from('v_pickup_velocity_28d')
    .select('day, bookings_made, ma_7d, bucket')
    .order('day', { ascending: true });
  if (error) return [];
  return ((data ?? []) as any[]).map((r) => ({
    day: String(r.day),
    bookings_made: Number(r.bookings_made ?? 0),
    ma_7d: Number(r.ma_7d ?? 0),
    bucket: String(r.bucket ?? '4_wks_ago'),
  }));
}

export async function getChannelMixCategorized(): Promise<ChannelMixCatRow[]> {
  const { data, error } = await supabase
    .from('v_channel_mix_categorized_30d')
    .select('category, bookings, room_nights, gross_revenue, net_revenue, net_revenue_pct, commission_leak')
    .order('net_revenue', { ascending: false, nullsFirst: false });
  if (error) return [];
  return ((data ?? []) as any[]).map((r) => ({
    category: String(r.category ?? 'Other'),
    bookings: Number(r.bookings ?? 0),
    room_nights: Number(r.room_nights ?? 0),
    gross_revenue: Number(r.gross_revenue ?? 0),
    net_revenue: Number(r.net_revenue ?? 0),
    net_revenue_pct: Number(r.net_revenue_pct ?? 0),
    commission_leak: Number(r.commission_leak ?? 0),
  }));
}

/**
 * Channel mix for an arbitrary date range — used when ?win= is something
 * other than 30d (YTD, L12M, etc.). Backed by f_channel_mix_categorized_for_range.
 */
export async function getChannelMixCategorizedForRange(fromDate: string, toDate: string): Promise<ChannelMixCatRow[]> {
  const { data, error } = await supabase.rpc('f_channel_mix_categorized_for_range', {
    p_from: fromDate,
    p_to: toDate,
  });
  if (error) return [];
  return ((data ?? []) as any[]).map((r) => ({
    category: String(r.category ?? 'Other'),
    bookings: Number(r.bookings ?? 0),
    room_nights: Number(r.room_nights ?? 0),
    gross_revenue: Number(r.gross_revenue ?? 0),
    net_revenue: Number(r.net_revenue ?? 0),
    net_revenue_pct: Number(r.net_revenue_pct ?? 0),
    commission_leak: Number(r.commission_leak ?? 0),
  }));
}

/**
 * Daily revenue for an arbitrary date range — used when ?win= is something
 * other than 90d. Aggregates from mv_kpi_daily over period.from..period.to
 * with STLY = same dates -365 days.
 */
export async function getDailyRevenueForRange(fromDate: string, toDate: string): Promise<DailyRevenueRow[]> {
  const shift = (iso: string) => {
    const d = new Date(iso + 'T00:00:00Z');
    d.setUTCFullYear(d.getUTCFullYear() - 1);
    return d.toISOString().slice(0, 10);
  };
  const [cur, stly] = await Promise.all([
    supabase.from('mv_kpi_daily').select('night_date, rooms_revenue, total_ancillary_revenue').eq('property_id', 260955).gte('night_date', fromDate).lte('night_date', toDate).order('night_date'),
    supabase.from('mv_kpi_daily').select('night_date, rooms_revenue, total_ancillary_revenue').eq('property_id', 260955).gte('night_date', shift(fromDate)).lte('night_date', shift(toDate)).order('night_date'),
  ]);
  const stlyByShifted = new Map<string, number>();
  for (const r of ((stly.data ?? []) as any[])) {
    stlyByShifted.set(String(r.night_date), Number(r.rooms_revenue || 0) + Number(r.total_ancillary_revenue || 0));
  }
  return ((cur.data ?? []) as any[]).map((r) => {
    const day = String(r.night_date);
    const stlyDate = shift(day);
    return {
      day,
      revenue_actual_usd: Number(r.rooms_revenue || 0) + Number(r.total_ancillary_revenue || 0),
      revenue_stly_daily_avg_usd: stlyByShifted.get(stlyDate) ?? null,
    };
  });
}

export interface DecisionQueuedRow {
  decision_id: string;
  source_agent: string;
  scope_section: string;
  scope_tab: string;
  title: string;
  impact_usd: number | null;
  confidence_pct: number | null;
  velocity: string | null;
  status: string;
  created_at: string;
  expires_at: string | null;
  hours_open: number;
}

export async function getDecisionsQueuedTop(): Promise<DecisionQueuedRow[]> {
  const { data, error } = await supabase
    .from('v_decisions_queued_top')
    .select('decision_id, source_agent, scope_section, scope_tab, title, impact_usd, confidence_pct, velocity, status, created_at, expires_at, hours_open');
  if (error) return [];
  return ((data ?? []) as any[]).map((r) => ({
    decision_id: String(r.decision_id),
    source_agent: String(r.source_agent ?? ''),
    scope_section: String(r.scope_section ?? ''),
    scope_tab: String(r.scope_tab ?? ''),
    title: String(r.title ?? ''),
    impact_usd: r.impact_usd == null ? null : Number(r.impact_usd),
    confidence_pct: r.confidence_pct == null ? null : Number(r.confidence_pct),
    velocity: r.velocity == null ? null : String(r.velocity),
    status: String(r.status ?? ''),
    created_at: String(r.created_at ?? ''),
    expires_at: r.expires_at == null ? null : String(r.expires_at),
    hours_open: Number(r.hours_open ?? 0),
  }));
}

export interface TacticalAlertRow {
  alert_id: string;
  source: string;
  severity: string;
  title: string;
  description: string;
  dim_label: string;
  dim_value: string;
  detected_at: string;
  hours_open: number;
}

/**
 * Top 8 active tactical alerts unified across DQ violations, GL supplier
 * anomalies, staff anomalies, and compset promo signals. Sorted by severity
 * then recency. Reads from `public.v_tactical_alerts_top`.
 */
export async function getTacticalAlertsTop(): Promise<TacticalAlertRow[]> {
  const { data, error } = await supabase
    .from('v_tactical_alerts_top')
    .select('alert_id, source, severity, title, description, dim_label, dim_value, detected_at, hours_open');
  if (error) return [];
  return ((data ?? []) as any[]).map((r) => ({
    alert_id: String(r.alert_id),
    source: String(r.source),
    severity: String(r.severity),
    title: String(r.title),
    description: String(r.description),
    dim_label: String(r.dim_label),
    dim_value: String(r.dim_value),
    detected_at: String(r.detected_at),
    hours_open: Number(r.hours_open ?? 0),
  }));
}

export interface RoomTypeBudgetRow {
  room_type_id: number;
  room_type_name: string;
  budget_occupancy_pct: number;
}

/**
 * Per-room-type budget occupancy for a given calendar month.
 * Reads from `public.f_room_type_budget_occupancy(p_year, p_month)` which
 * pulls from plan.drivers where scenario is the active budget AND
 * room_type_id is populated. Returns [] when no per-room-type rows are
 * entered yet — the Pulse chart drops the Budget series gracefully.
 */
export async function getRoomTypeBudgetOccupancy(year: number, month: number): Promise<RoomTypeBudgetRow[]> {
  const { data, error } = await supabase.rpc('f_room_type_budget_occupancy', {
    p_year: year,
    p_month: month,
  });
  if (error) return [];
  return ((data ?? []) as any[]).map((r) => ({
    room_type_id: Number(r.room_type_id),
    room_type_name: String(r.room_type_name),
    budget_occupancy_pct: Number(r.budget_occupancy_pct),
  }));
}

export async function getDailyRevenue90d(): Promise<DailyRevenueRow[]> {
  const { data, error } = await supabase
    .from('v_daily_revenue_90d')
    .select('day, revenue_actual_usd, revenue_stly_daily_avg_usd')
    .order('day', { ascending: true });
  if (error) return [];
  return ((data ?? []) as any[]).map((r) => ({
    day: String(r.day),
    revenue_actual_usd: Number(r.revenue_actual_usd ?? 0),
    revenue_stly_daily_avg_usd: r.revenue_stly_daily_avg_usd == null ? null : Number(r.revenue_stly_daily_avg_usd),
  }));
}
