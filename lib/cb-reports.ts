// lib/cb-reports.ts
// Single catalog of Cloudbeds stock reports, shared by the two surfaces that list them:
//   Administration › Reports   (all of them)      app/h/[property_id]/admin/reports
//   Revenue › RevReports       (revenue subset)   app/h/[property_id]/revenue/revreports
// Extracted 2026-09-06 so the two pages cannot drift apart.
//
// PBS 2026-09-06 — REBUILT FROM THE LIVE CLOUDBEDS CATALOG.
// The first version of this file was hand-written from guessed report names. It was
// wrong twice over: 15 of its 50 ids do not exist in this Cloudbeds account (every one
// of them 404'd on sync), and many of the ids that DO exist had the wrong title — 40 is
// a marketing opt-in list, not a folio report; 79 is a 14-day forecast, not "Revenue by
// Channel"; 95 is a group rooming list, not "Future Revenue on Books". Titles below are
// now copied verbatim from the API, so the label on the page is the label in Cloudbeds.
//
// Source of truth (returns all 174 reports this account can see, 25 per page):
//   GET https://api.cloudbeds.com/datainsights/v1.1/stock_reports?limit=25&offset=N
//   Authorization: Bearer <CLOUDBEDS_API_KEY>   X-PROPERTY-ID: <property_id>
// See docs/19_CLOUDBEDS_INSIGHTS_API.md. This file lists the 35 reports the two pages
// surface; the other 139 are real and syncable but deliberately not listed — adding one
// is a one-line change once someone decides it earns a row.

export interface KnownReport {
  label: string;
  category: string;
}

export const KNOWN_REPORTS: Record<number, KnownReport> = {
  // ── Revenue ──────────────────────────────────────────────────────────────
  74:  { label: 'Daily Revenue Report',                                          category: 'Revenue'      },
  77:  { label: 'Add-ons, Items, and Services Sold',                             category: 'Revenue'      },
  79:  { label: 'In-House 14 Day Forecast',                                      category: 'Revenue'      },
  86:  { label: 'Average Booking Window & Length of Stay by Reservation Source', category: 'Revenue'      },
  96:  { label: 'Pace Report',                                                   category: 'Revenue'      },
  100: { label: 'Guest Count',                                                   category: 'Revenue'      },
  101: { label: 'Occupancy by Room Type',                                        category: 'Revenue'      },
  102: { label: 'Occupancy and Room Revenue Comparison - YOY by Month',          category: 'Revenue'      },
  110: { label: 'Rooms Sold, ADR, RevPar and Occupancy',                         category: 'Revenue'      },
  // ── Finance ──────────────────────────────────────────────────────────────
  58:  { label: 'Invoices and Credit Notes',                                     category: 'Finance'      },
  59:  { label: 'Invoices and Credit Notes Report with Details',                 category: 'Finance'      },
  60:  { label: 'Credit Notes Report',                                           category: 'Finance'      },
  61:  { label: 'Cashier Report',                                                category: 'Finance'      },
  63:  { label: 'Prepayment List with Payment Details',                          category: 'Finance'      },
  76:  { label: 'Point of Sale Reconciliation',                                  category: 'Finance'      },
  78:  { label: 'Taxes and Fees - Day, MTD, YTD',                                category: 'Finance'      },
  83:  { label: 'Payment Reconciliation',                                        category: 'Finance'      },
  84:  { label: 'User Reconciliation',                                           category: 'Finance'      },
  90:  { label: 'Group Invoices and Credit Notes',                               category: 'Finance'      },
  91:  { label: 'Group Credit Notes Report',                                     category: 'Finance'      },
  92:  { label: 'Group Invoices and Credit Notes Report with Details',           category: 'Finance'      },
  168: { label: 'Voids, Adjustments and Refunds Review',                         category: 'Finance'      },
  // ── Ledger ───────────────────────────────────────────────────────────────
  304: { label: 'Transactions by Trial Balance ID and Custom Transaction Code',  category: 'Ledger'       },
  305: { label: 'Transactions by Trial Balance ID and Custom General Ledger Code', category: 'Ledger'     },
  306: { label: 'Deposit Ledger with Transaction Details',                       category: 'Ledger'       },
  309: { label: 'Accounts Receivable (AR) Ledger with Transaction Details',      category: 'Ledger'       },
  311: { label: 'Current Ledger with Transaction Details',                       category: 'Ledger'       },
  // ── Transactions ─────────────────────────────────────────────────────────
  38:  { label: 'Expanded Transaction Report with Details',                      category: 'Transactions' },
  39:  { label: 'Items and Services Sold Pivot Table - YTD by Month',            category: 'Transactions' },
  89:  { label: 'Group Reservations & Folios Transaction Report',                category: 'Transactions' },
  // ── Operations ───────────────────────────────────────────────────────────
  75:  { label: 'In-House Guests',                                               category: 'Operations'   },
  93:  { label: 'Housekeeping Summary',                                          category: 'Operations'   },
  94:  { label: 'Housekeeping Details',                                          category: 'Operations'   },
  95:  { label: 'Group Rooming List',                                            category: 'Operations'   },
  // ── Guests ───────────────────────────────────────────────────────────────
  40:  { label: 'Guests Marketing Email Opt-in List',                            category: 'Guests'       },
};

/**
 * The reports a revenue manager actually works from: rate, occupancy, pace, ancillary
 * capture and booking behaviour.
 *
 * Deliberately excludes the ledgers, reconciliations, invoices and housekeeping lists —
 * those belong to Administration › Reports. The previous version of this list was built
 * from invented titles and so contained a marketing opt-in list (40) and a group rooming
 * list (95) under the promise of "revenue management reports"; both are gone.
 */
export const REVENUE_REPORT_IDS: number[] = [
  // Rate, occupancy and the topline
  74, 110, 101, 102,
  // Pace and forward view
  96, 79,
  // Ancillary capture — the ops-manager metric the 2026 budget is built on
  77, 39,
  // Booking behaviour
  86, 100,
];

export const REVENUE_REPORTS: Record<number, KnownReport> = Object.fromEntries(
  REVENUE_REPORT_IDS
    .filter((id) => KNOWN_REPORTS[id])
    .map((id) => [id, KNOWN_REPORTS[id]]),
);
