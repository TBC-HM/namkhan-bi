// lib/period.ts
// Single source of truth for resolving URL searchParams into a usable period.
// Read by every Snapshot/Pulse/Demand page so the URL drives the data, not the other way around.
//
// Query params:
//   ?win=today | 7d | 30d | 90d | ytd | l12m | next7 | next30 | next90 | next180 | next365   (default: 30d)
//   ?cmp=none | pp | stly                                                                      (default: none)
//   ?seg=all | leisure | group | wholesale | corporate | honeymoon                             (default: all)
//   ?cap=selling | live | total                                                                 (default: selling)
//
// Two important behaviors:
//   1. UNKNOWN VALUES ARE COERCED TO DEFAULTS. Never throw.
//   2. ResolvedPeriod always returns ISO yyyy-mm-dd date strings the data layer can pass straight to Supabase.

import { format } from 'date-fns';

export type WindowKey =
  | 'today' | '7d' | '30d' | '90d' | 'ytd' | 'l12m'
  | 'next7' | 'next30' | 'next90' | 'next180' | 'next365';

// CompareKey: PBS 2026-05-09 expanded the set so every revenue/finance page
// can offer last-week / last-month / SDLY / STLY / Budget compares alongside
// the legacy "prior period" (pp) shim.
//   none   → no compare
//   pp     → prior period (same length, immediately before current window)  [legacy]
//   stly   → same time last year (window shifted -1 calendar year)
//   sdly   → same day(s) last year (alias of stly for now; reserved for future
//            day-level offset logic that snaps to weekday rather than date)
//   lw     → last week (window shifted -7 days)
//   lm     → last month (window shifted -1 calendar month, approx -30 days)
//   budget → compare against budget plan (data layer wires this; UI just sets cmpLabel)
export type CompareKey = 'none' | 'pp' | 'stly' | 'sdly' | 'lw' | 'lm' | 'budget';
// SegmentKey aligned to actual reservations.market_segment values
// (verified 2026-05-01: Retail, Discount, DMC, Comp, Group Bookings, NULL).
export type SegmentKey = 'all' | 'retail' | 'dmc' | 'group' | 'discount' | 'comp' | 'unsegmented';

// Capacity-mode toggle (added 2026-05-01 per Cowork handoff).
//   selling → mv_kpi_daily.capacity_selling  (24 — USALI default; bookings in last 90d)
//   live    → mv_kpi_daily.capacity_live     (30 — currently-marketable, incl. soon-launching)
//   total   → mv_kpi_daily.capacity_total    (30 — all physical room types in PMS)
// Behavior: URL param ?cap=. Default: selling. Resets on pillar-boundary nav
// (see components/nav/CapacityResetOnPillarChange.tsx).
export type CapacityMode = 'selling' | 'live' | 'total';

export interface ResolvedPeriod {
  win: WindowKey;
  cmp: CompareKey;
  seg: SegmentKey;
  capacityMode: CapacityMode;
  // Direction: 'back' (looks at past), 'fwd' (looks at future). Today = 'back'.
  direction: 'back' | 'fwd';
  // Primary range
  from: string;     // yyyy-mm-dd inclusive
  to: string;       // yyyy-mm-dd inclusive
  days: number;     // length in days
  // Comparison range (only meaningful when cmp !== 'none')
  compareFrom: string | null;
  compareTo: string | null;
  // Pretty labels for UI
  label: string;        // "30 days back", "Next 90 days"
  rangeLabel: string;   // "31 Mar 2026 → 30 Apr 2026"
  cmpLabel: string;     // "Prior period", "Same time last year", ""
  segLabel: string;     // "All segments", "Leisure"
  capLabel: string;     // "Selling", "Live", "Total"
}

// ---------- Allowed values, defaults ----------
const WIN_VALUES: WindowKey[] = ['today','7d','30d','90d','ytd','l12m','next7','next30','next90','next180','next365'];
const CMP_VALUES: CompareKey[] = ['none','pp','stly','sdly','lw','lm','budget'];
const SEG_VALUES: SegmentKey[] = ['all','retail','dmc','group','discount','comp','unsegmented'];
const CAP_VALUES: CapacityMode[] = ['selling','live','total'];

const DEFAULT_WIN: WindowKey = '30d';
const DEFAULT_CMP: CompareKey = 'none';
const DEFAULT_SEG: SegmentKey = 'all';
const DEFAULT_CAP: CapacityMode = 'selling';

// ---------- Helpers ----------
function clamp<T extends string>(input: unknown, allowed: readonly T[], fallback: T): T {
  const v = String(Array.isArray(input) ? input[0] : input ?? '').toLowerCase();
  return (allowed as readonly string[]).includes(v) ? (v as T) : fallback;
}

function iso(d: Date): string {
  return format(d, 'yyyy-MM-dd');
}
function pretty(d: Date): string {
  return format(d, 'd MMM yyyy');
}
function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}
function addYears(d: Date, n: number): Date {
  const r = new Date(d);
  r.setFullYear(r.getFullYear() + n);
  return r;
}

// ---------- Window range computation ----------
function windowRange(win: WindowKey, today = new Date()):
  { from: Date; to: Date; direction: 'back' | 'fwd'; days: number; label: string } {
  switch (win) {
    case 'today':   return { from: today, to: today, direction: 'back', days: 1, label: 'Today' };
    case '7d':      return { from: addDays(today, -6),  to: today, direction: 'back', days: 7, label: 'Last 7 days' };
    case '30d':     return { from: addDays(today, -29), to: today, direction: 'back', days: 30, label: 'Last 30 days' };
    case '90d':     return { from: addDays(today, -89), to: today, direction: 'back', days: 90, label: 'Last 90 days' };
    case 'ytd': {
      const jan1 = new Date(today.getFullYear(), 0, 1);
      const days = Math.round((today.getTime() - jan1.getTime()) / 86_400_000) + 1;
      return { from: jan1, to: today, direction: 'back', days, label: 'Year to date' };
    }
    case 'l12m':    return { from: addYears(today, -1), to: today, direction: 'back', days: 365, label: 'Last 12 months' };
    case 'next7':   return { from: today, to: addDays(today, 6),   direction: 'fwd', days: 7, label: 'Next 7 days' };
    case 'next30':  return { from: today, to: addDays(today, 29),  direction: 'fwd', days: 30, label: 'Next 30 days' };
    case 'next90':  return { from: today, to: addDays(today, 89),  direction: 'fwd', days: 90, label: 'Next 90 days' };
    case 'next180': return { from: today, to: addDays(today, 179), direction: 'fwd', days: 180, label: 'Next 6 months' };
    case 'next365': return { from: today, to: addDays(today, 364), direction: 'fwd', days: 365, label: 'Next 12 months' };
  }
}

// ---------- Compare range computation ----------
function compareRange(cmp: CompareKey, from: Date, to: Date, days: number): { from: Date; to: Date } | null {
  if (cmp === 'none' || cmp === 'budget') return null;
  if (cmp === 'pp') {
    // Prior period: shift back by `days` days
    return { from: addDays(from, -days), to: addDays(to, -days) };
  }
  if (cmp === 'stly' || cmp === 'sdly') {
    // Same time last year (calendar) / same day last year (placeholder = stly).
    return { from: addYears(from, -1), to: addYears(to, -1) };
  }
  if (cmp === 'lw') {
    // Last week: shift back 7 days.
    return { from: addDays(from, -7), to: addDays(to, -7) };
  }
  if (cmp === 'lm') {
    // Last month: shift back ~30 days (calendar month is approximate; data layer
    // can refine if needed).
    return { from: addDays(from, -30), to: addDays(to, -30) };
  }
  return null;
}

// ---------- Compare/segment labels ----------
const CMP_LABELS: Record<CompareKey, string> = {
  none: '',
  pp: 'vs Prior period',
  stly: 'vs Same time last year',
  sdly: 'vs Same day last year',
  lw: 'vs Last week',
  lm: 'vs Last month',
  budget: 'vs Budget',
};
const SEG_LABELS: Record<SegmentKey, string> = {
  all: 'All segments',
  retail: 'Retail',
  dmc: 'DMC',
  group: 'Group bookings',
  discount: 'Discount',
  comp: 'Comp',
  unsegmented: 'Unsegmented (NULL)',
};
const CAP_LABELS: Record<CapacityMode, string> = {
  selling: 'Selling',
  live: 'Live',
  total: 'Total',
};

// ---------- Main resolver ----------
export function resolvePeriod(
  searchParams: Record<string, string | string[] | undefined> | undefined
): ResolvedPeriod {
  const sp = searchParams ?? {};
  const win = clamp(sp.win, WIN_VALUES, DEFAULT_WIN);
  const cmp = clamp(sp.cmp, CMP_VALUES, DEFAULT_CMP);
  const seg = clamp(sp.seg, SEG_VALUES, DEFAULT_SEG);
  const cap = clamp(sp.cap, CAP_VALUES, DEFAULT_CAP);

  const today = new Date();
  const { from, to, direction, days, label } = windowRange(win, today);
  const cmpRange = compareRange(cmp, from, to, days);

  return {
    win, cmp, seg, capacityMode: cap, direction, days,
    from: iso(from),
    to: iso(to),
    compareFrom: cmpRange ? iso(cmpRange.from) : null,
    compareTo: cmpRange ? iso(cmpRange.to) : null,
    label,
    rangeLabel: `${pretty(from)} → ${pretty(to)}`,
    cmpLabel: CMP_LABELS[cmp],
    segLabel: SEG_LABELS[seg],
    capLabel: CAP_LABELS[cap],
  };
}

// Helpers exported for non-React callers (rate plans, etc.)
export const WINDOWS = WIN_VALUES;
export const COMPARES = CMP_VALUES;
export const SEGMENTS = SEG_VALUES;
export const CAPACITY_MODES = CAP_VALUES;

// ---------- Backwards-compat shims (v1.2 repair) ----------
// lib/data.ts and any other pre-v1.2 consumers import Segment + segmentFilter.
// v1.2 renamed Segment -> SegmentKey and removed segmentFilter.

/** Alias for SegmentKey. Kept for pre-v1.2 callers. */
export type Segment = SegmentKey;

/**
 * Maps SegmentKey to the actual public.reservations.market_segment values.
 * Wired 2026-05-01 — segment dropdown is now functional, not cosmetic.
 *
 * Returns:
 *   { column: 'market_segment', values: ['Retail'], isNull: false }   for retail
 *   { column: 'market_segment', values: null, isNull: true }          for unsegmented
 *   { column: null, ... }                                              for 'all' (no filter)
 */
export function segmentFilter(seg: SegmentKey): {
  column: string | null;
  values: string[] | null;
  isNull: boolean;
  // legacy field, kept for compat with old callers expecting `ilike`
  ilike: string | null;
} {
  const mapping: Record<SegmentKey, { values: string[] | null; isNull: boolean }> = {
    all:          { values: null,                  isNull: false },
    retail:       { values: ['Retail'],            isNull: false },
    dmc:          { values: ['DMC'],               isNull: false },
    group:        { values: ['Group Bookings'],    isNull: false },
    discount:     { values: ['Discount'],          isNull: false },
    comp:         { values: ['Comp'],              isNull: false },
    unsegmented:  { values: null,                  isNull: true  },
  };
  const m = mapping[seg];
  if (seg === 'all') {
    return { column: null, values: null, isNull: false, ilike: null };
  }
  return {
    column: 'market_segment',
    values: m.values,
    isNull: m.isNull,
    ilike: null,
  };
}
