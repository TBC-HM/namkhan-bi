// lib/cb-reports.ts
// Single catalog of Cloudbeds stock reports, shared by the two surfaces that list them:
//   Administration › Reports   (all of them)      app/h/[property_id]/admin/reports
//   Revenue › RevReports       (revenue subset)   app/h/[property_id]/revenue/revreports
// Extracted 2026-09-06 so the two pages cannot drift apart.
//
// PBS 2026-09-06 — BUILT FROM THE LIVE CLOUDBEDS CATALOG, NOT BY HAND.
// The original version of this file was hand-written from guessed report names and was
// wrong twice over: 15 of its 50 ids did not exist in this account (all 404'd on sync),
// and several ids that do exist had the wrong title. Every label below is copied
// verbatim from the API, so the label on the page is the label in Cloudbeds.
//
// Source of truth (all 174 reports this account can see, 25 per page — limit=200 is
// rejected):
//   GET https://api.cloudbeds.com/datainsights/v1.1/stock_reports?limit=25&offset=N
//   Authorization: Bearer <CLOUDBEDS_API_KEY>   X-PROPERTY-ID: <property_id>
// See docs/19_CLOUDBEDS_INSIGHTS_API.md.

export interface KnownReport {
  label: string;
  category: string;
}

// ── Revenue management ───────────────────────────────────────────────────────
// PBS 2026-09-06: "in revenue area i want you to pull all" — so this is every
// revenue-management report in the Cloudbeds catalog, not a hand-picked shortlist.
// Sub-categorised (Revenue / Occupancy / Pace / Channels / Booking / Ancillary) because
// 74 rows under one "Revenue" label is not scannable; the category filter does the work.
//
// Deliberately excluded as Administration/Finance rather than revenue: transactions by
// service date (209, 217), taxes and fees (218), payment methods (283), outstanding
// balances (131), posted transactions for cancelled reservations (285), revenue/taxes
// review by reservation number (298), transactions review (307), out-of-service rooms
// (107, operational), and the marketing opt-in list (40).
const REVENUE_CATALOG: Record<number, KnownReport> = {
  3: { label: 'Total Revenue by Month by Room Type', category: 'Revenue' },
  11: { label: 'Room Revenue by Rate Plan', category: 'Revenue' },
  22: { label: 'Room Revenue by Reservation Source', category: 'Revenue' },
  23: { label: 'Room Revenue by Rate Plan and Room Type', category: 'Revenue' },
  74: { label: 'Daily Revenue Report', category: 'Revenue' },
  159: { label: 'Revenue by Reservation Source', category: 'Revenue' },
  167: { label: 'Room Rate Report', category: 'Revenue' },
  173: { label: 'Average Rate per Room Type And Reservation Source', category: 'Revenue' },
  181: { label: 'Revenue by Benchmarking Category', category: 'Revenue' },
  190: { label: 'Revenue by Benchmarking Category - Service Date', category: 'Revenue' },
  194: { label: 'Daily Revenue Report by Benchmarking Transaction Type', category: 'Revenue' },
  215: { label: 'Total Room Revenue', category: 'Revenue' },
  219: { label: 'Group Total Room Revenue by Reservation Source', category: 'Revenue' },
  222: { label: 'Revenue Comparison by Reservation Source - YOY', category: 'Revenue' },
  223: { label: 'Revenue Comparison - YOY', category: 'Revenue' },
  238: { label: 'Revenue by Market Group and Segment - Service Date', category: 'Revenue' },
  239: { label: 'Revenue by Market Group and Segment', category: 'Revenue' },
  241: { label: 'Revenue Comparison by Market Group and Segment - YOY', category: 'Revenue' },
  250: { label: 'Total Revenue Per Guest', category: 'Revenue' },
  273: { label: 'Group Rooms Sold and Revenue Metrics', category: 'Revenue' },
  277: { label: 'Revenue by Transaction Code', category: 'Revenue' },
  292: { label: 'Revenue Comparison - YOY by Month', category: 'Revenue' },
  294: { label: 'Daily Revenue Report by Reservation Source', category: 'Revenue' },
  303: { label: 'Revenue By Space', category: 'Revenue' },
  313: { label: 'Total Room Revenue By Group and Source', category: 'Revenue' },
  314: { label: 'Total Room Revenue by Market Group, Segment, Reservation Source', category: 'Revenue' },

  97: { label: 'Occupancy History and Forecast', category: 'Occupancy' },
  101: { label: 'Occupancy by Room Type', category: 'Occupancy' },
  102: { label: 'Occupancy and Room Revenue Comparison - YOY by Month', category: 'Occupancy' },
  104: { label: 'Occupancy History and Forecast by Room Type', category: 'Occupancy' },
  105: { label: 'Occupancy Statistics', category: 'Occupancy' },
  106: { label: 'Occupancy Statistics by Room Type', category: 'Occupancy' },
  110: { label: 'Rooms Sold, ADR, RevPar and Occupancy', category: 'Occupancy' },
  155: { label: 'Rooms Sold, ADR, RevPar and Occupancy by Month', category: 'Occupancy' },
  160: { label: 'Rooms Sold Statistics by Room Type', category: 'Occupancy' },
  188: { label: 'Occupancy History and Forecast By Room Type and Reservation Source', category: 'Occupancy' },
  206: { label: 'Group Occupancy Statistics', category: 'Occupancy' },
  227: { label: 'Occupancy Statistics by Room Type and Room Number', category: 'Occupancy' },
  271: { label: 'Group Occupancy Statistics - Years Comparison', category: 'Occupancy' },
  290: { label: 'Rooms Sold by Market Group and Segment - Day, MTD, YTD', category: 'Occupancy' },
  296: { label: 'Rooms Sold by Market Group and Segment', category: 'Occupancy' },

  79: { label: 'In-House 14 Day Forecast', category: 'Pace' },
  96: { label: 'Pace Report', category: 'Pace' },
  279: { label: 'Pickup Room Detail', category: 'Pace' },
  280: { label: 'Pickup Summary', category: 'Pace' },
  287: { label: 'Pace - YOY Change', category: 'Pace' },

  32: { label: 'Channel Performance Summary', category: 'Channels' },
  34: { label: 'Production by Guest Country', category: 'Channels' },
  140: { label: 'Channel Performance Summary by Month', category: 'Channels' },
  191: { label: 'Channel Production', category: 'Channels' },
  224: { label: 'Reservations by Reservation Source and Rate Plans', category: 'Channels' },
  240: { label: 'Reservations by Market Group and Segment', category: 'Channels' },
  265: { label: 'Reservations by Reservation Source and Origin', category: 'Channels' },
  272: { label: 'Channel Production with Chart', category: 'Channels' },
  289: { label: 'Channel Production - MTD, YTD', category: 'Channels' },
  308: { label: 'Booking Engine Metrics', category: 'Channels' },
  310: { label: 'Channel Production Comparison - YOY by Month', category: 'Channels' },

  17: { label: 'Reservations by Booking Date', category: 'Booking' },
  24: { label: 'Canceled Reservations', category: 'Booking' },
  28: { label: 'No-Show Reservations', category: 'Booking' },
  33: { label: 'Reservations by Rate Plan', category: 'Booking' },
  86: { label: 'Average Booking Window & Length of Stay by Reservation Source', category: 'Booking' },
  100: { label: 'Guest Count', category: 'Booking' },
  117: { label: 'Cancellations by Reservation Source', category: 'Booking' },
  157: { label: 'No-Show Reservations by Reservation Source', category: 'Booking' },
  186: { label: 'Average Booking Window & Length of Stay by Reservation Source and Room Type', category: 'Booking' },
  281: { label: 'Group Booking Details', category: 'Booking' },
  295: { label: 'Booking Window Analysis', category: 'Booking' },

  39: { label: 'Items and Services Sold Pivot Table - YTD by Month', category: 'Ancillary' },
  68: { label: 'Breakfast Report by Rate Plan', category: 'Ancillary' },
  69: { label: 'Breakfast Report by Add on', category: 'Ancillary' },
  77: { label: 'Add-ons, Items, and Services Sold', category: 'Ancillary' },
  145: { label: 'Add-ons, Items, and Services Sold Overview by Category', category: 'Ancillary' },
  213: { label: 'Add-Ons, Items, and Services Sold Per Reservation Checking in Current Week', category: 'Ancillary' },
};

// ── Administration-only ──────────────────────────────────────────────────────
// Ledgers, reconciliations, invoices, housekeeping and guest lists. These appear on
// Administration › Reports and are deliberately absent from RevReports.
const ADMIN_CATALOG: Record<number, KnownReport> = {
  58: { label: 'Invoices and Credit Notes', category: 'Finance' },
  59: { label: 'Invoices and Credit Notes Report with Details', category: 'Finance' },
  60: { label: 'Credit Notes Report', category: 'Finance' },
  61: { label: 'Cashier Report', category: 'Finance' },
  63: { label: 'Prepayment List with Payment Details', category: 'Finance' },
  76: { label: 'Point of Sale Reconciliation', category: 'Finance' },
  78: { label: 'Taxes and Fees - Day, MTD, YTD', category: 'Finance' },
  83: { label: 'Payment Reconciliation', category: 'Finance' },
  84: { label: 'User Reconciliation', category: 'Finance' },
  90: { label: 'Group Invoices and Credit Notes', category: 'Finance' },
  91: { label: 'Group Credit Notes Report', category: 'Finance' },
  92: { label: 'Group Invoices and Credit Notes Report with Details', category: 'Finance' },
  168: { label: 'Voids, Adjustments and Refunds Review', category: 'Finance' },

  304: { label: 'Transactions by Trial Balance ID and Custom Transaction Code', category: 'Ledger' },
  305: { label: 'Transactions by Trial Balance ID and Custom General Ledger Code', category: 'Ledger' },
  306: { label: 'Deposit Ledger with Transaction Details', category: 'Ledger' },
  309: { label: 'Accounts Receivable (AR) Ledger with Transaction Details', category: 'Ledger' },
  311: { label: 'Current Ledger with Transaction Details', category: 'Ledger' },

  38: { label: 'Expanded Transaction Report with Details', category: 'Transactions' },
  89: { label: 'Group Reservations & Folios Transaction Report', category: 'Transactions' },

  75: { label: 'In-House Guests', category: 'Operations' },
  93: { label: 'Housekeeping Summary', category: 'Operations' },
  94: { label: 'Housekeeping Details', category: 'Operations' },
  95: { label: 'Group Rooming List', category: 'Operations' },

  40: { label: 'Guests Marketing Email Opt-in List', category: 'Guests' },
};

export const KNOWN_REPORTS: Record<number, KnownReport> = { ...REVENUE_CATALOG, ...ADMIN_CATALOG };

/**
 * PBS 2026-09-06: the seven that earn a star — pinned to the top of the RevReports table.
 *
 * Chosen on evidence, not on how the report sounds. Two rules applied:
 *
 *  1. It must not duplicate something we already compute BETTER. Booking window, LOS and
 *     guest-country production are all on Revenue › Markets already, cross-tabbed by
 *     country, room type and stay month (v_country_lead_stack, v_country_los_distribution,
 *     v_country_revenue_share) — richer than the Cloudbeds equivalents (86, 186, 295, 34),
 *     so those are not starred. Same for occupancy/RevPAR: ours works, report 110's does
 *     not (its saved filter zeroes capacity_count — see docs/19 §7c).
 *
 *  2. It must actually have data here. Market group & segment reads well on paper but
 *     Namkhan barely populates the dimension in Cloudbeds: report 239 returns 5 rows, 238
 *     returns 2, 240 returns 1. Starring those would be starring blanks.
 *
 * Row counts below are from the 2026-09-06 sync.
 */
export const STARRED_REPORT_IDS: number[] = [
  74,   // Daily Revenue Report (613) — the topline, and the one already parsed into
        //   insights.daily_revenue_cb -> v_monthly_revenue_cb. The anchor.
  145,  // Add-ons, Items and Services Sold Overview by Category (7,241) — ancillary
        //   capture by category. The ops-manager KPI the 2026 budget is built on.
  77,   // Add-ons, Items and Services Sold (5,312) — the line-level detail behind 145.
  39,   // Items and Services Sold Pivot, YTD by Month (601) — the ancillary trend.
  294,  // Daily Revenue Report by Reservation Source (2,209) — daily revenue x source.
        //   Finer than v_channel_performance_monthly, which is monthly.
  194,  // Daily Revenue by Benchmarking Transaction Type (621) — Cloudbeds' own
        //   benchmark taxonomy. We have no equivalent; genuinely additive.
  96,   // Pace Report (365) — an independent forward-pace read. Worth keeping as a
        //   cross-check on v_pace_curve, which has already been wrong once
        //   (fix_v_pace_curve_budget_double_count).
];

export const isStarred = (id: number): boolean => STARRED_REPORT_IDS.includes(id);

/** Every revenue-management report in the Cloudbeds catalog. */
export const REVENUE_REPORT_IDS: number[] = Object.keys(REVENUE_CATALOG).map(Number);

export const REVENUE_REPORTS: Record<number, KnownReport> = REVENUE_CATALOG;
