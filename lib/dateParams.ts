/**
 * dateParams.ts — resolveWindow / resolveCompare utilities
 * Ticket #600
 *
 * Assumptions:
 * - "Today" = current calendar day (00:00–23:59 local)
 * - STLY = exact −365 days (calendar, not fiscal)
 * - YTD anchors to Jan 1 of current calendar year
 * - Prior Period = same length of days immediately before the window
 */

export type WinSlug = 'today' | '7d' | '30d' | '90d' | 'ytd';
export type CmpSlug = 'stly' | 'prior' | 'none';

export interface DateRange {
  from: string; // ISO 8601 date YYYY-MM-DD
  to: string;
}

function toISO(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

/**
 * Resolve a window slug to an inclusive [from, to] ISO date pair.
 * All dates are relative to the caller's "today" (or the injected `now`).
 */
export function resolveWindow(slug: WinSlug, now: Date = new Date()): DateRange {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  switch (slug) {
    case 'today':
      return { from: toISO(today), to: toISO(today) };

    case '7d':
      return { from: toISO(addDays(today, -6)), to: toISO(today) };

    case '30d':
      return { from: toISO(addDays(today, -29)), to: toISO(today) };

    case '90d':
      return { from: toISO(addDays(today, -89)), to: toISO(today) };

    case 'ytd': {
      const jan1 = new Date(today.getFullYear(), 0, 1);
      return { from: toISO(jan1), to: toISO(today) };
    }

    default:
      // Exhaustive guard — TypeScript will warn on unknown slugs
      return { from: toISO(today), to: toISO(today) };
  }
}

/**
 * Resolve a compare slug given the primary window's date range.
 * Returns null when slug === 'none'.
 */
export function resolveCompare(
  slug: CmpSlug,
  primary: DateRange
): DateRange | null {
  if (slug === 'none') return null;

  const from = new Date(primary.from);
  const to   = new Date(primary.to);
  const lengthDays =
    Math.round((to.getTime() - from.getTime()) / 86_400_000) + 1;

  if (slug === 'stly') {
    return {
      from: toISO(addDays(from, -365)),
      to:   toISO(addDays(to,   -365)),
    };
  }

  // prior — same number of days immediately before the window
  if (slug === 'prior') {
    const priorTo   = addDays(from, -1);
    const priorFrom = addDays(priorTo, -(lengthDays - 1));
    return { from: toISO(priorFrom), to: toISO(priorTo) };
  }

  return null;
}

/** Validate a raw URL param value against known slugs (returns default on miss). */
export function coerceWin(raw: string | null | undefined): WinSlug {
  const valid: WinSlug[] = ['today', '7d', '30d', '90d', 'ytd'];
  return valid.includes(raw as WinSlug) ? (raw as WinSlug) : '30d';
}

export function coerceCmp(raw: string | null | undefined): CmpSlug {
  const valid: CmpSlug[] = ['stly', 'prior', 'none'];
  return valid.includes(raw as CmpSlug) ? (raw as CmpSlug) : 'stly';
}
