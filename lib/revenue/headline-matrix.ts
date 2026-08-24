// lib/revenue/headline-matrix.ts
// PBS 2026-08-24 · Pure logic behind the Revenue HoD headline matrix.
//
// The four "Headline · <period>" stripes each rendered their own row of
// KpiTiles on an independent `auto-fit` grid, so the same metric landed at a
// different x-position in every stripe and nothing aligned. The matrix renders
// one grid — metrics down, periods across — and this module holds everything
// about that which is worth testing on its own: classifying a tile label into a
// matrix row, and the aggregation/derivation math lifted verbatim out of
// RevenueMtdStripe / RevenueYtdStripe (which this replaces).
//
// Formatters are duplicated in app/revenue/page.tsx for the today/yesterday
// tiles it still builds; that copy stays until those tiles move too.

import type { KpiTileProps, StatusTone } from '@/app/(cockpit)/_design/types';

/** VAT 10% + service charge 10%, compounded — matches the retired stripes. */
export const TAX_SERVICE = 1.21;
export const TAX_SERVICE_LY = 1.21;

// ─── Rows ──────────────────────────────────────────────────────────────────

/** A row of the matrix. Order here is the order rendered. */
export type RowKey =
  | 'occ' | 'adr' | 'revpar'
  | 'roomsRev' | 'totalRev' | 'nights'
  | 'newBookings' | 'cancellations' | 'pickup';

/** Rows that belong to the core period matrix (Today · Yesterday · MTD · YTD). */
export const CORE_ROWS: RowKey[] = ['occ', 'adr', 'revpar', 'roomsRev', 'totalRev', 'nights'];

/** Rows that only exist for closed/opening days — rendered as a 2-column block. */
export const FLOW_ROWS: RowKey[] = ['newBookings', 'cancellations', 'pickup'];

export const ROW_META: Record<RowKey, { label: string; unit?: string; kpiKey?: string }> = {
  occ:           { label: 'OCC',               unit: 'in-house · of capacity',       kpiKey: 'occupancy_pct' },
  adr:           { label: 'ADR',               unit: 'net rooms rev ÷ rooms sold',   kpiKey: 'adr' },
  revpar:        { label: 'RevPAR',            unit: 'net rooms rev ÷ rooms avail.', kpiKey: 'revpar' },
  roomsRev:      { label: 'Rooms revenue',     unit: 'net' },
  totalRev:      { label: 'Total revenue',     unit: 'rooms + F&B + ancillary' },
  nights:        { label: 'Nights actualized', unit: 'closed days in range' },
  newBookings:   { label: 'New bookings',      unit: 'gross booked' },
  cancellations: { label: 'Cancellations',     unit: 'reservations lost' },
  pickup:        { label: 'Pickup net',        unit: 'booked − lost' },
};

/**
 * Classify a KpiTile label into a matrix row.
 *
 * `cfg.kpiTiles` is per-tenant config, so labels vary between properties and
 * carry period suffixes ('OCC' vs 'OCC · MTD'). Returns 'pace' for the
 * forward-looking PACE tile, which is not a period column and renders on its
 * own, and null for anything unrecognised — callers MUST render null-keyed
 * tiles somewhere rather than drop them, or a tenant-specific metric silently
 * disappears (L14).
 */
export function rowKeyForLabel(label: string): RowKey | 'pace' | null {
  const l = (label ?? '').trim().toLowerCase();
  if (!l) return null;

  if (l.startsWith('pace')) return 'pace';
  if (l.startsWith('occ')) return 'occ';
  if (l.startsWith('adr')) return 'adr';
  if (l.startsWith('revpar')) return 'revpar';

  // Order matters: 'Total revenue · MTD' also contains 'revenue'.
  if (l.includes('total revenue')) return 'totalRev';
  if (l.includes('rooms revenue') || l.startsWith('revenue ')) return 'roomsRev';
  if (l.includes('nights actualized')) return 'nights';

  if (l.includes('new bookings')) return 'newBookings';
  if (l.includes('cancellation')) return 'cancellations';
  if (l.includes('pickup')) return 'pickup';

  return null;
}

/** One cell of the matrix. `footnote` becomes the hover tooltip (PBS 2026-08-24). */
export interface Cell {
  value: string;
  ly?: string;
  status?: StatusTone;
  footnote?: string;
}

/** Project a KpiTile onto a matrix cell, keeping every affordance it carried. */
export function cellFromTile(t: KpiTileProps): Cell {
  const cell: Cell = { value: String(t.value) };
  if (t.stly) cell.ly = t.stly;
  if (t.status) cell.status = t.status;
  if (t.footnote) cell.footnote = t.footnote;
  return cell;
}

/** Index a stripe's tiles by row, preserving anything unrecognised. */
export function indexTiles(tiles: KpiTileProps[]): {
  byRow: Partial<Record<RowKey, Cell>>;
  pace?: KpiTileProps;
  extras: KpiTileProps[];
} {
  const byRow: Partial<Record<RowKey, Cell>> = {};
  const extras: KpiTileProps[] = [];
  let pace: KpiTileProps | undefined;

  for (const t of tiles) {
    const key = rowKeyForLabel(t.label);
    if (key === 'pace') { pace = t; continue; }
    if (key === null) { extras.push(t); continue; }
    if (byRow[key] === undefined) byRow[key] = cellFromTile(t);
    else extras.push(t); // duplicate metric in one stripe — surface, never swallow
  }
  return { byRow, pace, extras };
}

// ─── Aggregation ───────────────────────────────────────────────────────────

/** A row of public.v_kpi_daily_property. PostgREST returns numerics as strings. */
export interface DailyRow {
  night_date: string | null;
  rooms_available: number | null;
  rooms_sold: number | null;
  rooms_revenue: number | string | null;
  total_revenue: number | string | null;
}

export interface Agg {
  avail: number;
  sold: number;
  roomsRev: number;
  totalRev: number;
  nights: number;
}

export function aggregate(rows: DailyRow[]): Agg {
  let avail = 0, sold = 0, roomsRev = 0, totalRev = 0, nights = 0;
  for (const r of rows) {
    avail    += Number(r.rooms_available ?? 0);
    sold     += Number(r.rooms_sold ?? 0);
    roomsRev += Number(r.rooms_revenue ?? 0);
    totalRev += Number(r.total_revenue ?? 0);
    nights++;
  }
  return { avail, sold, roomsRev, totalRev, nights };
}

export interface DerivedKpis {
  occ: number;
  adr: number;
  revpar: number;
  netRoomsRev: number;
  netTotalRev: number;
}

/** Derive the headline KPIs from an aggregate, net of `tax`. Zero, never Infinity. */
export function deriveKpis(a: Agg, tax: number): DerivedKpis {
  return {
    occ:         a.avail > 0 ? (a.sold / a.avail) * 100 : 0,
    adr:         a.sold  > 0 ? (a.roomsRev / a.sold) / tax : 0,
    revpar:      a.avail > 0 ? (a.roomsRev / a.avail) / tax : 0,
    netRoomsRev: a.roomsRev / tax,
    netTotalRev: a.totalRev / tax,
  };
}

// ─── LY pill formatters ────────────────────────────────────────────────────

export function fmtSlyPct(v: number | string | null | undefined): string | undefined {
  if (v == null || v === '') return undefined;
  const n = Number(v);
  if (!Number.isFinite(n)) return undefined;
  return `LY ${n.toFixed(1)}%`;
}

/**
 * Money LY pill, divided by `tax` (pass 1 when the value is already net).
 * Non-positive returns nothing — a zero LY is noise on a money metric, and this
 * matches what the retired stripes did.
 */
export function fmtSlyMoney(
  v: number | string | null | undefined, sym: string, tax: number,
): string | undefined {
  if (v == null || v === '') return undefined;
  const n = Number(v);
  if (!Number.isFinite(n) || n <= 0) return undefined;
  return `LY ${sym}${Math.round(n / tax).toLocaleString('en-US')}`;
}

/** Room-night LY pill. Unlike money, a real 0 is kept: last year booked nothing too. */
export function fmtSlyRn(v: number | string | null | undefined): string | undefined {
  if (v == null || v === '') return undefined;
  const n = Number(v);
  if (!Number.isFinite(n)) return undefined;
  return `LY ${n.toLocaleString('en-US')} RN`;
}

// ─── Property helpers ──────────────────────────────────────────────────────

export function tzForProperty(pid: number): string {
  if (pid === 260955) return 'Asia/Vientiane';
  if (pid === 1000001) return 'Europe/Madrid';
  return 'UTC';
}

export function propertySymbol(pid: number): string {
  return pid === 1000001 ? '€' : '$';
}

export function localTodayIso(tz: string, now: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(now);
  const y = parts.find(p => p.type === 'year')?.value ?? '1970';
  const m = parts.find(p => p.type === 'month')?.value ?? '01';
  const d = parts.find(p => p.type === 'day')?.value ?? '01';
  return `${y}-${m}-${d}`;
}

export function addDays(iso: string, delta: number): string {
  const [y, m, d] = iso.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + delta);
  return dt.toISOString().slice(0, 10);
}

export function monthStart(iso: string): string { return `${iso.slice(0, 7)}-01`; }
export function yearStart(iso: string): string { return `${iso.slice(0, 4)}-01-01`; }

export function shiftYear(iso: string, delta: number): string {
  const [y, m, d] = iso.split('-').map(Number);
  return `${y + delta}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}
