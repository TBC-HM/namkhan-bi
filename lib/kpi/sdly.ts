// lib/kpi/sdly.ts
// PBS 2026-07-02: single-source SDLY delta helper. Any page that wants a
// "vs same-time last year" delta on a KpiTile calls this, spreads the
// returned object onto the tile's `delta` prop. KpiTile primitive already
// colors up=green / down=red by default (isGoodWhenUp: true is the primitive
// default) so no per-tile config is needed.
//
// Namkhan capacity caveat: `v_kpi_daily.rooms_available` shifted from 24 → 46
// around 2026-06-30 (uses capacity_total, not capacity_selling). Occupancy
// comparisons across that boundary will trend low. Fix upstream in the view.

import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import type { KpiDelta } from '@/app/(cockpit)/_design/types';

export type SdlyMetric =
  | 'occupancy'
  | 'adr'
  | 'revpar'
  | 'rooms_revenue'
  | 'total_revenue'
  | 'rooms_sold'
  | 'arrivals';

export interface SdlyInput {
  propertyId: number;
  /** Current period start · YYYY-MM-DD */
  fromDate: string;
  /** Current period end · YYYY-MM-DD */
  toDate: string;
  metric: SdlyMetric;
  /** View to pull from · default `v_kpi_daily` (Namkhan-only today). */
  view?: string;
  /** Force `isGoodWhenUp` on the returned delta · defaults to metric-appropriate. */
  isGoodWhenUp?: boolean;
}

export interface SdlyResult {
  /** Current period aggregate value. */
  now: number;
  /** SDLY period aggregate value (same offset, prior year). */
  sdly: number;
  /** % change vs SDLY. Positive = up. */
  delta: KpiDelta;
}

/** Default "up is good" per metric. Costs / cancels would be flipped. */
function isGoodWhenUpFor(metric: SdlyMetric): boolean {
  switch (metric) {
    case 'occupancy':
    case 'adr':
    case 'revpar':
    case 'rooms_revenue':
    case 'total_revenue':
    case 'rooms_sold':
    case 'arrivals':
      return true;
    default:
      return true;
  }
}

function shiftYear(iso: string, delta: number): string {
  const d = new Date(iso + 'T00:00:00Z');
  d.setUTCFullYear(d.getUTCFullYear() + delta);
  return d.toISOString().slice(0, 10);
}

interface KpiRow {
  rooms_available: number;
  rooms_sold: number;
  rooms_revenue: number;
  total_revenue: number;
  arrivals: number;
}

function reduce(rows: KpiRow[], metric: SdlyMetric): number {
  const avail  = rows.reduce((s, r) => s + Number(r.rooms_available ?? 0), 0);
  const sold   = rows.reduce((s, r) => s + Number(r.rooms_sold      ?? 0), 0);
  const rev    = rows.reduce((s, r) => s + Number(r.rooms_revenue   ?? 0), 0);
  const totRev = rows.reduce((s, r) => s + Number(r.total_revenue   ?? 0), 0);
  const arr    = rows.reduce((s, r) => s + Number(r.arrivals        ?? 0), 0);
  switch (metric) {
    case 'occupancy':      return avail > 0 ? (sold / avail) * 100 : 0;
    case 'adr':            return sold  > 0 ? rev / sold           : 0;
    case 'revpar':         return avail > 0 ? rev / avail          : 0;
    case 'rooms_revenue':  return rev;
    case 'total_revenue':  return totRev;
    case 'rooms_sold':     return sold;
    case 'arrivals':       return arr;
  }
}

/**
 * Fetch both current and SDLY periods, return `{ now, sdly, delta }` ready
 * to spread onto a KpiTile: `delta: r.delta` renders up=green/down=red for free.
 *
 * SDLY = "same-day-last-year" shifted by exactly 1 calendar year. Feb 29 rolls
 * to Feb 28 automatically via JavaScript Date behaviour.
 */
export async function computeSdlyDelta(input: SdlyInput): Promise<SdlyResult> {
  const view = input.view ?? 'v_kpi_daily';
  const sdlyFrom = shiftYear(input.fromDate, -1);
  const sdlyTo   = shiftYear(input.toDate,   -1);

  const supabase = getSupabaseAdmin();
  const select = 'rooms_available,rooms_sold,rooms_revenue,total_revenue,arrivals';

  const [nowRes, sdlyRes] = await Promise.all([
    supabase.from(view).select(select).gte('metric_date', input.fromDate).lte('metric_date', input.toDate).eq('is_actual', true).then(r => (r.data ?? []) as KpiRow[]).catch(() => [] as KpiRow[]),
    supabase.from(view).select(select).gte('metric_date', sdlyFrom).lte('metric_date', sdlyTo).eq('is_actual', true).then(r => (r.data ?? []) as KpiRow[]).catch(() => [] as KpiRow[]),
  ]);

  const now  = reduce(nowRes,  input.metric);
  const sdly = reduce(sdlyRes, input.metric);
  const pct  = sdly > 0 ? ((now - sdly) / sdly) * 100 : 0;
  const rounded = Math.round(pct * 10) / 10;

  return {
    now,
    sdly,
    delta: {
      value: rounded,
      period: `vs SDLY (${sdlyFrom.slice(0, 7)} → ${sdlyTo.slice(0, 7)})`,
      direction: rounded > 0.5 ? 'up' : rounded < -0.5 ? 'down' : 'flat',
      isGoodWhenUp: input.isGoodWhenUp ?? isGoodWhenUpFor(input.metric),
    },
  };
}

/**
 * Batch helper — computes multiple metrics against the same period at once.
 * Reuses the same two view scans, so calling with 4 metrics still fires 2 queries.
 */
export async function computeSdlyDeltaBatch(
  base: Omit<SdlyInput, 'metric'>,
  metrics: SdlyMetric[],
): Promise<Record<string, SdlyResult>> {
  const view = base.view ?? 'v_kpi_daily';
  const sdlyFrom = shiftYear(base.fromDate, -1);
  const sdlyTo   = shiftYear(base.toDate,   -1);

  const supabase = getSupabaseAdmin();
  const select = 'rooms_available,rooms_sold,rooms_revenue,total_revenue,arrivals';

  const [nowRes, sdlyRes] = await Promise.all([
    supabase.from(view).select(select).gte('metric_date', base.fromDate).lte('metric_date', base.toDate).eq('is_actual', true).then(r => (r.data ?? []) as KpiRow[]).catch(() => [] as KpiRow[]),
    supabase.from(view).select(select).gte('metric_date', sdlyFrom).lte('metric_date', sdlyTo).eq('is_actual', true).then(r => (r.data ?? []) as KpiRow[]).catch(() => [] as KpiRow[]),
  ]);

  const out: Record<string, SdlyResult> = {};
  for (const m of metrics) {
    const now  = reduce(nowRes,  m);
    const sdly = reduce(sdlyRes, m);
    const pct  = sdly > 0 ? ((now - sdly) / sdly) * 100 : 0;
    const rounded = Math.round(pct * 10) / 10;
    out[m] = {
      now, sdly,
      delta: {
        value: rounded,
        period: `vs SDLY (${sdlyFrom.slice(0, 7)} → ${sdlyTo.slice(0, 7)})`,
        direction: rounded > 0.5 ? 'up' : rounded < -0.5 ? 'down' : 'flat',
        isGoodWhenUp: base.isGoodWhenUp ?? isGoodWhenUpFor(m),
      },
    };
  }
  return out;
}
