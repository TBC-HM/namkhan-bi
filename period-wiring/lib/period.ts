// lib/period.ts
// Single source of truth for period state across the dashboard.
//
// Server components call resolvePeriod(searchParams) → ResolvedPeriod
// Client PeriodBar pushes to URL. That's the contract.
//
// Every data fetcher in lib/data.ts MUST accept ResolvedPeriod (or its
// {from, to, segment} subset) instead of hardcoded windows.

// ============================================================================
// TYPES
// ============================================================================

export type LookBack =
  | 'last_7' | 'last_30' | 'last_90'
  | 'ytd' | 'last_365' | 'last_year';

export type Forward =
  | '' | 'next_7' | 'next_30' | 'next_90'
  | 'next_180' | 'next_365' | 'next_year';

export type Segment =
  | 'all' | 'ota' | 'direct' | 'wholesale'
  | 'corporate' | 'group' | 'walkin';

export type Compare = '' | 'stly' | 'prior' | 'budget';

export interface PeriodState {
  back: LookBack;
  fwd: Forward;
  seg: Segment;
  cmp: Compare;
}

export interface ResolvedPeriod extends PeriodState {
  /** Active range from→to (always populated, comes from back or fwd) */
  from: string;        // YYYY-MM-DD inclusive
  to: string;          // YYYY-MM-DD inclusive
  /** Direction: which dropdown is driving the range */
  direction: 'back' | 'fwd';
  /** Comparison range if cmp != '' (STLY = same range last year, prior = preceding range of equal length) */
  compareFrom: string | null;
  compareTo: string | null;
  /** Number of days in the active range */
  days: number;
  /** Display labels */
  label: string;            // "Last Year · OTA · vs STLY"
  rangeLabel: string;       // "29 Apr 2025 → 28 Apr 2026"
}

// ============================================================================
// LABELS
// ============================================================================

export const LOOK_BACK_LABELS: Record<LookBack, string> = {
  last_7: 'Last Week',
  last_30: 'Last Month',
  last_90: 'Last Quarter',
  ytd: 'Year to Date',
  last_365: 'Last 12 Months',
  last_year: 'Last Year',
};

export const FORWARD_LABELS: Record<Exclude<Forward, ''>, string> = {
  next_7: 'Next Week',
  next_30: 'Next Month',
  next_90: 'Next Quarter',
  next_180: 'Next 6 Months',
  next_365: 'Next 12 Months',
  next_year: 'Next Year',
};

export const SEGMENT_LABELS: Record<Segment, string> = {
  all: 'All Segments',
  ota: 'OTA',
  direct: 'Direct',
  wholesale: 'Wholesale',
  corporate: 'Corporate',
  group: 'Group',
  walkin: 'Walk-In',
};

export const COMPARE_LABELS: Record<Compare, string> = {
  '': 'No comparison',
  stly: 'vs STLY',
  prior: 'vs Prior Period',
  budget: 'vs Budget',
};

export const DEFAULT_PERIOD: PeriodState = {
  back: 'last_30',
  fwd: '',
  seg: 'all',
  cmp: '',
};

// ============================================================================
// RANGE RESOLUTION
// ============================================================================

const fmt = (d: Date) => d.toISOString().slice(0, 10);

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function addDays(d: Date, n: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

function resolveRange(
  code: LookBack | Exclude<Forward, ''>,
  today = new Date()
): { from: string; to: string } {
  const t = startOfDay(today);

  switch (code) {
    case 'last_7':    return { from: fmt(addDays(t, -7)),   to: fmt(t) };
    case 'last_30':   return { from: fmt(addDays(t, -30)),  to: fmt(t) };
    case 'last_90':   return { from: fmt(addDays(t, -90)),  to: fmt(t) };
    case 'ytd':       return { from: fmt(new Date(t.getFullYear(), 0, 1)), to: fmt(t) };
    case 'last_365':  return { from: fmt(addDays(t, -365)), to: fmt(t) };
    case 'last_year': return { from: `${t.getFullYear()-1}-01-01`, to: `${t.getFullYear()-1}-12-31` };

    case 'next_7':    return { from: fmt(t),                to: fmt(addDays(t, 7)) };
    case 'next_30':   return { from: fmt(t),                to: fmt(addDays(t, 30)) };
    case 'next_90':   return { from: fmt(t),                to: fmt(addDays(t, 90)) };
    case 'next_180':  return { from: fmt(t),                to: fmt(addDays(t, 180)) };
    case 'next_365':  return { from: fmt(t),                to: fmt(addDays(t, 365)) };
    case 'next_year': return { from: `${t.getFullYear()+1}-01-01`, to: `${t.getFullYear()+1}-12-31` };
  }
}

function resolveCompareRange(
  from: string,
  to: string,
  cmp: Compare
): { compareFrom: string | null; compareTo: string | null } {
  if (!cmp || cmp === 'budget') return { compareFrom: null, compareTo: null };

  const fromDate = new Date(from + 'T00:00:00Z');
  const toDate = new Date(to + 'T00:00:00Z');
  const days = Math.round((toDate.getTime() - fromDate.getTime()) / 86_400_000);

  if (cmp === 'stly') {
    const cf = new Date(fromDate); cf.setUTCFullYear(cf.getUTCFullYear() - 1);
    const ct = new Date(toDate);   ct.setUTCFullYear(ct.getUTCFullYear() - 1);
    return { compareFrom: fmt(cf), compareTo: fmt(ct) };
  }

  if (cmp === 'prior') {
    const ct = new Date(fromDate); ct.setUTCDate(ct.getUTCDate() - 1);
    const cf = new Date(ct);       cf.setUTCDate(cf.getUTCDate() - days);
    return { compareFrom: fmt(cf), compareTo: fmt(ct) };
  }

  return { compareFrom: null, compareTo: null };
}

function fmtDateNice(iso: string): string {
  const d = new Date(iso + 'T00:00:00Z');
  return d.toLocaleDateString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC',
  });
}

// ============================================================================
// PARSE FROM searchParams
// ============================================================================

function get(sp: Record<string, string | string[] | undefined> | undefined, k: string): string | undefined {
  const v = sp?.[k];
  if (Array.isArray(v)) return v[0];
  return v;
}

export function parsePeriod(
  searchParams: Record<string, string | string[] | undefined> | undefined
): PeriodState {
  const back = get(searchParams, 'back') as LookBack | undefined;
  const fwd  = get(searchParams, 'fwd')  as Forward  | undefined;
  const seg  = get(searchParams, 'seg')  as Segment  | undefined;
  const cmp  = get(searchParams, 'cmp')  as Compare  | undefined;

  return {
    back: back && back in LOOK_BACK_LABELS ? back : DEFAULT_PERIOD.back,
    fwd:  fwd === '' || fwd === undefined ? DEFAULT_PERIOD.fwd
         : (fwd in FORWARD_LABELS ? fwd : DEFAULT_PERIOD.fwd),
    seg:  seg && seg in SEGMENT_LABELS ? seg : DEFAULT_PERIOD.seg,
    cmp:  !cmp ? '' : (cmp in COMPARE_LABELS ? cmp : ''),
  };
}

// ============================================================================
// MAIN RESOLVER — call this in every server page
// ============================================================================

export function resolvePeriod(
  searchParams: Record<string, string | string[] | undefined> | undefined,
  today = new Date()
): ResolvedPeriod {
  const state = parsePeriod(searchParams);

  // Forward wins if set, otherwise back
  const direction: 'back' | 'fwd' = state.fwd ? 'fwd' : 'back';
  const code = direction === 'fwd' ? state.fwd : state.back;
  const { from, to } = resolveRange(code as any, today);
  const { compareFrom, compareTo } = resolveCompareRange(from, to, state.cmp);

  const days = Math.round(
    (new Date(to + 'T00:00:00Z').getTime() - new Date(from + 'T00:00:00Z').getTime()) / 86_400_000
  );

  const periodLabel = direction === 'fwd'
    ? FORWARD_LABELS[state.fwd as Exclude<Forward,''>]
    : LOOK_BACK_LABELS[state.back];
  const segLabel = state.seg !== 'all' ? ` · ${SEGMENT_LABELS[state.seg]}` : '';
  const cmpLabel = state.cmp ? ` · ${COMPARE_LABELS[state.cmp]}` : '';
  const label = `${periodLabel}${segLabel}${cmpLabel}`;
  const rangeLabel = `${fmtDateNice(from)} → ${fmtDateNice(to)}`;

  return {
    ...state,
    from, to, direction,
    compareFrom, compareTo,
    days,
    label, rangeLabel,
  };
}

// ============================================================================
// SQL HELPERS — for use inside lib/data.ts
// ============================================================================

/**
 * Returns a SQL fragment that filters the `source` (channel) column
 * by the chosen segment. Returns empty string for 'all'.
 *
 * Usage in PostgREST .or() / .ilike() chains:
 *   const seg = segmentFilter(period.seg);
 *   if (seg.column) query = query.in(seg.column, seg.values);
 */
export function segmentFilter(seg: Segment): {
  column: string | null;
  values: string[] | null;
  ilike: string | null;
} {
  if (seg === 'all') return { column: null, values: null, ilike: null };

  // Map your Cloudbeds source values to segments. Edit if your data uses different labels.
  const map: Record<Exclude<Segment, 'all'>, string[]> = {
    ota:        ['Booking.com', 'Expedia', 'Agoda', 'CTrip / Trip.com', 'Hotels.com'],
    direct:     ['Website/Booking Engine', 'Direct', 'Walk-In Direct', 'Email', 'Phone'],
    wholesale:  ['Retreat Reseller (f.eVigeosport)', 'Wholesaler', 'Tour Operator'],
    corporate:  ['Corporate'],
    group:      ['Group'],
    walkin:     ['Walk-In'],
  };

  return { column: 'source', values: map[seg] ?? [], ilike: null };
}
