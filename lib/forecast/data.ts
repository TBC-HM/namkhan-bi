// lib/forecast/data.ts
// Forecasting capability v1 — data adapters (server-only).
// Reads ONLY public bridge views (claude_md §0.5 PostgREST law):
//   public.v_kpi_daily              — daily actuals (is_actual=true) for STLY + variance
//   public.v_otb_pace               — forward on-the-books rooms/revenue per night
//   public.v_pickup_velocity_15d30d — trailing pickup vs SDLY (pace signal)
// All reads tenant-scoped by property_id. PostgREST pages at 1000 rows —
// every fetch pages defensively (§0.66 lesson: never trust a single fetch).

import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { capacityRnRange } from '@/lib/capacity';
import { computePaceRatio, stlyMonth, addMonths, monthEndIso } from './engine';
import type { EngineInputs, MonthlyActual, MonthlyOtb, PaceSignal } from './types';

const PAGE = 1000;

async function pageAll<T>(
  build: (from: number, to: number) => PromiseLike<{ data: unknown; error: unknown }>,
  label: string,
  hardCap = 40000,
): Promise<T[]> {
  const out: T[] = [];
  for (let offset = 0; offset < hardCap; offset += PAGE) {
    const { data, error } = await build(offset, offset + PAGE - 1);
    if (error) {
      console.error(`[lib/forecast] ${label}`, error);
      break;
    }
    const rows = (data ?? []) as T[];
    out.push(...rows);
    if (rows.length < PAGE) break;
  }
  return out;
}

// ─── Actual history → monthly aggregates (STLY baseline + variance) ───────

interface KpiDailyRow {
  night_date: string;
  rooms_sold: number | null;
  rooms_available: number | null;
  rooms_revenue: string | number | null;
}

export async function fetchActualsByMonth(
  propertyId: number,
  fromIso: string,
  toIso: string,
): Promise<Map<string, MonthlyActual>> {
  const sb = getSupabaseAdmin();
  const rows = await pageAll<KpiDailyRow>(
    (from, to) =>
      (sb as any)
        .from('v_kpi_daily')
        .select('night_date, rooms_sold, rooms_available, rooms_revenue')
        .eq('property_id', propertyId)
        .eq('is_actual', true)
        .gte('night_date', fromIso)
        .lte('night_date', toIso)
        .order('night_date')
        .range(from, to),
    'v_kpi_daily actuals',
  );

  const daily = new Map<string, number[]>(); // month → daily rooms_sold
  const acc = new Map<string, { rooms: number; avail: number; rev: number }>();
  for (const r of rows) {
    const ym = String(r.night_date).slice(0, 7);
    const rooms = Number(r.rooms_sold ?? 0);
    const cur = acc.get(ym) ?? { rooms: 0, avail: 0, rev: 0 };
    cur.rooms += rooms;
    cur.avail += Number(r.rooms_available ?? 0);
    cur.rev += Number(r.rooms_revenue ?? 0);
    acc.set(ym, cur);
    const d = daily.get(ym) ?? [];
    d.push(rooms);
    daily.set(ym, d);
  }

  const out = new Map<string, MonthlyActual>();
  for (const [ym, v] of Array.from(acc.entries())) {
    const d = daily.get(ym) ?? [];
    const mean = d.length ? d.reduce((a, b) => a + b, 0) / d.length : 0;
    const variance = d.length
      ? d.reduce((a, b) => a + (b - mean) * (b - mean), 0) / d.length
      : 0;
    out.set(ym, {
      month: ym,
      roomsSold: v.rooms,
      roomsAvailable: v.avail,
      roomsRevenue: v.rev,
      dailyRoomsMean: mean,
      dailyRoomsStd: Math.sqrt(variance),
    });
  }
  return out;
}

// ─── Forward OTB → monthly aggregates ─────────────────────────────────────

interface OtbPaceRow {
  night_date: string;
  confirmed_rooms: number | null;
  confirmed_revenue: string | number | null;
}

export async function fetchOtbByMonth(
  propertyId: number,
  fromIso: string,
  toIso: string,
): Promise<Map<string, MonthlyOtb>> {
  const sb = getSupabaseAdmin();
  const rows = await pageAll<OtbPaceRow>(
    (from, to) =>
      (sb as any)
        .from('v_otb_pace')
        .select('night_date, confirmed_rooms, confirmed_revenue')
        .eq('property_id', propertyId)
        .gte('night_date', fromIso)
        .lte('night_date', toIso)
        .order('night_date')
        .range(from, to),
    'v_otb_pace',
  );
  const out = new Map<string, MonthlyOtb>();
  for (const r of rows) {
    const ym = String(r.night_date).slice(0, 7);
    const cur = out.get(ym) ?? { month: ym, otbRooms: 0, otbRoomsRevenue: 0 };
    cur.otbRooms += Number(r.confirmed_rooms ?? 0);
    cur.otbRoomsRevenue += Number(r.confirmed_revenue ?? 0);
    out.set(ym, cur);
  }
  return out;
}

// ─── Pace signal (trailing 30d pickup vs SDLY) ────────────────────────────

interface PickupVelocityRow {
  day_pos: number;
  pickup_total: number | null;
  sdly_total: number | null;
}

export async function fetchPaceSignal(propertyId: number): Promise<PaceSignal> {
  const sb = getSupabaseAdmin();
  const rows = await pageAll<PickupVelocityRow>(
    (from, to) =>
      (sb as any)
        .from('v_pickup_velocity_15d30d')
        .select('day_pos, pickup_total, sdly_total')
        .eq('property_id', propertyId)
        .gte('day_pos', -30)
        .lt('day_pos', 0)
        .range(from, to),
    'v_pickup_velocity_15d30d',
  );
  let pickup = 0;
  let sdly = 0;
  for (const r of rows) {
    pickup += Number(r.pickup_total ?? 0);
    sdly += Number(r.sdly_total ?? 0);
  }
  return {
    pickupRooms: pickup,
    sdlyRooms: sdly,
    ratio: computePaceRatio(pickup, sdly),
    observedDays: rows.length,
  };
}

// ─── Full input assembly ──────────────────────────────────────────────────

/**
 * Assemble EngineInputs for a 12-month run starting at runDate's month.
 * History window: STLY of month 0 back through STLY of month 11 — i.e. the
 * trailing ~24 months of actuals (also feeds the variance-based bands).
 */
export async function fetchEngineInputs(
  propertyId: number,
  runDate: string,
  horizonMonths = 12,
): Promise<EngineInputs> {
  const startYm = runDate.slice(0, 7);
  const endYm = addMonths(startYm, horizonMonths - 1);
  const historyFrom = `${stlyMonth(startYm)}-01`;
  const historyTo = runDate;
  const forwardTo = monthEndIso(endYm);

  const [actualsByMonth, otbByMonth, pace] = await Promise.all([
    fetchActualsByMonth(propertyId, historyFrom, historyTo),
    fetchOtbByMonth(propertyId, runDate, forwardTo),
    fetchPaceSignal(propertyId),
  ]);

  return {
    runDate,
    propertyId,
    actualsByMonth,
    otbByMonth,
    pace,
    capacityRnRange,
  };
}
