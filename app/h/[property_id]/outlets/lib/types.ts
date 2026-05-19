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
  [outlet: string]: string | number;
}

export interface OutletsSnapshot {
  // ─── currently wired (real data) ───────────────────────────────────────
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
  // ─── partially wired: food/beverage split via subdept ──────────────────
  foodRevMtd: number;
  bevRevMtd: number;
  minibarRevMtd: number;
  // ─── placeholders (always 0 until pair-Claude ships the bridge view) ───
  // Operating snapshot row
  fnbPerOccRn: number;        // needs mv_kpi_daily.rooms_sold + outlet rev
  capturePct: number;         // needs new view: v_fnb_capture_daily
  staffCanteenUsd: number;    // needs new view: v_staff_canteen_monthly
  canteenPerOccRn: number;    // derived from above
  // USALI effective row
  breakfastAllocUsd: number;  // needs new view: v_breakfast_allocation_monthly
  effectiveFnbRev: number;    // derived: fb rev + breakfast alloc
  effectiveGopUsd: number;    // needs new view: v_dept_pl_monthly
  effectiveGopPct: number;    // derived
  effLaborPct: number;        // needs v_dept_pl_monthly.payroll
  effFoodPct: number;         // needs v_dept_pl_monthly.food_cost
  // Sections / tables
  monthlyTrend: MonthlyTrendRow[];     // empty until v_dept_pl_monthly bridges
  pnlMonthlyRollup: PnlMonthlyRow[];   // empty until v_dept_pl_monthly bridges
  topSellerTrend: TopSellerTrendRow[]; // empty until v_fnb_top_seller_trend_monthly bridges
  glDetail: GlDetailRow[];             // empty until v_fnb_gl_breakdown_monthly bridges
  posTransactions: PosTxnRow[];        // empty until v_fnb_pos_transactions bridges
}

// Placeholder row shapes — defined so the View has typed empty arrays today.
// Wire-later steps just need to populate these arrays.

export interface MonthlyTrendRow {
  month: string;       // ISO (first of month)
  revenue: number;
  total_cost: number;
  gop_pct: number;
}

export interface PnlMonthlyRow {
  month: string;
  revenue: number;
  food_cost: number;
  bev_cost: number;
  payroll: number;
  total_cost: number;
  gop: number;
  food_cost_pct: number;
  bev_cost_pct: number;
  labor_cost_pct: number;
  gop_pct: number;
}

export interface TopSellerTrendRow {
  month: string;
  item: string;
  units_sold: number;
  revenue: number;
}

export interface GlDetailRow {
  month: string;
  account: string;
  amount: number;
  account_class: string | null;
}

export interface PosTxnRow {
  txn_at: string;        // ISO datetime
  outlet: string;
  item: string;
  qty: number;
  amount: number;
  cover_ref: string | null;
}
