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
  source: string;
  accommodation: string;
  guest: string;
  reservation_id: string;
  adr: number;
  value: number;
  nights: number;
  window: string;
  avg_los: number;
  count: number;
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

// ─── KPI strip — TODAY snapshot (PBS lock 2026-05-18) ──────────
// Original Cloudbeds Pulse showed yesterday; PBS prefers live today.

export async function getPulseHeadlineKpis(
  propertyId: number,
  asOf: string,
): Promise<PulseKpiSnapshot> {
  return aggregate(propertyId, asOf, asOf);
}

// Property id constants — also used downstream by getPulseTodayPickup / getPulseUpcomingEvents.
const NAMKHAN_PROPERTY_ID = 260955;
const DONNA_PROPERTY_ID = 1000001;

// ─── Top sources — bound to public.v_source_top10 (cross-property bridge).
// PBS cockpit #197 (SEQ 5/6): one anon-readable view replaces the cb/mews
// branch that hit pms_reservations_mews directly and produced "permission
// denied for table sources_mews" runtime errors.

export async function getPulseTopSources(
  propertyId: number,
  _daysBack = 30,
  limit = 5,
): Promise<PulseSourceRow[]> {
  const { data, error } = await supabase
    .from('v_source_top10')
    .select('source, reservations')
    .eq('property_id', propertyId)
    .order('reservations', { ascending: false })
    .limit(limit);
  if (error) {
    console.error('[pulse/getPulseTopSources] v_source_top10 error', error);
    return [];
  }
  return ((data ?? []) as Array<{ source: string | null; reservations: number | null }>).map((r) => ({
    source_name: String(r.source ?? '—'),
    bookings:    Number(r.reservations ?? 0),
  }));
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
  // PBS 2026-05-22 (task #86): query v_reservations_unified for BOTH
  // properties + surface source_name. Previously the helper queried
  // pms_reservations_mews / reservations (which don't always populate
  // room_type_name on the umbrella row), aggregated by room_type only,
  // and showed a single "— unspecified —" bucket with no useful info.
  // Now we read the cross-property bridge and group by source × room_type.
  const startIso = asOf + 'T00:00:00';
  const endIso = asOf + 'T23:59:59';

  const { data, error } = await supabase
    .from('v_reservations_unified')
    .select('reservation_id, source_name, room_type_name, guest_name, check_in_date, booking_date, nights, total_amount')
    .eq('property_id', propertyId)
    .eq('is_cancelled', false)
    .gte('booking_date', startIso)
    .lte('booking_date', endIso)
    .order('booking_date', { ascending: false })
    .limit(50);

  if (error || !data) return [];

  return (data as Array<Record<string, unknown>>).map((r) => {
    const nights = Number(r.nights ?? 0);
    const value = Number(r.total_amount ?? 0);
    const adr = nights > 0 ? value / nights : 0;
    let windowLabel = '—';
    if (r.booking_date && r.check_in_date) {
      const bd = new Date(String(r.booking_date)).getTime();
      const ci = new Date(String(r.check_in_date) + 'T00:00:00Z').getTime();
      const w = Math.max(0, Math.round((ci - bd) / 86_400_000));
      windowLabel = `${w}d`;
    }
    return {
      source: String(r.source_name ?? 'Direct'),
      accommodation: String(r.room_type_name ?? '—'),
      guest: String(r.guest_name ?? '—'),
      reservation_id: String(r.reservation_id ?? ''),
      adr,
      value,
      nights,
      window: windowLabel,
      avg_los: nights,
      count: 1,
    };
  });
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

// ─── Scoped occupancy (cockpit #197) ─────────────────────────────────────
// Single-row-per-property snapshot of occupancy across 5 windows:
// yesterday · MTD · YTD · next 30d OTB · next 90d OTB.
// Source: public.v_occupancy_scoped (anon-readable bridge).

export interface OccScoped {
  occ_yesterday: number;
  occ_mtd: number;
  occ_ytd: number;
  occ_otb_next30: number;
  occ_otb_next90: number;
  sellable_capacity: number;
}

export async function getOccScoped(propertyId: number): Promise<OccScoped | null> {
  const { data, error } = await supabase
    .from('v_occupancy_scoped')
    .select('occ_yesterday, occ_mtd, occ_ytd, occ_otb_next30, occ_otb_next90, sellable_capacity')
    .eq('property_id', propertyId)
    .maybeSingle();
  if (error) {
    console.error('[pulse/getOccScoped] error', error);
    return null;
  }
  if (!data) return null;
  const d = data as Record<string, unknown>;
  return {
    occ_yesterday:     Number(d.occ_yesterday ?? 0),
    occ_mtd:           Number(d.occ_mtd ?? 0),
    occ_ytd:           Number(d.occ_ytd ?? 0),
    occ_otb_next30:    Number(d.occ_otb_next30 ?? 0),
    occ_otb_next90:    Number(d.occ_otb_next90 ?? 0),
    sellable_capacity: Number(d.sellable_capacity ?? 0),
  };
}
