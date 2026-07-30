// lib/forecast/engine.ts
// Forecasting capability v1 — deterministic statistical engine
// (brief forecasting-module-v1; source doc forecasting_module_architecture.md).
//
// BINDING architecture rule 1: prediction = statistics, not LLM. This module
// is pure, deterministic TypeScript — same inputs, same output, no model
// calls, no randomness. LLM agents (Challenger / Insight / Scenario /
// Recommendation) sit ON TOP of these numbers and never alter them; in v1
// their surface slots are placeholders (see the forecast page).
//
// Model (monthly grain, 12 months ahead — same additive-pickup family as the
// nightly daily-grain engine in v_forecast_current, method "v1.2"):
//
//   Rooms Sold forecast(m) =
//     min( capacity(m),
//          max( OTB(m),
//               OTB(m) + w(d) × STLY_rooms(m) × paceRatio ) )
//
//   w(d)       = share of final bookings that historically materialize inside
//                the remaining booking window at lead time d (default curve
//                below — replace with property-learned curve when
//                plan.otb_snapshots depth allows, as the nightly engine does).
//   STLY       = same-time-last-year final actuals (public.v_kpi_daily).
//   paceRatio  = trailing-30d pickup vs SDLY pickup
//                (public.v_pickup_velocity_15d30d), clamped 0.6–1.5.
//
//   Rooms Revenue forecast(m) = OTB revenue(m) + pickup rooms × STLY ADR(m)
//   ADR    = Rooms Revenue / Rooms Sold          (USALI)
//   RevPAR = Rooms Revenue / Rooms Available     (USALI)
//   Occ %  = Rooms Sold / Rooms Available × 100  (USALI)
//
// Confidence bands (never hidden — core philosophy: probabilistic always):
//   sigma(m) = relStd(LY daily rooms, month m) × projected pickup rooms
//   p10/p90  = forecast ∓ 1.282 × sigma, floored at OTB, capped at capacity.
//   Uncertainty applies only to the unbooked portion; what is on the books
//   is not uncertain (cancellation risk is modeled at daily grain by the
//   nightly engine, out of scope at monthly grain in v1 — stated on page).

import type {
  EngineInputs,
  EngineRun,
  MonthlyActual,
  MonthlyForecast,
  PaceSignal,
} from './types';

// ─── Tunables (deterministic constants, documented on the page) ───────────

/** paceRatio clamp — a 24–30-room property's 30d sample is noisy. */
export const PACE_RATIO_MIN = 0.6;
export const PACE_RATIO_MAX = 1.5;

/** z for p10/p90 under a normal approximation. */
const Z_80 = 1.282;

/** Relative-std clamp for the band width on the pickup portion. */
const REL_STD_MIN = 0.15;
const REL_STD_MAX = 0.6;

/**
 * Default booking-window curve: share of a stay month's final bookings that
 * historically arrive inside the remaining window at lead time d (days).
 * Control points interpolated linearly; matches the shape the nightly engine
 * learns from plan.otb_snapshots (long lead → nearly everything still to
 * come; short lead → mostly on the books already).
 */
const W_CURVE: Array<[number, number]> = [
  [0, 0.0],
  [7, 0.1],
  [14, 0.2],
  [30, 0.35],
  [60, 0.5],
  [90, 0.65],
  [120, 0.75],
  [180, 0.85],
  [270, 0.95],
  [365, 0.98],
];

// ─── Pure helpers ─────────────────────────────────────────────────────────

export function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v));
}

/** Linear interpolation over W_CURVE. Exported for the page's methodology block. */
export function bookingWindowShare(daysOut: number): number {
  const d = clamp(daysOut, 0, 365);
  for (let i = 1; i < W_CURVE.length; i++) {
    const [x1, y1] = W_CURVE[i];
    const [x0, y0] = W_CURVE[i - 1];
    if (d <= x1) return y0 + ((d - x0) / (x1 - x0)) * (y1 - y0);
  }
  return W_CURVE[W_CURVE.length - 1][1];
}

/** 'YYYY-MM' + n months → 'YYYY-MM' (UTC-safe, no Date drift). */
export function addMonths(ym: string, n: number): string {
  const [y, m] = ym.split('-').map(Number);
  const total = y * 12 + (m - 1) + n;
  const ny = Math.floor(total / 12);
  const nm = (total % 12) + 1;
  return `${ny}-${String(nm).padStart(2, '0')}`;
}

/** Same calendar month, previous year. */
export function stlyMonth(ym: string): string {
  return addMonths(ym, -12);
}

export function monthStartIso(ym: string): string {
  return `${ym}-01`;
}

export function monthEndIso(ym: string): string {
  const [y, m] = ym.split('-').map(Number);
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate(); // day 0 of next month
  return `${ym}-${String(last).padStart(2, '0')}`;
}

/** Whole days between two ISO dates (b − a). */
export function daysBetween(aIso: string, bIso: string): number {
  const a = Date.parse(aIso + 'T00:00:00Z');
  const b = Date.parse(bIso + 'T00:00:00Z');
  return Math.round((b - a) / 86400000);
}

/**
 * Pace ratio from trailing pickup vs SDLY pickup.
 * No SDLY signal (young data) → neutral 1.0 with ratio clamped for noise.
 */
export function computePaceRatio(pickupRooms: number, sdlyRooms: number): number {
  if (!(sdlyRooms > 0) || !(pickupRooms >= 0)) return 1.0;
  return clamp(pickupRooms / sdlyRooms, PACE_RATIO_MIN, PACE_RATIO_MAX);
}

// ─── Engine ───────────────────────────────────────────────────────────────

/** Forecast a single forward month. Pure. */
export function forecastMonth(
  ym: string,
  inputs: EngineInputs,
): MonthlyForecast {
  const { runDate, propertyId, actualsByMonth, otbByMonth, pace } = inputs;

  const startIso = monthStartIso(ym);
  const endIso = monthEndIso(ym);
  // Lead time at month midpoint; months already underway count from run date.
  const midIso = `${ym}-15`;
  const daysOutMid = Math.max(0, daysBetween(runDate, midIso));

  const capacityRoomNights = Math.max(
    0,
    inputs.capacityRnRange(startIso > runDate ? startIso : runDate, endIso, propertyId),
  );

  const otb = otbByMonth.get(ym);
  const otbRooms = otb?.otbRooms ?? 0;
  const otbRoomsRevenue = otb?.otbRoomsRevenue ?? 0;

  const stly: MonthlyActual | undefined = actualsByMonth.get(stlyMonth(ym));
  const stlyRooms = stly?.roomsSold ?? 0;
  const stlyRoomsRevenue = stly?.roomsRevenue ?? 0;
  const stlyAdr = stlyRooms > 0 ? stlyRoomsRevenue / stlyRooms : 0;

  const hasStly = stlyRooms > 0;
  const hasPace = pace.observedDays > 0 && pace.sdlyRooms > 0;
  const basis: MonthlyForecast['basis'] = hasStly
    ? hasPace
      ? 'otb+stly+pace'
      : 'otb+stly'
    : 'otb-only';

  const w = bookingWindowShare(daysOutMid);
  const paceRatio = hasPace ? pace.ratio : 1.0;

  // Additive pickup projection on the STLY baseline.
  const projectedPickupRaw = hasStly ? w * stlyRooms * paceRatio : 0;
  const roomsForecastRaw = Math.max(otbRooms, otbRooms + projectedPickupRaw);
  const roomsForecast = clamp(roomsForecastRaw, otbRooms, capacityRoomNights || roomsForecastRaw);
  const projectedPickupRooms = Math.max(0, roomsForecast - otbRooms);

  // Revenue: booked revenue is known; project pickup at STLY ADR (no
  // rate-optimization assumptions — the engine forecasts, it never prices).
  const roomsRevenueForecast = otbRoomsRevenue + projectedPickupRooms * stlyAdr;

  // Bands from historical intra-month dispersion, applied to the unbooked part.
  const relStd =
    stly && stly.dailyRoomsMean > 0
      ? clamp(stly.dailyRoomsStd / stly.dailyRoomsMean, REL_STD_MIN, REL_STD_MAX)
      : REL_STD_MAX;
  const sigma = relStd * projectedPickupRooms;
  const roomsP10 = clamp(roomsForecast - Z_80 * sigma, otbRooms, roomsForecast);
  const roomsP90 = clamp(
    roomsForecast + Z_80 * sigma,
    roomsForecast,
    capacityRoomNights || roomsForecast + Z_80 * sigma,
  );

  const occ = (r: number) =>
    capacityRoomNights > 0 ? (100 * r) / capacityRoomNights : 0;

  return {
    month: ym,
    daysOutMid,
    capacityRoomNights,
    otbRooms,
    otbRoomsRevenue,
    stlyRooms,
    stlyRoomsRevenue,
    stlyAdr,
    projectedPickupRooms,
    roomsForecast,
    occupancyPctForecast: occ(roomsForecast),
    adrForecast: roomsForecast > 0 ? roomsRevenueForecast / roomsForecast : 0,
    revparForecast:
      capacityRoomNights > 0 ? roomsRevenueForecast / capacityRoomNights : 0,
    roomsRevenueForecast,
    roomsP10,
    roomsP90,
    occupancyP10: occ(roomsP10),
    occupancyP90: occ(roomsP90),
    basis,
  };
}

/** Run the engine for the next `horizonMonths` months (current month first). Pure. */
export function runEngine(inputs: EngineInputs, horizonMonths = 12): EngineRun {
  const startYm = inputs.runDate.slice(0, 7);
  const months: MonthlyForecast[] = [];
  for (let i = 0; i < horizonMonths; i++) {
    months.push(forecastMonth(addMonths(startYm, i), inputs));
  }
  const method =
    `ts-engine v1 monthly additive pickup: rooms = min(capacity, max(OTB, ` +
    `OTB + w(daysOut) × STLY_rooms × paceRatio)); w = default booking-window ` +
    `curve (linear over ${W_CURVE.length} control points); paceRatio = trailing-30d ` +
    `pickup vs SDLY (v_pickup_velocity_15d30d) clamped ${PACE_RATIO_MIN}–${PACE_RATIO_MAX}, ` +
    `observed ${inputs.pace.observedDays}d → ${inputs.pace.ratio.toFixed(2)}; ` +
    `revenue = OTB revenue + pickup × STLY ADR; bands p10/p90 = ±1.282 × relStd(LY ` +
    `daily rooms) × pickup, floored at OTB, capped at capacity; sources: ` +
    `v_otb_pace, v_kpi_daily (is_actual), v_pickup_velocity_15d30d, lib/capacity`;
  return {
    runDate: inputs.runDate,
    propertyId: inputs.propertyId,
    months,
    pace: inputs.pace,
    method,
  };
}
