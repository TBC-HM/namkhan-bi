// Row shapes from public bridge views (migration 009h).

export interface OutletDailyRow {
  property_id: number;
  revenue_date: string;          // ISO
  outlet: string;
  subdept: string | null;
  meal_period: string | null;
  line_count: number;
  covers_reservation_distinct: number;
  revenue: number;
}

export interface OutletMixRow {
  property_id: number;
  month: string;                  // ISO date (first of month)
  outlet: string;
  item: string;
  units_sold: number;
  revenue: number;
  avg_unit_price: number;
  check_count: number;
  avg_check: number;
}

export interface ByOutletAgg {
  outlet: string;
  revenue: number;
  covers: number;
  avg_check: number;
}

export interface DailyByOutletPivot {
  revenue_date: string;
  total: number;
  // … plus one column per outlet — keyed at runtime
  [outlet: string]: string | number;
}

export interface OutletsSnapshot {
  mtdRevenue: number;
  mtdCovers: number;
  mtdAvgCheck: number;
  topOutlet: { name: string; revenue: number } | null;
  byOutlet: ByOutletAgg[];
  dailyByOutlet: DailyByOutletPivot[];
  outletKeys: string[];
  topProducts: OutletMixRow[];
  productCount: number;
  hasData: boolean;
  daysCovered: number;
  rangeFromIso: string;
  rangeToIso: string;
  monthLabel: string;
}
