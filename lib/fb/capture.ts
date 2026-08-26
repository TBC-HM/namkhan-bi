// lib/fb/capture.ts
// PBS 2026-08-26 · Shaping for the Restaurant Pass capture surfaces.
//
// Reads kpi.v_fb_capture_monthly_property and kpi.v_fb_reservation_spend
// (bridged as public.v_fb_capture_trend / public.v_fb_reservation_spend).
//
// Capture here is BY RESERVATION. The legacy restaurant page reports capture by
// reservation-DAY — 203 of 262, 77.5%. One guest ordering on four of five nights
// counts four times there and once here, which is why this number is lower and
// why it is the one a manager can act on: it names guests who bought nothing at
// all, not nights that happened to be quiet.

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

export interface CaptureRow {
  stay_month: string;
  reservations: number;
  reservations_with_fb: number;
  capture_pct: number | string | null;
  room_nights: number | null;
  room_nights_no_fb: number | null;
  fb_spend: number | string | null;
}

export interface CapturePoint {
  month: string;
  label: string;
  capturePct: number;
  reservations: number;
  withSpend: number;
  roomNightsNoFb: number;
  fbSpend: number;
}

const num = (v: unknown): number => {
  const n = Number(v ?? 0);
  return Number.isFinite(n) ? n : 0;
};

/**
 * Capture development by stay month, future months removed.
 *
 * Forward bookings sit in the same view and always read 0% capture — the stay
 * has not happened, so nobody has ordered. Charting them would draw a collapse
 * that is really just the future. Everything up to and including the current
 * month is kept; the current month is partial but real.
 */
export function captureTrend(rows: CaptureRow[], asOfIso: string): CapturePoint[] {
  const cutoff = asOfIso.slice(0, 7); // YYYY-MM
  return rows
    .filter((r) => typeof r.stay_month === 'string' && r.stay_month.slice(0, 7) <= cutoff)
    .sort((a, b) => a.stay_month.localeCompare(b.stay_month))
    .map((r) => ({
      month: r.stay_month,
      label: MONTHS[Number(r.stay_month.slice(5, 7)) - 1] ?? r.stay_month,
      capturePct: num(r.capture_pct),
      reservations: num(r.reservations),
      withSpend: num(r.reservations_with_fb),
      roomNightsNoFb: num(r.room_nights_no_fb),
      fbSpend: num(r.fb_spend),
    }));
}

export interface SpendRow {
  source_name: string | null;
  is_staff: boolean | null;
  has_fb_spend: boolean | null;
  fb_spend: number | string | null;
  nights: number | null;
}

export interface SourceCapture {
  source: string;
  neverSpent: number;
  didSpend: number;
  roomNightsLost: number;
  capturePct: number;
  spendPerCapturing: number;
}

/**
 * Reservations that bought nothing, grouped by booking source.
 *
 * Ordered by room nights lost rather than headcount — a source with three
 * five-night stays is a bigger miss than one with four one-nighters. Staff
 * Usage is dropped: staff meals are not a capture opportunity.
 */
export function neverSpentBySource(rows: SpendRow[]): SourceCapture[] {
  const acc = new Map<string, { never: number; did: number; nights: number; spend: number }>();
  for (const r of rows) {
    if (r.is_staff) continue;
    const key = r.source_name || '(unknown)';
    const a = acc.get(key) ?? { never: 0, did: 0, nights: 0, spend: 0 };
    if (r.has_fb_spend) { a.did++; a.spend += num(r.fb_spend); }
    else { a.never++; a.nights += num(r.nights); }
    acc.set(key, a);
  }
  return [...acc.entries()]
    .filter(([, a]) => a.never > 0)
    .map(([source, a]) => ({
      source,
      neverSpent: a.never,
      didSpend: a.did,
      roomNightsLost: a.nights,
      capturePct: Math.round((a.did / (a.did + a.never)) * 100),
      spendPerCapturing: a.did > 0 ? Math.round(a.spend / a.did) : 0,
    }))
    .sort((x, y) => y.roomNightsLost - x.roomNightsLost || y.neverSpent - x.neverSpent);
}

export interface StaffSplit {
  guestSpend: number;
  staffSpend: number;
  staffSharePct: number;
}

/** Staff meals post exactly like guest checks. Split them so revenue is honest. */
export function splitStaff(rows: SpendRow[]): StaffSplit {
  let guestSpend = 0, staffSpend = 0;
  for (const r of rows) {
    if (r.is_staff) staffSpend += num(r.fb_spend);
    else guestSpend += num(r.fb_spend);
  }
  const total = guestSpend + staffSpend;
  return {
    guestSpend: Math.round(guestSpend * 100) / 100,
    staffSpend: Math.round(staffSpend * 100) / 100,
    staffSharePct: total > 0 ? Math.round((staffSpend / total) * 1000) / 10 : 0,
  };
}

export interface CaptureSummary {
  reservations: number;
  withSpend: number;
  neverSpent: number;
  capturePct: number;
  roomNightsLost: number;
  opportunity: number;
}

/**
 * Headline capture, guests only.
 *
 * `opportunity` values the misses at what a capturing guest actually spends,
 * not at a target — it is the money already proven achievable with this menu
 * and these prices.
 */
export function captureSummary(rows: SpendRow[]): CaptureSummary {
  const guests = rows.filter((r) => !r.is_staff);
  const withSpend = guests.filter((r) => r.has_fb_spend);
  const never = guests.filter((r) => !r.has_fb_spend);
  const spend = withSpend.reduce((s, r) => s + num(r.fb_spend), 0);
  const perCapturing = withSpend.length > 0 ? spend / withSpend.length : 0;
  return {
    reservations: guests.length,
    withSpend: withSpend.length,
    neverSpent: never.length,
    capturePct: guests.length > 0 ? Math.round((withSpend.length / guests.length) * 100) : 0,
    roomNightsLost: never.reduce((s, r) => s + num(r.nights), 0),
    opportunity: Math.round(perCapturing * never.length),
  };
}
