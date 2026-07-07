// app/revenue/lighthouse/_shared/data.ts
// PBS 2026-07-07: Data-fetch helpers for the Lighthouse dashboard.
// Reads `public.compset_lighthouse_*` tables via service-role client (server-only).
// Only ONE snapshot per (property_id, snapshot_date) is used — currently
// the latest available snapshot.

import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export type OverviewRow = {
  stay_date: string;
  day_name: string;
  flex_own: string | null;
  median_compset: number | null;
  compset_rank: string | null;
  my_otb_pct: number | null;
  market_demand_pct: number | null;
  bookingcom_ranking: string | null;
  holidays: string | null;
  events: string | null;
};

export type HotelCell = {
  hotel_name: string;
  is_own: boolean;
  rate_value: number | null;
  restriction: string | null;
};

export type RatesRow = {
  stay_date: string;
  day_name: string;
  my_otb_pct: number | null;
  market_demand_pct: number | null;
  cells: HotelCell[];
};

export type SnapshotMeta = {
  snapshot_date: string;
  hotels: { hotel_name: string; is_own: boolean; display_short: string | null }[];
};

const DOW = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
function dayName(iso: string): string {
  const d = new Date(iso + 'T00:00:00Z');
  return DOW[d.getUTCDay()] || '';
}

export async function getLatestSnapshotDate(propertyId: number): Promise<string | null> {
  const sb = getSupabaseAdmin();
  const { data, error } = await sb
    .from('compset_lighthouse_context')
    .select('snapshot_date')
    .eq('property_id', propertyId)
    .order('snapshot_date', { ascending: false })
    .limit(1);
  if (error || !data || data.length === 0) return null;
  return data[0].snapshot_date as string;
}

export async function getHotelOrder(
  propertyId: number,
): Promise<{ hotel_name: string; is_own: boolean; display_short: string | null }[]> {
  const sb = getSupabaseAdmin();
  const { data } = await sb
    .from('compset_lighthouse_hotels')
    .select('hotel_name, is_own, display_short, display_order')
    .eq('property_id', propertyId)
    .order('is_own', { ascending: false })
    .order('display_order', { ascending: true });
  return (data ?? []).map((r: any) => ({
    hotel_name: r.hotel_name,
    is_own: !!r.is_own,
    display_short: r.display_short,
  }));
}

export async function getOverviewRows(
  propertyId: number,
  snapshotDate: string,
): Promise<OverviewRow[]> {
  const sb = getSupabaseAdmin();
  const { data, error } = await sb
    .from('compset_lighthouse_context')
    .select('stay_date, flex_own, median_compset, compset_rank, my_otb_pct, market_demand_pct, bookingcom_ranking, holidays, events')
    .eq('property_id', propertyId)
    .eq('snapshot_date', snapshotDate)
    .order('stay_date', { ascending: true });
  if (error || !data) return [];
  return data.map((r: any) => ({
    stay_date: r.stay_date,
    day_name: dayName(r.stay_date),
    flex_own: r.flex_own,
    median_compset: r.median_compset === null ? null : Number(r.median_compset),
    compset_rank: r.compset_rank,
    my_otb_pct: r.my_otb_pct === null ? null : Number(r.my_otb_pct),
    market_demand_pct: r.market_demand_pct === null ? null : Number(r.market_demand_pct),
    bookingcom_ranking: r.bookingcom_ranking,
    holidays: r.holidays,
    events: r.events,
  }));
}

export async function getRatesRows(
  propertyId: number,
  snapshotDate: string,
): Promise<{ rows: RatesRow[]; hotels: SnapshotMeta['hotels'] }> {
  const sb = getSupabaseAdmin();
  const hotels = await getHotelOrder(propertyId);
  const [ctxRes, dailyRes] = await Promise.all([
    sb.from('compset_lighthouse_context')
      .select('stay_date, my_otb_pct, market_demand_pct')
      .eq('property_id', propertyId).eq('snapshot_date', snapshotDate)
      .order('stay_date', { ascending: true }),
    sb.from('compset_lighthouse_daily')
      .select('stay_date, competitor_hotel, is_own_hotel, rate_value, restriction')
      .eq('property_id', propertyId).eq('snapshot_date', snapshotDate)
      .order('stay_date', { ascending: true }),
  ]);
  const ctxByDate = new Map<string, any>();
  (ctxRes.data ?? []).forEach((r: any) => ctxByDate.set(r.stay_date, r));
  const cellsByDate = new Map<string, HotelCell[]>();
  (dailyRes.data ?? []).forEach((r: any) => {
    const arr = cellsByDate.get(r.stay_date) ?? [];
    arr.push({
      hotel_name: r.competitor_hotel,
      is_own: !!r.is_own_hotel,
      rate_value: r.rate_value === null ? null : Number(r.rate_value),
      restriction: r.restriction,
    });
    cellsByDate.set(r.stay_date, arr);
  });
  const dates = Array.from(cellsByDate.keys()).sort();
  const rows: RatesRow[] = dates.map((d) => {
    const ctx = ctxByDate.get(d) ?? {};
    const cellsMap = new Map<string, HotelCell>();
    (cellsByDate.get(d) ?? []).forEach((c) => cellsMap.set(c.hotel_name, c));
    const orderedCells = hotels.map((h) => cellsMap.get(h.hotel_name) ?? {
      hotel_name: h.hotel_name, is_own: h.is_own, rate_value: null, restriction: null,
    });
    return {
      stay_date: d,
      day_name: dayName(d),
      my_otb_pct: ctx.my_otb_pct === null || ctx.my_otb_pct === undefined ? null : Number(ctx.my_otb_pct),
      market_demand_pct: ctx.market_demand_pct === null || ctx.market_demand_pct === undefined ? null : Number(ctx.market_demand_pct),
      cells: orderedCells,
    };
  });
  return { rows, hotels };
}

/**
 * Compare current snapshot vs an earlier snapshot N days ago.
 * Returns rates rows for the CURRENT snapshot plus per-cell deltas
 * (delta_rate = current.rate_value - earlier.rate_value; null when either side is a restriction/missing).
 */
export type DeltaCell = HotelCell & { delta_rate: number | null };
export type DeltaRow = Omit<RatesRow, 'cells'> & {
  cells: DeltaCell[];
  delta_otb: number | null;
  delta_demand: number | null;
};

export async function getDeltaRows(
  propertyId: number,
  currentSnapshot: string,
  daysBack: number,
): Promise<{
  rows: DeltaRow[];
  hotels: SnapshotMeta['hotels'];
  earlierSnapshot: string | null;
}> {
  const sb = getSupabaseAdmin();
  const cur = new Date(currentSnapshot + 'T00:00:00Z');
  const back = new Date(cur.getTime() - daysBack * 86400000);
  const earlierIso = back.toISOString().slice(0, 10);
  const { data: earlierMatch } = await sb
    .from('compset_lighthouse_context')
    .select('snapshot_date')
    .eq('property_id', propertyId)
    .eq('snapshot_date', earlierIso)
    .limit(1);
  const earlierExists = (earlierMatch ?? []).length > 0;

  const { rows: current, hotels } = await getRatesRows(propertyId, currentSnapshot);
  let earlierCells: Map<string, Map<string, HotelCell>> = new Map();
  let earlierCtx: Map<string, { my_otb_pct: number | null; market_demand_pct: number | null }> = new Map();
  if (earlierExists) {
    const { rows: earlier } = await getRatesRows(propertyId, earlierIso);
    earlier.forEach((r) => {
      const m = new Map<string, HotelCell>();
      r.cells.forEach((c) => m.set(c.hotel_name, c));
      earlierCells.set(r.stay_date, m);
      earlierCtx.set(r.stay_date, { my_otb_pct: r.my_otb_pct, market_demand_pct: r.market_demand_pct });
    });
  }

  const rows: DeltaRow[] = current.map((r) => {
    const earlierMap = earlierCells.get(r.stay_date);
    const earlierCtxRow = earlierCtx.get(r.stay_date);
    const cells: DeltaCell[] = r.cells.map((c) => {
      const e = earlierMap?.get(c.hotel_name);
      const delta_rate = (c.rate_value !== null && e?.rate_value !== null && e?.rate_value !== undefined)
        ? Number((c.rate_value! - (e!.rate_value as number)).toFixed(2))
        : null;
      return { ...c, delta_rate };
    });
    const delta_otb = (r.my_otb_pct !== null && earlierCtxRow?.my_otb_pct !== null && earlierCtxRow?.my_otb_pct !== undefined)
      ? Number((r.my_otb_pct! - (earlierCtxRow!.my_otb_pct as number)).toFixed(4))
      : null;
    const delta_demand = (r.market_demand_pct !== null && earlierCtxRow?.market_demand_pct !== null && earlierCtxRow?.market_demand_pct !== undefined)
      ? Number((r.market_demand_pct! - (earlierCtxRow!.market_demand_pct as number)).toFixed(4))
      : null;
    return { ...r, cells, delta_otb, delta_demand };
  });
  return { rows, hotels, earlierSnapshot: earlierExists ? earlierIso : null };
}
