/**
 * Shared server-side helpers for resolving ?win and ?cmp URL params
 * into concrete date ranges used by data-fetching functions.
 *
 * Assumptions
 * -----------
 * - "Today"  = full calendar day in the hotel's local timezone (Asia/Vientiane).
 * - "STLY"   = same calendar-date range shifted back 365 days (not day-of-week offset).
 * - When ?win is absent the default is "30d".
 * - When ?cmp is absent the default is "stly".
 */

export type WinParam = "today" | "7d" | "30d" | "90d" | "ytd";
export type CmpParam = "stly" | "prior" | "none";

export const DEFAULT_WIN: WinParam = "30d";
export const DEFAULT_CMP: CmpParam = "stly";

/** Hotel local timezone. */
const TZ = "Asia/Vientiane";

/** Return today's date string (YYYY-MM-DD) in hotel local time. */
function localToday(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: TZ }); // en-CA gives YYYY-MM-DD
}

function addDays(dateStr: string, days: number): string {
  const d = new Date(`${dateStr}T00:00:00`);
  d.setDate(d.getDate() + days);
  return d.toLocaleDateString("en-CA");
}

function addYears(dateStr: string, years: number): string {
  const d = new Date(`${dateStr}T00:00:00`);
  d.setFullYear(d.getFullYear() + years);
  return d.toLocaleDateString("en-CA");
}

export interface DateRange {
  from: string; // YYYY-MM-DD inclusive
  to:   string; // YYYY-MM-DD inclusive
}

/**
 * Resolve ?win param → primary DateRange.
 */
export function getDateWindow(win: string | null | undefined): DateRange {
  const w = (win ?? DEFAULT_WIN) as WinParam;
  const today = localToday();

  switch (w) {
    case "today":
      return { from: today, to: today };
    case "7d":
      return { from: addDays(today, -6), to: today };
    case "90d":
      return { from: addDays(today, -89), to: today };
    case "ytd": {
      const year = today.slice(0, 4);
      return { from: `${year}-01-01`, to: today };
    }
    case "30d":
    default:
      return { from: addDays(today, -29), to: today };
  }
}

/**
 * Resolve ?cmp param → comparison DateRange (or null when cmp=none).
 */
export function getCompareRange(
  primary: DateRange,
  cmp: string | null | undefined,
): DateRange | null {
  const c = (cmp ?? DEFAULT_CMP) as CmpParam;

  if (c === "none") return null;

  const spanDays =
    Math.round(
      (new Date(primary.to).getTime() - new Date(primary.from).getTime()) /
        86_400_000,
    ) + 1;

  if (c === "stly") {
    return {
      from: addYears(primary.from, -1),
      to:   addYears(primary.to,   -1),
    };
  }

  // prior period
  return {
    from: addDays(primary.from, -spanDays),
    to:   addDays(primary.from, -1),
  };
}
