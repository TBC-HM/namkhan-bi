// lib/data/sdly.ts
// Same-day-last-year (SDLY) snapshot loaders for the KpiTile `stly` corner
// badge. All headline revenue tiles across /revenue/* now show a "LY $1,234"
// pill in the bottom-right corner; the values on that pill come from these
// helpers.
//
// Source of truth: public.v_kpi_daily_property — the actualised per-night
// KPI (rooms_sold, rooms_revenue, total_revenue, occupancy_pct, adr, revpar,
// trevpar) keyed on (property_id, night_date).
//
// SDLY definition: anchor date shifted exactly -1 year (calendar year, not
// 365d). shiftIsoYear handles Feb-29 → Feb-28 by letting the Date object
// roll forward one day, then subtracting one — so 2028-02-29 → 2027-02-28.
//
// Two shapes exposed:
//   loadSdlySnapshot     — single anchor date (today Vientiane, yesterday, etc.)
//   loadSdlyPeriodSum    — sum over a date window (rev / rn / total_revenue)
//                          Both endpoints shift -1yr; ADR/OCC derived from sums.
//
// PBS 2026-07-15 rollout brief · shared by 9 /revenue/* pages.

import type { SupabaseClient } from '@supabase/supabase-js';

export interface SdlySnapshot {
  rooms_sold: number | null;
  rooms_revenue: number | null;
  total_revenue: number | null;
  occupancy_pct: number | null;
  adr: number | null;
  revpar: number | null;
  trevpar: number | null;
}

export interface SdlyPeriodSum {
  rooms_sold: number;
  rooms_revenue: number;
  total_revenue: number;
  rooms_available: number;
  adr: number;            // derived: rooms_revenue / rooms_sold
  occupancy_pct: number;  // derived: rooms_sold / rooms_available * 100
  revpar: number;         // derived: rooms_revenue / rooms_available
  nights: number;         // rows returned (diagnostic)
}

/**
 * Shift an ISO date (YYYY-MM-DD) by whole calendar years.
 * Feb-29 in a non-leap target year rolls to Feb-28 (Date object rolls to Mar-1
 * and we subtract one day to land back in Feb).
 */
export function shiftIsoYear(iso: string, deltaYears: number): string {
  const [y, m, d] = iso.split('-').map(Number);
  const target = new Date(Date.UTC(y + deltaYears, m - 1, d));
  // If day rolled (e.g. Feb-29 → Mar-1 in non-leap), pull back one day.
  if (target.getUTCMonth() !== (m - 1)) {
    target.setUTCDate(target.getUTCDate() - 1);
  }
  return target.toISOString().slice(0, 10);
}

/**
 * Load one SDLY row for (propertyId, anchor − 1yr).
 * Returns null if no row exists for that night.
 */
export async function loadSdlySnapshot(
  admin: SupabaseClient,
  propertyId: number,
  anchor: string,
): Promise<SdlySnapshot | null> {
  const lyDate = shiftIsoYear(anchor, -1);
  const { data, error } = await admin
    .from('v_kpi_daily_property')
    .select('rooms_sold, rooms_revenue, total_revenue, occupancy_pct, adr, revpar, trevpar')
    .eq('property_id', propertyId)
    .eq('night_date', lyDate)
    .maybeSingle();
  if (error) {
    console.error('[sdly] loadSdlySnapshot error', { propertyId, anchor, lyDate, error });
    return null;
  }
  return (data as SdlySnapshot | null) ?? null;
}

/**
 * Sum SDLY across a date window. Both fromIso and toIso are shifted -1yr,
 * inclusive both ends. Derived ADR/OCC/RevPAR come from the summed pieces
 * (never averaged — averaging skews when nightly capacity or ADR varies).
 */
export async function loadSdlyPeriodSum(
  admin: SupabaseClient,
  propertyId: number,
  fromIso: string,
  toIso: string,
): Promise<SdlyPeriodSum | null> {
  const lyFrom = shiftIsoYear(fromIso, -1);
  const lyTo   = shiftIsoYear(toIso, -1);
  const { data, error } = await admin
    .from('v_kpi_daily_property')
    .select('rooms_sold, rooms_revenue, total_revenue, rooms_available')
    .eq('property_id', propertyId)
    .gte('night_date', lyFrom)
    .lte('night_date', lyTo);
  if (error) {
    console.error('[sdly] loadSdlyPeriodSum error', { propertyId, lyFrom, lyTo, error });
    return null;
  }
  const rows = (data ?? []) as Array<{
    rooms_sold: number | null;
    rooms_revenue: number | null;
    total_revenue: number | null;
    rooms_available: number | null;
  }>;
  if (rows.length === 0) return null;
  const sum = rows.reduce(
    (s, r) => {
      s.rooms_sold      += Number(r.rooms_sold ?? 0);
      s.rooms_revenue   += Number(r.rooms_revenue ?? 0);
      s.total_revenue   += Number(r.total_revenue ?? 0);
      s.rooms_available += Number(r.rooms_available ?? 0);
      return s;
    },
    { rooms_sold: 0, rooms_revenue: 0, total_revenue: 0, rooms_available: 0 },
  );
  const adr    = sum.rooms_sold > 0 ? sum.rooms_revenue / sum.rooms_sold : 0;
  const occ    = sum.rooms_available > 0 ? (sum.rooms_sold / sum.rooms_available) * 100 : 0;
  const revpar = sum.rooms_available > 0 ? sum.rooms_revenue / sum.rooms_available : 0;
  return {
    rooms_sold:      sum.rooms_sold,
    rooms_revenue:   sum.rooms_revenue,
    total_revenue:   sum.total_revenue,
    rooms_available: sum.rooms_available,
    adr,
    occupancy_pct:   occ,
    revpar,
    nights:          rows.length,
  };
}

/** Shared formatters — match the tile's own formatter so the badge reads consistently. */
export function fmtSdlyMoney(v: number | null | undefined, sym: string = '$'): string {
  if (v == null || !Number.isFinite(Number(v))) return '—';
  return `${sym}${Math.round(Number(v)).toLocaleString('en-US')}`;
}
export function fmtSdlyInt(v: number | null | undefined): string {
  if (v == null || !Number.isFinite(Number(v))) return '—';
  return Math.round(Number(v)).toLocaleString('en-US');
}
export function fmtSdlyPct(v: number | null | undefined, decimals = 0): string {
  if (v == null || !Number.isFinite(Number(v))) return '—';
  return `${Number(v).toFixed(decimals)}%`;
}
