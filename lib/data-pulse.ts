// lib/data-pulse.ts
//
// PBS 2026-05-18: property-aware Pulse data fetchers. Backs the rebuilt
// /revenue/pulse page that mirrors Cloudbeds Price Intelligence Overview
// (KPIs · Performance summary · 30d hero with date scrub · Top Sources
// · Upcoming High Occupancy calendar · Today's Pickup · Upcoming Events).
//
// All reads go through public.mv_kpi_daily which UNIONs Cloudbeds (Namkhan)
// and Mews (Donna) — see Phase A3 migration. Property filter is mandatory.

import { supabase } from './supabase';

export interface PulseDailyRow {
  night_date: string;
  rooms_sold: number;
  rooms_revenue: number;
  occupancy_pct: number;
  adr: number;
  revpar: number;
  total_rooms: number;
}

export interface PulseKpiSnapshot {
  occupancyPct: number;
  revpar: number;
  roomsSold: number;
  adr: number;
  // STLY proxy (same date -1y)
  stlyOccupancyPct: number | null;
  stlyRevpar: number | null;
  stlyRoomsSold: number | null;
  stlyAdr: number | null;
}

export interface PulsePerformanceSummary {
  yesterday: PulseKpiSnapshot;
  mtd: PulseKpiSnapshot;
  ytd: PulseKpiSnapshot;
}

export interface PulseSourceRow {
  source_name: string;
  bookings: number;
}

export interface PulseHighOccDay {
  date: string;
  occupancy_pct: number;
}

export interface PulsePickupRow {
  accommodation: string;
  window: string;
  avg_los: number;
}

export interface PulseEventRow {
  name: string;
  date: string;
}

// ─── Daily series for the Hero chart ─────────────────────────────────────

export async function getPulseDaily(
  propertyId: number,
  fromIso: string,
  toIso: string,
): Promise<PulseDailyRow[]> {
  const { data, error } = await supabase
    .from('mv_kpi_daily')
    .select('night_date, rooms_sold, rooms_revenue, occupancy_pct, adr, revpar, total_rooms')
    .eq('property_id', propertyId)
    .gte('night_date', fromIso)
    .lte('night_date', toIso)
    .order('night_date');
  if (error) {
    console.error('[pulse/getPulseDaily] error', error);
    return [];
  }
  return ((data ?? []) as any[]).map((r) => ({
    night_date: String(r.night_date),
    rooms_sold: Number(r.rooms_sold ?? 0),
    rooms_revenue: Number(r.rooms_revenue ?? 0),
    occupancy_pct: Number(r.occupancy_pct ?? 0),
    adr: Number(r.adr ?? 0),
    revpar: Number(r.revpar ?? 0),
    total_rooms: Number(r.total_rooms ?? 0),
  }));
}

// Shift a yyyy-mm-dd by N days
function shiftDate(iso: string, days: number): string {
  const d = new Date(iso + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

// ─── Performance summary (Yesterday / MTD / YTD with STLY) ──────────────

async function aggregate(
  propertyId: number,
  fromIso: string,
  toIso: string,
): Promise<PulseKpiSnapshot> {
  const rows = await getPulseDaily(propertyId, fromIso, toIso);
  const stlyFrom = shiftDate(fromIso, -365);
  const stlyTo = shiftDate(toIso, -365);
  const stlyRows = await getPulseDaily(propertyId, stlyFrom, stlyTo);

  const sumRn = rows.reduce((s, r) => s + r.rooms_sold, 0);
  const sumRev = rows.reduce((s, r) => s + r.rooms_revenue, 0);
  const sumCap = rows.reduce((s, r) => s + (r.total_rooms || 0), 0);

  const stlyRn = stlyRows.reduce((s, r) => s + r.rooms_sold, 0);
  const stlyRev = stlyRows.reduce((s, r) => s + r.rooms_revenue, 0);
  const stlyCap = stlyRows.reduce((s, r) => s + (r.total_rooms || 0), 0);

  return {
    occupancyPct: sumCap > 0 ? (sumRn / sumCap) * 100 : 0,
    revpar: sumCap > 0 ? sumRev / sumCap : 0,
    roomsSold: sumRn,
    adr: sumRn > 0 ? sumRev / sumRn : 0,
    stlyOccupancyPct: stlyCap > 0 ? (stlyRn / stlyCap) * 100 : null,
    stlyRevpar: stlyCap > 0 ? stlyRev / stlyCap : null,
    stlyRoomsSold: stlyRows.length > 0 ? stlyRn : null,
    stlyAdr: stlyRn > 0 ? stlyRev / stlyRn : null,
  };
}

export async function getPulsePerformanceSummary(
  propertyId: number,
  asOf: string, // yyyy-mm-dd
): Promise<PulsePerformanceSummary> {
  const yesterday = shiftDate(asOf, -1);
  const monthStart = asOf.slice(0, 7) + '-01';
  const yearStart = asOf.slice(0, 4) + '-01-01';

  const [y, m, yr] = await Promise.all([
    aggregate(propertyId, yesterday, yesterday),
    aggregate(propertyId, monthStart, yesterday),
    aggregate(propertyId, yearStart, yesterday),
  ]);
  return { yesterday: y, mtd: m, ytd: yr };
}

// ─── KPI strip — same window as yesterday for the 4 hero KPIs ──────────

export async function getPulseHeadlineKpis(
  propertyId: number,
  asOf: string,
): Promise<PulseKpiSnapshot> {
  // Match Cloudbeds: KPI strip = yesterday snapshot.
  return aggregate(propertyId, shiftDate(asOf, -1), shiftDate(asOf, -1));
}

// ─── Top sources (last 30 days, by accommodations booked) ───────────────

const NAMKHAN_PROPERTY_ID = 260955;
const DONNA_PROPERTY_ID = 1000001;

export async function getPulseTopSources(
  propertyId: number,
  daysBack = 30,
  limit = 5,
): Promise<PulseSourceRow[]> {
  if (propertyId === NAMKHAN_PROPERTY_ID) {
    // Cloudbeds: read mv_channel_economics latest 30d window
    const { data, error } = await supabase
      .from('mv_channel_economics')
      .select('source_name, bookings')
      .eq('property_id', propertyId)
      .eq('window_days', daysBack <= 7 ? 7 : daysBack <= 30 ? 30 : 90)
      .order('bookings', { ascending: false })
      .limit(limit);
    if (error) {
      console.error('[pulse/getPulseTopSources] cb error', error);
      return [];
    }
    return ((data ?? []) as any[]).map((r) => ({
      source_name: String(r.source_name ?? '—'),
      bookings: Number(r.bookings ?? 0),
    }));
  }

  if (propertyId === DONNA_PROPERTY_ID) {
    // Mews: derive from pms_reservations_mews booked in last 30d
    const fromIso = shiftDate(new Date().toISOString().slice(0, 10), -daysBack);
    const { data, error } = await supabase
      .from('pms_reservations_mews')
      .select('source_name')
      .eq('property_id', propertyId)
      .gte('booking_date', fromIso)
      .eq('is_cancelled', false);
    if (error) {
      console.error('[pulse/getPulseTopSources] mews error', error);
      return [];
    }
    const counts = new Map<string, number>();
    for (const r of (data ?? []) as any[]) {
      const k = String(r.source_name ?? '— unknown —');
      counts.set(k, (counts.get(k) ?? 0) + 1);
    }
    return Array.from(counts.entries())
      .map(([source_name, bookings]) => ({ source_name, bookings }))
      .sort((a, b) => b.bookings - a.bookings)
      .slice(0, limit);
  }
  return [];
}

// ─── Upcoming high occupancy (>= threshold, forward N days) ─────────────

export async function getPulseHighOcc(
  propertyId: number,
  fromIso: string,
  toIso: string,
  thresholdPct = 80,
): Promise<PulseHighOccDay[]> {
  const { data, error } = await supabase
    .from('mv_kpi_daily')
    .select('night_date, occupancy_pct')
    .eq('property_id', propertyId)
    .gte('night_date', fromIso)
    .lte('night_date', toIso)
    .gte('occupancy_pct', thresholdPct)
    .order('night_date');
  if (error) {
    console.error('[pulse/getPulseHighOcc] error', error);
    return [];
  }
  return ((data ?? []) as any[]).map((r) => ({
    date: String(r.night_date),
    occupancy_pct: Number(r.occupancy_pct ?? 0),
  }));
}

// ─── Today's pickup (bookings made today) ───────────────────────────────

export async function getPulseTodayPickup(
  propertyId: number,
  asOf: string,
): Promise<PulsePickupRow[]> {
  if (propertyId === DONNA_PROPERTY_ID) {
    const { data, error } = await supabase
      .from('pms_reservations_mews')
      .select('check_in_date, booking_date, nights, room_type_name')
      .eq('property_id', propertyId)
      .eq('booking_date', asOf)
      .eq('is_cancelled', false);
    if (error) return [];
    const agg = new Map<string, { count: number; nightsSum: number; windowDaysSum: number }>();
    for (const r of (data ?? []) as any[]) {
      const acc = String(r.room_type_name ?? '— unspecified —');
      const cur = agg.get(acc) ?? { count: 0, nightsSum: 0, windowDaysSum: 0 };
      cur.count += 1;
      cur.nightsSum += Number(r.nights ?? 0);
      // Window = days from booking to check-in
      if (r.booking_date && r.check_in_date) {
        const bd = new Date(String(r.booking_date)).getTime();
        const ci = new Date(String(r.check_in_date) + 'T00:00:00Z').getTime();
        cur.windowDaysSum += Math.max(0, Math.round((ci - bd) / 86_400_000));
      }
      agg.set(acc, cur);
    }
    return Array.from(agg.entries()).map(([acc, v]) => ({
      accommodation: acc,
      window: v.count > 0 ? `${Math.round(v.windowDaysSum / v.count)}d` : '—',
      avg_los: v.count > 0 ? v.nightsSum / v.count : 0,
    }));
  }

  if (propertyId === NAMKHAN_PROPERTY_ID) {
    const { data, error } = await supabase
      .from('reservations')
      .select('check_in_date, booking_date, nights, room_type_name')
      .eq('property_id', propertyId)
      .gte('booking_date', asOf + 'T00:00:00')
      .lt('booking_date', asOf + 'T23:59:59')
      .neq('status', 'canceled');
    if (error) return [];
    const agg = new Map<string, { count: number; nightsSum: number; windowDaysSum: number }>();
    for (const r of (data ?? []) as any[]) {
      const acc = String(r.room_type_name ?? '— unspecified —');
      const cur = agg.get(acc) ?? { count: 0, nightsSum: 0, windowDaysSum: 0 };
      cur.count += 1;
      cur.nightsSum += Number(r.nights ?? 0);
      if (r.booking_date && r.check_in_date) {
        const bd = new Date(String(r.booking_date)).getTime();
        const ci = new Date(String(r.check_in_date) + 'T00:00:00Z').getTime();
        cur.windowDaysSum += Math.max(0, Math.round((ci - bd) / 86_400_000));
      }
      agg.set(acc, cur);
    }
    return Array.from(agg.entries()).map(([acc, v]) => ({
      accommodation: acc,
      window: v.count > 0 ? `${Math.round(v.windowDaysSum / v.count)}d` : '—',
      avg_los: v.count > 0 ? v.nightsSum / v.count : 0,
    }));
  }
  return [];
}

// ─── Upcoming events (next 30 days from marketing.calendar_events) ──────

export async function getPulseUpcomingEvents(
  propertyId: number,
  fromIso: string,
  toIso: string,
  limit = 10,
): Promise<PulseEventRow[]> {
  // public.calendar_events bridge view (if absent the from() returns []).
  const { data, error } = await supabase
    .from('calendar_events')
    .select('event_name, event_date, property_id')
    .or(`property_id.eq.${propertyId},property_id.is.null`)
    .gte('event_date', fromIso)
    .lte('event_date', toIso)
    .order('event_date')
    .limit(limit);
  if (error) {
    // Soft-fail — table/view may not be exposed yet
    return [];
  }
  return ((data ?? []) as any[]).map((r) => ({
    name: String(r.event_name ?? '—'),
    date: String(r.event_date),
  }));
}
