/**
 * kpiTooltips.ts — canonical tooltip copy for every KPI across all dept pages.
 *
 * Keys follow the pattern  <page>.<metricKey>  so callers can do:
 *   import { tips } from '@/lib/kpiTooltips';
 *   <KpiTooltip tip={tips['sales.totalRevenue']}> … </KpiTooltip>
 *
 * Copy is intentionally brief (≤ 2 sentences) to fit the bubble comfortably.
 * PBS should review and adjust source-view names / formulas as needed.
 *
 * ── PLACEHOLDER NOTICE ──────────────────────────────────────────────────────
 * All copy below is auto-drafted from schema inference.  PBS must confirm
 * source view names, formula correctness, and currency conventions before
 * merge.  See ticket #593 blockers.
 * ────────────────────────────────────────────────────────────────────────────
 */

export const tips: Record<string, string> = {

  // ── /sales ────────────────────────────────────────────────────────────────
  'sales.totalRevenue':
    'Source: vw_sales_summary · Sum of confirmed booking revenue (excl. tax) for the selected date range. Currency: USD.',
  'sales.roomNights':
    'Source: vw_sales_summary · Count of occupied room-nights in the period. One stay of 3 nights = 3 room-nights.',
  'sales.adr':
    'Source: vw_sales_summary · Average Daily Rate = Total Room Revenue ÷ Room Nights Sold. Excludes complimentary rooms.',
  'sales.revPar':
    'Source: vw_sales_summary · RevPAR = Total Room Revenue ÷ Rooms Available. Null when availability data is missing.',
  'sales.occupancyRate':
    'Source: vw_sales_summary · Rooms Sold ÷ Rooms Available × 100. Calculated nightly then averaged over the period.',
  'sales.leadTime':
    'Source: bookings · Average days between booking creation date and check-in date for the period.',
  'sales.cancellationRate':
    'Source: bookings · Cancelled bookings ÷ Total bookings × 100 for the period. Includes same-day cancellations.',
  'sales.newBookings':
    'Source: bookings · Count of bookings with created_at within the selected range regardless of stay date.',

  // ── /marketing ────────────────────────────────────────────────────────────
  'marketing.impressions':
    'Source: vw_marketing_summary · Total ad impressions across all channels (Meta, Google, OTAs) in the period.',
  'marketing.clicks':
    'Source: vw_marketing_summary · Total link/ad clicks. CTR = Clicks ÷ Impressions is shown in the detail panel.',
  'marketing.spend':
    'Source: vw_marketing_summary · Gross marketing spend in USD across all paid channels. Excludes agency fees.',
  'marketing.cpa':
    'Source: vw_marketing_summary · Cost Per Acquisition = Total Spend ÷ Confirmed Bookings attributed to paid channels.',
  'marketing.roas':
    'Source: vw_marketing_summary · Return On Ad Spend = Attributed Revenue ÷ Ad Spend. Attribution window: 7-day click.',
  'marketing.emailOpenRate':
    'Source: vw_email_campaigns · Average open rate across all campaigns sent in the period. Excludes bounces.',
  'marketing.directBookings':
    'Source: bookings · Bookings with channel = \'direct\' or \'website\'. No OTA commission applied.',

  // ── /operations ───────────────────────────────────────────────────────────
  'operations.occupancy':
    'Source: vw_ops_summary · Same as sales occupancy — mirrored here for operational scheduling context.',
  'operations.checkIns':
    'Source: vw_ops_summary · Count of guest arrivals on each day in the selected range.',
  'operations.checkOuts':
    'Source: vw_ops_summary · Count of guest departures on each day in the selected range.',
  'operations.maintenanceOpen':
    'Source: maintenance_requests · Count of requests with status = \'open\' at end of period. Excludes resolved.',
  'operations.avgResolutionTime':
    'Source: maintenance_requests · Mean hours from request created_at to resolved_at. Null requests excluded.',
  'operations.housekeepingScore':
    'Source: vw_housekeeping · Average guest-scored cleanliness rating (1–5) from post-stay surveys in the period.',
  'operations.staffHours':
    'Source: staff_shifts · Total scheduled staff hours across all departments in the period.',

  // ── /finance ──────────────────────────────────────────────────────────────
  'finance.grossRevenue':
    'Source: vw_finance_summary · Total revenue before deductions — rooms + F&B + ancillary services.',
  'finance.netRevenue':
    'Source: vw_finance_summary · Gross Revenue minus OTA commissions, refunds, and discounts.',
  'finance.expenses':
    'Source: vw_finance_summary · Sum of all operating expenses posted in the accounting period.',
  'finance.gopPar':
    'Source: vw_finance_summary · Gross Operating Profit Per Available Room = GOP ÷ Rooms Available.',
  'finance.ebitda':
    'Source: vw_finance_summary · EBITDA = Net Revenue − Operating Expenses (excl. depreciation & interest).',
  'finance.payroll':
    'Source: payroll_entries · Total payroll cost (wages + benefits) for the period. In USD.',
  'finance.outstandingAr':
    'Source: accounts_receivable · Sum of unpaid invoices with due_date ≤ today. Ageing detail in Finance → AR.',
  'finance.taxCollected':
    'Source: vw_finance_summary · VAT + Tourism Levy collected from guests. Remitted monthly to revenue authority.',

  // ── /guest ────────────────────────────────────────────────────────────────
  'guest.satisfactionScore':
    'Source: vw_guest_feedback · Mean score across all post-stay survey responses (scale 1–10) in the period.',
  'guest.nps':
    'Source: vw_guest_feedback · Net Promoter Score = % Promoters (9–10) − % Detractors (0–6). Min 20 responses.',
  'guest.repeatRate':
    'Source: bookings + guests · Share of check-ins where the guest has a prior completed stay. Rolling 12 months.',
  'guest.avgLengthOfStay':
    'Source: bookings · Mean nights per completed stay in the period. Excludes same-day cancellations.',
  'guest.complaintsLogged':
    'Source: guest_issues · Count of issues with type = \'complaint\' opened in the period. Resolved shown in detail.',
  'guest.responseTime':
    'Source: guest_messages · Average minutes from guest message created_at to first staff reply_at. Channel: all.',
  'guest.totalGuests':
    'Source: bookings · Sum of adults + children across all checked-in stays in the period.',
};
