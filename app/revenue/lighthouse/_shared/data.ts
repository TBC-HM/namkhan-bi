// app/revenue/lighthouse/_shared/data.ts
// PBS 2026-07-07: Reads canonical `revenue.lighthouse_rateshop` via public bridge views.
// Multi-tenant: propertyId comes from the caller (260955 Namkhan, 1000001 Donna).

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

export type HotelMeta = { hotel_name: string; is_own: boolean; display_short: string | null };

const DOW = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
function dayName(iso: string): string {
  const d = new Date(iso + 'T00:00:00Z');
  return DOW[d.getUTCDay()] || '';
}

export async function getLatestSnapshotDate(propertyId: number): Promise<string | null> {
  const sb = getSupabaseAdmin();
  const { data } = await sb
    .from('v_lighthouse_rateshop')
    .select('shop_date')
    .eq('property_id', propertyId)
    .order('shop_date', { ascending: false })
    .limit(1);
  if (!data || data.length === 0) return null;
  return data[0].shop_date as string;
}

export async function getHotelOrder(propertyId: number): Promise<HotelMeta[]> {
  const sb = getSupabaseAdmin();
  const { data } = await sb
    .from('v_lighthouse_hotels_ordered')
    .select('lighthouse_name, is_self, display_short, display_order')
    .eq('property_id', propertyId)
    .order('display_order', { ascending: true });
  return (data ?? []).map((r: any) => ({
    hotel_name: r.lighthouse_name,
    is_own: !!r.is_self,
    display_short: r.display_short,
  }));
}

/** Own rate-row column: `bar_rate` OR raw restriction. */
function ownStatus(bar_rate: number | null, rate_status_raw: string | null): string | null {
  if (bar_rate !== null && bar_rate !== undefined) return String(Math.round(bar_rate));
  return rate_status_raw ?? null;
}

export async function getOverviewRows(
  propertyId: number,
  snapshotDate: string,
): Promise<OverviewRow[]> {
  const sb = getSupabaseAdmin();
  const { data } = await sb
    .from('v_lighthouse_rateshop')
    .select('stay_date, is_self, bar_rate, rate_status_raw, median_compset, compset_rank, ota_ranking, market_demand, holidays, events')
    .eq('property_id', propertyId)
    .eq('shop_date', snapshotDate)
    .eq('is_self', true)  // own row carries all context values
    .order('stay_date', { ascending: true });
  if (!data) return [];
  return data.map((r: any) => ({
    stay_date: r.stay_date,
    day_name: dayName(r.stay_date),
    flex_own: ownStatus(r.bar_rate === null ? null : Number(r.bar_rate), r.rate_status_raw),
    median_compset: r.median_compset === null ? null : Number(r.median_compset),
    compset_rank: r.compset_rank,
    my_otb_pct: null,  // sample xlsx doesn't carry my_otb — future ingestion may add
    market_demand_pct: r.market_demand === null ? null : Number(r.market_demand),
    bookingcom_ranking: r.ota_ranking,
    holidays: r.holidays,
    events: r.events,
  }));
}

export async function getRatesRows(
  propertyId: number,
  snapshotDate: string,
): Promise<{ rows: RatesRow[]; hotels: HotelMeta[] }> {
  const sb = getSupabaseAdmin();
  const hotels = await getHotelOrder(propertyId);
  const { data } = await sb
    .from('v_lighthouse_rateshop')
    .select('stay_date, hotel_name, is_self, bar_rate, rate_status_raw, market_demand')
    .eq('property_id', propertyId)
    .eq('shop_date', snapshotDate)
    .order('stay_date', { ascending: true });

  const cellsByDate = new Map<string, HotelCell[]>();
  const demandByDate = new Map<string, number | null>();

  (data ?? []).forEach((r: any) => {
    if (!demandByDate.has(r.stay_date))
      demandByDate.set(r.stay_date, r.market_demand === null ? null : Number(r.market_demand));
    const arr = cellsByDate.get(r.stay_date) ?? [];
    arr.push({
      hotel_name: r.hotel_name,
      is_own: !!r.is_self,
      rate_value: r.bar_rate === null ? null : Number(r.bar_rate),
      restriction: r.rate_status_raw,
    });
    cellsByDate.set(r.stay_date, arr);
  });

  const dates = Array.from(cellsByDate.keys()).sort();
  const rows: RatesRow[] = dates.map((d) => {
    const cellsMap = new Map<string, HotelCell>();
    (cellsByDate.get(d) ?? []).forEach((c) => cellsMap.set(c.hotel_name, c));
    const orderedCells = hotels.map((h) => cellsMap.get(h.hotel_name) ?? {
      hotel_name: h.hotel_name, is_own: h.is_own, rate_value: null, restriction: null,
    });
    return {
      stay_date: d,
      day_name: dayName(d),
      my_otb_pct: null,
      market_demand_pct: demandByDate.get(d) ?? null,
      cells: orderedCells,
    };
  });
  return { rows, hotels };
}

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
): Promise<{ rows: DeltaRow[]; hotels: HotelMeta[]; earlierSnapshot: string | null }> {
  const sb = getSupabaseAdmin();
  const cur = new Date(currentSnapshot + 'T00:00:00Z');
  const back = new Date(cur.getTime() - daysBack * 86400000);
  const earlierIso = back.toISOString().slice(0, 10);

  const { data: earlierProbe } = await sb
    .from('v_lighthouse_rateshop')
    .select('shop_date')
    .eq('property_id', propertyId)
    .eq('shop_date', earlierIso)
    .limit(1);
  const earlierExists = (earlierProbe ?? []).length > 0;

  const { rows: current, hotels } = await getRatesRows(propertyId, currentSnapshot);
  const earlierByDate = new Map<string, Map<string, HotelCell>>();
  const earlierDemand = new Map<string, number | null>();

  if (earlierExists) {
    const { rows: earlier } = await getRatesRows(propertyId, earlierIso);
    earlier.forEach((r) => {
      const m = new Map<string, HotelCell>();
      r.cells.forEach((c) => m.set(c.hotel_name, c));
      earlierByDate.set(r.stay_date, m);
      earlierDemand.set(r.stay_date, r.market_demand_pct);
    });
  }

  const rows: DeltaRow[] = current.map((r) => {
    const em = earlierByDate.get(r.stay_date);
    const ed = earlierDemand.get(r.stay_date);
    const cells: DeltaCell[] = r.cells.map((c) => {
      const e = em?.get(c.hotel_name);
      const delta_rate = (c.rate_value !== null && e?.rate_value !== null && e?.rate_value !== undefined)
        ? Number((c.rate_value - (e.rate_value as number)).toFixed(2))
        : null;
      return { ...c, delta_rate };
    });
    const delta_demand = (r.market_demand_pct !== null && ed !== null && ed !== undefined)
      ? Number((r.market_demand_pct - (ed as number)).toFixed(4))
      : null;
    return { ...r, cells, delta_otb: null, delta_demand };
  });
  return { rows, hotels, earlierSnapshot: earlierExists ? earlierIso : null };
}
