// lib/period.ts
// Period state for dashboard. URL-param driven so deep-links work.
// Server components read params, client component dropdowns push to URL.

export type LookBack =
  | 'last_7'
  | 'last_30'
  | 'last_90'
  | 'ytd'
  | 'last_365'
  | 'last_year';

export type Forward =
  | ''
  | 'next_7'
  | 'next_30'
  | 'next_90'
  | 'next_180'
  | 'next_365'
  | 'next_year';

export type Segment =
  | 'all'
  | 'ota'
  | 'direct'
  | 'wholesale'
  | 'corporate'
  | 'group'
  | 'walkin';

export type Compare = '' | 'stly' | 'prior' | 'budget';

export interface PeriodState {
  back: LookBack;
  fwd: Forward;
  seg: Segment;
  cmp: Compare;
}

export const DEFAULT_PERIOD: PeriodState = {
  back: 'last_30',
  fwd: '',
  seg: 'all',
  cmp: '',
};

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

// Resolve a period code into actual date range.
// Returns ISO date strings (YYYY-MM-DD) inclusive.
export function resolveDateRange(
  code: LookBack | Exclude<Forward, ''>,
  today = new Date()
): { from: string; to: string } {
  const t = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const fmt = (d: Date) => d.toISOString().slice(0, 10);

  const subDays = (n: number) => {
    const d = new Date(t);
    d.setDate(d.getDate() - n);
    return d;
  };
  const addDays = (n: number) => {
    const d = new Date(t);
    d.setDate(d.getDate() + n);
    return d;
  };

  switch (code) {
    case 'last_7':
      return { from: fmt(subDays(7)), to: fmt(t) };
    case 'last_30':
      return { from: fmt(subDays(30)), to: fmt(t) };
    case 'last_90':
      return { from: fmt(subDays(90)), to: fmt(t) };
    case 'ytd':
      return {
        from: fmt(new Date(t.getFullYear(), 0, 1)),
        to: fmt(t),
      };
    case 'last_365':
      return { from: fmt(subDays(365)), to: fmt(t) };
    case 'last_year':
      return {
        from: `${t.getFullYear() - 1}-01-01`,
        to: `${t.getFullYear() - 1}-12-31`,
      };
    case 'next_7':
      return { from: fmt(t), to: fmt(addDays(7)) };
    case 'next_30':
      return { from: fmt(t), to: fmt(addDays(30)) };
    case 'next_90':
      return { from: fmt(t), to: fmt(addDays(90)) };
    case 'next_180':
      return { from: fmt(t), to: fmt(addDays(180)) };
    case 'next_365':
      return { from: fmt(t), to: fmt(addDays(365)) };
    case 'next_year':
      return {
        from: `${t.getFullYear() + 1}-01-01`,
        to: `${t.getFullYear() + 1}-12-31`,
      };
  }
}

// Parse from Next.js searchParams (string | string[] | undefined)
export function parsePeriod(
  searchParams: Record<string, string | string[] | undefined> | undefined
): PeriodState {
  const get = (k: string): string | undefined => {
    const v = searchParams?.[k];
    if (Array.isArray(v)) return v[0];
    return v;
  };
  const back = (get('back') as LookBack) ?? DEFAULT_PERIOD.back;
  const fwd = (get('fwd') as Forward) ?? DEFAULT_PERIOD.fwd;
  const seg = (get('seg') as Segment) ?? DEFAULT_PERIOD.seg;
  const cmp = (get('cmp') as Compare) ?? DEFAULT_PERIOD.cmp;
  return {
    back: back in LOOK_BACK_LABELS ? back : DEFAULT_PERIOD.back,
    fwd: fwd === '' || fwd in FORWARD_LABELS ? fwd : DEFAULT_PERIOD.fwd,
    seg: seg in SEGMENT_LABELS ? seg : DEFAULT_PERIOD.seg,
    cmp: cmp === '' || cmp in COMPARE_LABELS ? cmp : DEFAULT_PERIOD.cmp,
  };
}
