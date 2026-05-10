// lib/dateRangeFromParams.ts
// Shared utility: parse ?win + ?cmp URL params → concrete date ranges.
//
// URL param contract (ADR — ticket #691):
//   ?win=  today | 7d | 30d | 90d | ytd   (default: 30d)
//   ?cmp=  stly  | prior | none            (default: none)
//
// "today" = full calendar day midnight→23:59:59 (not midnight-to-now),
// so occupancy % is based on the full day schedule, not a partial slice.
// Invalid values fall back to defaults silently (no throw).

export type WinToken = 'today' | '7d' | '30d' | '90d' | 'ytd';
export type CmpToken = 'stly' | 'prior' | 'none';

export const WIN_DEFAULT: WinToken = '30d';
export const CMP_DEFAULT: CmpToken = 'none';

const VALID_WIN = new Set<string>(['today', '7d', '30d', '90d', 'ytd']);
const VALID_CMP = new Set<string>(['stly', 'prior', 'none']);

export function parseWin(raw: string | string[] | undefined | null): WinToken {
  const v = Array.isArray(raw) ? raw[0] : raw;
  return VALID_WIN.has(v ?? '') ? (v as WinToken) : WIN_DEFAULT;
}

export function parseCmp(raw: string | string[] | undefined | null): CmpToken {
  const v = Array.isArray(raw) ? raw[0] : raw;
  return VALID_CMP.has(v ?? '') ? (v as CmpToken) : CMP_DEFAULT;
}

export interface DateRange {
  startDate: string;   // ISO date string YYYY-MM-DD
  endDate: string;
  compareStart: string | null;
  compareEnd: string | null;
}

/** Return YYYY-MM-DD for a Date object. */
function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** Add (or subtract) days to a date, returning a new Date. */
function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

/**
 * Compute concrete start/end + optional compare range from validated tokens.
 * All dates are in local time (hotel is UTC+7; server-side callers should
 * ensure TZ=Asia/Vientiane is set in Vercel env).
 */
export function dateRangeFromParams(
  win: WinToken = WIN_DEFAULT,
  cmp: CmpToken = CMP_DEFAULT,
): DateRange {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  let startDate: Date;
  let endDate: Date = new Date(today); // inclusive end = today

  switch (win) {
    case 'today':
      startDate = new Date(today);
      break;
    case '7d':
      startDate = addDays(today, -6);
      break;
    case '30d':
      startDate = addDays(today, -29);
      break;
    case '90d':
      startDate = addDays(today, -89);
      break;
    case 'ytd':
      startDate = new Date(today.getFullYear(), 0, 1); // Jan 1
      break;
    default:
      startDate = addDays(today, -29);
  }

  const windowDays =
    Math.round((endDate.getTime() - startDate.getTime()) / 86_400_000) + 1;

  let compareStart: Date | null = null;
  let compareEnd: Date | null = null;

  if (cmp === 'stly') {
    // Same date range, exactly one year earlier.
    compareStart = new Date(startDate);
    compareStart.setFullYear(compareStart.getFullYear() - 1);
    compareEnd = new Date(endDate);
    compareEnd.setFullYear(compareEnd.getFullYear() - 1);
  } else if (cmp === 'prior') {
    // Preceding window of equal length immediately before startDate.
    compareEnd = addDays(startDate, -1);
    compareStart = addDays(compareEnd, -(windowDays - 1));
  }

  return {
    startDate:    isoDate(startDate),
    endDate:      isoDate(endDate),
    compareStart: compareStart ? isoDate(compareStart) : null,
    compareEnd:   compareEnd   ? isoDate(compareEnd)   : null,
  };
}
