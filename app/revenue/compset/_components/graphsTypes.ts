// Shared types for CompsetGraphs.

export type CalendarRow = {
  stay_date: string;
  namkhan_usd: number | null;
  median_usd: number | null;
  min_usd: number | null;
  max_usd: number | null;
};

export type DowRow = {
  dow: number;
  dow_label: string;
  avg_namkhan_usd: number | null;
  avg_comp_median_usd: number | null;
  avg_comp_cheapest_usd: number | null;
  avg_comp_dearest_usd: number | null;
};

export type PromoTileRow = {
  comp_id: string;
  property_name: string;
  is_self: boolean;
  promo_frequency_pct: number | null;
};
