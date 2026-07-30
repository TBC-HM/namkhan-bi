// lib/forecast/types.ts
// Forecasting capability v1 — shared types (brief forecasting-module-v1).
// USALI 11th-edition metric names throughout: Occupancy %, ADR, RevPAR,
// Rooms Revenue. All Namkhan figures are PMS/transaction-layer USD.

/** One month of actual history (aggregated from public.v_kpi_daily, is_actual=true). */
export interface MonthlyActual {
  /** Calendar month key, 'YYYY-MM'. */
  month: string;
  roomsSold: number;
  roomsAvailable: number;
  roomsRevenue: number;
  /** Std deviation of daily rooms sold within the month (variance source for bands). */
  dailyRoomsStd: number;
  /** Mean daily rooms sold within the month. */
  dailyRoomsMean: number;
}

/** One month of on-the-books state (aggregated from public.v_otb_pace). */
export interface MonthlyOtb {
  month: string;
  otbRooms: number;
  otbRoomsRevenue: number;
}

/** Pickup pace observed over the trailing window (public.v_pickup_velocity_15d30d). */
export interface PaceSignal {
  /** Rooms picked up in the trailing window (this year). */
  pickupRooms: number;
  /** Rooms picked up in the same window last year (SDLY). */
  sdlyRooms: number;
  /** pickupRooms / sdlyRooms, clamped — 1.0 when SDLY has no signal. */
  ratio: number;
  /** Number of days of pace data behind the ratio. */
  observedDays: number;
}

/** Full engine output for one forward month. USALI metric names. */
export interface MonthlyForecast {
  month: string;                 // 'YYYY-MM'
  daysOutMid: number;            // lead time at month midpoint, days from run date
  capacityRoomNights: number;    // Rooms Available (USALI denominator)
  otbRooms: number;              // Rooms Sold already on the books
  otbRoomsRevenue: number;       // Rooms Revenue already on the books (USD, PMS layer)
  stlyRooms: number;             // same-time-last-year final Rooms Sold (actual)
  stlyRoomsRevenue: number;      // STLY final Rooms Revenue (actual)
  stlyAdr: number;               // STLY ADR
  projectedPickupRooms: number;  // engine: rooms still expected to book
  roomsForecast: number;         // Rooms Sold forecast (otb + projected pickup, capped)
  occupancyPctForecast: number;  // Occupancy % forecast (0–100)
  adrForecast: number;           // ADR forecast (Rooms Revenue / Rooms Sold)
  revparForecast: number;        // RevPAR forecast (Rooms Revenue / Rooms Available)
  roomsRevenueForecast: number;  // Rooms Revenue forecast
  /** Confidence band on Rooms Sold, from historical daily variance (p10 ≤ fc ≤ p90). */
  roomsP10: number;
  roomsP90: number;
  /** Same band expressed as Occupancy % (0–100). */
  occupancyP10: number;
  occupancyP90: number;
  /** Which components actually contributed (data-completeness honesty flag). */
  basis: 'otb+stly+pace' | 'otb+stly' | 'otb-only';
}

/** Everything the deterministic engine needs — pure data in, forecast out. */
export interface EngineInputs {
  /** Run date, ISO 'YYYY-MM-DD' (forecast starts at this month). */
  runDate: string;
  propertyId: number;
  /** Actual history keyed by 'YYYY-MM' (needs LY months for STLY + variance). */
  actualsByMonth: Map<string, MonthlyActual>;
  /** OTB keyed by 'YYYY-MM' for the forward window. */
  otbByMonth: Map<string, MonthlyOtb>;
  pace: PaceSignal;
  /** Capacity in room-nights for an inclusive date range. */
  capacityRnRange: (fromIso: string, toIso: string, propertyId: number) => number;
}

export interface EngineRun {
  runDate: string;
  propertyId: number;
  months: MonthlyForecast[];
  pace: PaceSignal;
  /** Human-readable method string — every run is transparent, no black box. */
  method: string;
}
