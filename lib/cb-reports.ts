// lib/cb-reports.ts
// Single catalog of Cloudbeds stock reports, shared by the two surfaces that list them:
//   Administration › Reports   (all of them)      app/h/[property_id]/admin/reports
//   Revenue › RevReports       (revenue subset)   app/h/[property_id]/revenue/revreports
// Extracted 2026-09-06 so the two pages cannot drift apart.

export interface KnownReport {
  label: string;
  category: string;
}

export const KNOWN_REPORTS: Record<number, KnownReport> = {
  // ── Revenue ──────────────────────────────────────────────────────────────
  74:  { label: 'Daily Revenue Report',              category: 'Revenue'      },
  75:  { label: 'Monthly Revenue Summary',           category: 'Revenue'      },
  76:  { label: 'Revenue by Room Type',              category: 'Revenue'      },
  77:  { label: 'Revenue by Rate Plan',              category: 'Revenue'      },
  78:  { label: 'Revenue by Market Segment',         category: 'Revenue'      },
  79:  { label: 'Revenue by Channel',                category: 'Revenue'      },
  92:  { label: 'RevPAR Analysis',                   category: 'Revenue'      },
  93:  { label: 'Pace Report',                       category: 'Revenue'      },
  94:  { label: 'Pickup Report',                     category: 'Revenue'      },
  95:  { label: 'Future Revenue on Books',           category: 'Revenue'      },
  // ── Finance ──────────────────────────────────────────────────────────────
  83:  { label: 'Payment Reconciliation',            category: 'Finance'      },
  61:  { label: 'Cashier Report',                    category: 'Finance'      },
  62:  { label: 'Night Audit Summary',               category: 'Finance'      },
  63:  { label: 'Night Audit Detail',                category: 'Finance'      },
  168: { label: 'Voids, Adjustments & Refunds',      category: 'Finance'      },
  84:  { label: 'Bank Reconciliation',               category: 'Finance'      },
  85:  { label: 'Trial Balance',                     category: 'Finance'      },
  86:  { label: 'General Ledger Summary',            category: 'Finance'      },
  87:  { label: 'A/R Aging Report',                  category: 'Finance'      },
  88:  { label: 'A/P Summary Report',                category: 'Finance'      },
  89:  { label: 'Commission Report',                 category: 'Finance'      },
  90:  { label: 'Travel Agent Report',               category: 'Finance'      },
  91:  { label: 'Corporate Account Revenue',         category: 'Finance'      },
  96:  { label: 'Rate Variance Report',              category: 'Finance'      },
  // ── Ledger ───────────────────────────────────────────────────────────────
  306: { label: 'Deposit Ledger with Details',       category: 'Ledger'       },
  309: { label: 'AR Ledger with Details',           category: 'Ledger'       },
  311: { label: 'Current Ledger with Details',       category: 'Ledger'       },
  304: { label: 'Pre-Stay Deposit Report',           category: 'Ledger'       },
  305: { label: 'Guest Ledger',                      category: 'Ledger'       },
  // ── Transactions ─────────────────────────────────────────────────────────
  38:  { label: 'Expanded Transaction Report',       category: 'Transactions' },
  39:  { label: 'Daily Transaction Summary',         category: 'Transactions' },
  40:  { label: 'Folio Transaction Report',          category: 'Transactions' },
  // ── Operations ───────────────────────────────────────────────────────────
  50:  { label: 'Arrivals Report',                   category: 'Operations'   },
  51:  { label: 'Departures Report',                 category: 'Operations'   },
  52:  { label: 'In-House Guest List',               category: 'Operations'   },
  53:  { label: 'Housekeeping Report',               category: 'Operations'   },
  54:  { label: 'Housekeeping Assignment',           category: 'Operations'   },
  55:  { label: 'Room Status Report',                category: 'Operations'   },
  56:  { label: 'Maintenance Report',                category: 'Operations'   },
  57:  { label: 'Out-of-Order Rooms',               category: 'Operations'   },
  58:  { label: 'Occupancy Report',                  category: 'Operations'   },
  59:  { label: 'No-Show Report',                    category: 'Operations'   },
  60:  { label: 'Cancellation Report',               category: 'Operations'   },
  // ── Guests ───────────────────────────────────────────────────────────────
  100: { label: 'Guest History Report',              category: 'Guests'       },
  101: { label: 'Booking Report',                    category: 'Guests'       },
  102: { label: 'Group Pickup Report',               category: 'Guests'       },
  103: { label: 'No-Show / Early Departure',         category: 'Guests'       },
  // ── Management ───────────────────────────────────────────────────────────
  110: { label: 'Manager\'s Daily Report',           category: 'Management'   },
  111: { label: 'Daily Recap Summary',               category: 'Management'   },
  112: { label: 'Monthly Manager Summary',           category: 'Management'   },
};

/**
 * The reports a revenue manager actually works from. Everything in the Revenue
 * category, plus the rate/commission/channel and demand-signal reports that live
 * under Finance, Operations and Guests but answer revenue questions.
 *
 * Deliberately excludes Arrivals/Departures (front-office lists), housekeeping,
 * night audit and the ledgers — those belong to Administration › Reports.
 */
export const REVENUE_REPORT_IDS: number[] = [
  // Revenue
  74, 75, 76, 77, 78, 79, 92, 93, 94, 95,
  // Rate, commission and channel economics
  96, 89, 90, 91,
  // Demand signals: what filled, what fell out
  58, 59, 60,
  // Booking behaviour
  101, 102, 103,
];

export const REVENUE_REPORTS: Record<number, KnownReport> = Object.fromEntries(
  REVENUE_REPORT_IDS
    .filter((id) => KNOWN_REPORTS[id])
    .map((id) => [id, KNOWN_REPORTS[id]]),
);
