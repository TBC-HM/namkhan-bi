// lib/data-bdc.ts — Booking.com Analytics readers (2026-05-04)
// Backed by public.v_bdc_* proxy views over revenue.bdc_* (revenue schema not
// in pgrst.db_schemas). Each view filters to the latest snapshot_date.
//
// Source PDFs / CSV exported from Booking.com Extranet, loaded via migration
// load_bdc_2026_05_04_snapshots. Refresh cadence: manual upload every 1-2 weeks
// (no Booking.com API for these reports).

import { supabase } from './supabase';

export interface BdcCountryRow {
  country: string;
  my_reservation_pct: number | null;
  my_adr_usd: number | null;
  my_book_window_days: number | null;
  my_cancel_pct: number | null;
  my_los_nights: number | null;
  market_reservation_pct: number | null;
  market_adr_usd: number | null;
  market_book_window_days: number | null;
  market_cancel_pct: number | null;
  market_los_nights: number | null;
  share_delta_pp: number | null; // my - market (in pp)
}

export interface BdcBookWindowRow {
  window_label: string;
  sort_order: number;
  my_reservation_pct: number;
  my_adr_usd: number;
  compset_reservation_pct: number;
  compset_adr_usd: number;
  my_cancel_pct: number;
  compset_cancel_pct: number;
}

export interface BdcGeniusRow {
  period_month: string;
  bookings: number;
  bookings_last_year: number;
  genius_pct: number;
  genius_pct_last_year: number;
}

export interface BdcPaceMonthRow {
  stay_year_month: string;
  rn_current: number;
  rn_last_year: number;
  rn_diff_pct: number;
  revenue_current_usd: number;
  revenue_last_year_usd: number;
  revenue_diff_pct: number;
  adr_current_usd: number;
  adr_last_year_usd: number;
  adr_diff_pct: number;
}

export interface BdcRankingSnapshot {
  snapshot_date: string;
  search_views: number;
  page_views: number;
  bookings: number;
  search_to_page_pct: number;
  page_to_book_pct: number;
  search_score: number;
  search_score_max: number;
  better_than_pct_in_city: number;
  conversion_pct: number;
  area_avg_conversion_pct: number | null;
  cancel_pct: number;
  area_avg_cancel_pct: number;
  review_score: number;
  area_avg_review_score: number;
}

export interface BdcDemandRow {
  dimension: string;
  dim_value: string;
  sort_order: number;
  search_pct: number | null;
  my_reservation_pct: number | null;
}

const num = (x: any): number => (x == null ? 0 : Number(x));
const numOrNull = (x: any): number | null => (x == null ? null : Number(x));

export async function getBdcCountryInsights(limit = 12): Promise<BdcCountryRow[]> {
  const { data, error } = await supabase
    .from('v_bdc_country_insights')
    .select('*')
    .neq('country', '_ALL_')
    .order('my_reservation_pct', { ascending: false, nullsFirst: false })
    .limit(limit);
  if (error) {
    console.error('getBdcCountryInsights error', error);
    return [];
  }
  return ((data ?? []) as any[]).map((r) => {
    const my = numOrNull(r.my_reservation_pct);
    const mk = numOrNull(r.market_reservation_pct);
    return {
      country: String(r.country),
      my_reservation_pct: my,
      my_adr_usd: numOrNull(r.my_adr_usd),
      my_book_window_days: numOrNull(r.my_book_window_days),
      my_cancel_pct: numOrNull(r.my_cancel_pct),
      my_los_nights: numOrNull(r.my_los_nights),
      market_reservation_pct: mk,
      market_adr_usd: numOrNull(r.market_adr_usd),
      market_book_window_days: numOrNull(r.market_book_window_days),
      market_cancel_pct: numOrNull(r.market_cancel_pct),
      market_los_nights: numOrNull(r.market_los_nights),
      share_delta_pp: my != null && mk != null ? +(my - mk).toFixed(2) : null,
    };
  });
}

export async function getBdcBookWindowInsights(): Promise<BdcBookWindowRow[]> {
  const { data, error } = await supabase
    .from('v_bdc_book_window_insights')
    .select('*')
    .order('sort_order', { ascending: true });
  if (error) {
    console.error('getBdcBookWindowInsights error', error);
    return [];
  }
  return ((data ?? []) as any[]).map((r) => ({
    window_label: String(r.window_label),
    sort_order: Number(r.sort_order ?? 0),
    my_reservation_pct: num(r.my_reservation_pct),
    my_adr_usd: num(r.my_adr_usd),
    compset_reservation_pct: num(r.compset_reservation_pct),
    compset_adr_usd: num(r.compset_adr_usd),
    my_cancel_pct: num(r.my_cancel_pct),
    compset_cancel_pct: num(r.compset_cancel_pct),
  }));
}

export async function getBdcGeniusMonthly(): Promise<BdcGeniusRow[]> {
  const { data, error } = await supabase
    .from('v_bdc_genius_monthly')
    .select('*')
    .order('period_month', { ascending: true });
  if (error) {
    console.error('getBdcGeniusMonthly error', error);
    return [];
  }
  return ((data ?? []) as any[]).map((r) => ({
    period_month: String(r.period_month),
    bookings: Number(r.bookings ?? 0),
    bookings_last_year: Number(r.bookings_last_year ?? 0),
    genius_pct: num(r.genius_pct),
    genius_pct_last_year: num(r.genius_pct_last_year),
  }));
}

export async function getBdcPaceMonthly(): Promise<BdcPaceMonthRow[]> {
  const { data, error } = await supabase
    .from('v_bdc_pace_monthly')
    .select('*')
    .order('stay_year_month', { ascending: true });
  if (error) {
    console.error('getBdcPaceMonthly error', error);
    return [];
  }
  return ((data ?? []) as any[]).map((r) => ({
    stay_year_month: String(r.stay_year_month),
    rn_current: Number(r.rn_current ?? 0),
    rn_last_year: Number(r.rn_last_year ?? 0),
    rn_diff_pct: num(r.rn_diff_pct),
    revenue_current_usd: num(r.revenue_current_usd),
    revenue_last_year_usd: num(r.revenue_last_year_usd),
    revenue_diff_pct: num(r.revenue_diff_pct),
    adr_current_usd: num(r.adr_current_usd),
    adr_last_year_usd: num(r.adr_last_year_usd),
    adr_diff_pct: num(r.adr_diff_pct),
  }));
}

export async function getBdcRankingSnapshot(): Promise<BdcRankingSnapshot | null> {
  const { data, error } = await supabase
    .from('v_bdc_ranking_snapshot')
    .select('*')
    .limit(1)
    .maybeSingle();
  if (error || !data) {
    if (error) console.error('getBdcRankingSnapshot error', error);
    return null;
  }
  return {
    snapshot_date: String(data.snapshot_date),
    search_views: Number(data.search_views ?? 0),
    page_views: Number(data.page_views ?? 0),
    bookings: Number(data.bookings ?? 0),
    search_to_page_pct: num(data.search_to_page_pct),
    page_to_book_pct: num(data.page_to_book_pct),
    search_score: Number(data.search_score ?? 0),
    search_score_max: Number(data.search_score_max ?? 0),
    better_than_pct_in_city: num(data.better_than_pct_in_city),
    conversion_pct: num(data.conversion_pct),
    area_avg_conversion_pct: numOrNull(data.area_avg_conversion_pct),
    cancel_pct: num(data.cancel_pct),
    area_avg_cancel_pct: num(data.area_avg_cancel_pct),
    review_score: num(data.review_score),
    area_avg_review_score: num(data.area_avg_review_score),
  };
}

export async function getBdcDemandInsights(dimension?: string): Promise<BdcDemandRow[]> {
  let q = supabase.from('v_bdc_demand_insights').select('*');
  if (dimension) q = q.eq('dimension', dimension);
  const { data, error } = await q.order('sort_order', { ascending: true });
  if (error) {
    console.error('getBdcDemandInsights error', error);
    return [];
  }
  return ((data ?? []) as any[]).map((r) => ({
    dimension: String(r.dimension),
    dim_value: String(r.dim_value),
    sort_order: Number(r.sort_order ?? 0),
    search_pct: numOrNull(r.search_pct),
    my_reservation_pct: numOrNull(r.my_reservation_pct),
  }));
}

// Aggregate summary used by the hero strip on the BDC page.
export async function getBdcSnapshotMeta(): Promise<{
  snapshot_date: string | null;
  has_data: boolean;
}> {
  const { data, error } = await supabase
    .from('v_bdc_ranking_snapshot')
    .select('snapshot_date')
    .limit(1)
    .maybeSingle();
  if (error || !data) return { snapshot_date: null, has_data: false };
  return { snapshot_date: String(data.snapshot_date), has_data: true };
}
