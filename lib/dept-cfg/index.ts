// lib/dept-cfg/index.ts
// 2026-05-08 — every dept entry page reads its config from here. PBS
// design directive: each dept has the same entry layout as /revenue,
// adapted with its own data, HoD voice, sub-pages, defaults.

import type { DeptCfg } from './types';

// ─── Revenue ─────────────────────────────────────────────────────────────
// PBS 2026-05-09 #report-builder repair: hrefBase now points at the
// printable render route (`/revenue/reports/render?type=...`) instead of the
// source/source-page URL. Pressing a saved report opens a print-ready doc,
// not the live dashboard. Source pages remain reachable via the dept strip.
const REVENUE_REPORT_TYPES: NonNullable<DeptCfg['reportTypes']> = [
  // PBS 2026-07-09 pm: daily briefing = morning conclusion block emailed to HoD.
  // Template row in documentation.revenue_report_templates (key='daily_briefing').
  { value: 'daily_briefing', label: 'Daily Briefing', hrefBase: '/revenue/reports/render?type=daily_briefing', dimGroups: [] },
  // PBS 2026-07-03: keys aligned to lib/period.ts resolvePeriod contract —
  // `win` (not `window`), values `7d`/`30d` (not `last_7d`), `cmp` (not `compare`).
  // Bug 2026-07-03: builder emitted `?window=last_30d`, resolvePeriod fell
  // through to DEFAULT_WIN='30d' regardless of user choice. Fixed keys+values.
  // PBS 2026-07-03: Compare + Segment removed from Pulse builder — SDLY is
  // baked in (always the delta on the KPI strip), and segment splits belong
  // in the Channels report where they actually change the picture.
  { value: 'pulse', label: 'Pulse', hrefBase: '/revenue/reports/render?type=pulse', dimGroups: [
    { key: 'win',  label: 'Window',  options: [
      { value: 'today', label: 'Today'    },
      { value: '7d',    label: 'Last 7d'  },
      { value: '30d',   label: 'Last 30d' },
      { value: '90d',   label: 'Last 90d' },
      { value: 'mtd',   label: 'MTD'      },
      { value: 'ytd',   label: 'YTD'      },
    ]},
  ]},
  { value: 'pace', label: 'Pace', hrefBase: '/revenue/reports/render?type=pace', dimGroups: [
    { key: 'horizon', label: 'Stay horizon', options: [
      { value: 'fwd_7d',   label: 'Next 7d'   },
      { value: 'fwd_30d',  label: 'Next 30d'  },
      { value: 'fwd_60d',  label: 'Next 60d'  },
      { value: 'fwd_90d',  label: 'Next 90d'  },
      { value: 'fwd_180d', label: 'Next 180d' },
    ]},
    { key: 'pickup', label: 'Pickup window', options: [
      { value: 'last_1d',  label: 'Last 1d'  },
      { value: 'last_7d',  label: 'Last 7d'  },
      { value: 'last_28d', label: 'Last 28d' },
    ]},
    { key: 'compare', label: 'Compare', options: [
      { value: 'stly',     label: 'STLY'     },
      { value: 'sdly',     label: 'SDLY'     },
      { value: 'budget',   label: 'Budget'   },
      { value: 'forecast', label: 'Forecast' },
    ]},
    { key: 'granularity', label: 'Granularity', options: [
      { value: 'day',   label: 'Day'   },
      { value: 'week',  label: 'Week'  },
      { value: 'month', label: 'Month' },
    ]},
  ]},
  // PBS 2026-07-03: keys aligned to resolvePeriod contract (`win`/`cmp`/`seg`).
  // Segment picker moved here from Pulse — segments matter for channel mix, not for
  // the property-wide Pulse snapshot.
  { value: 'channels', label: 'Channels', hrefBase: '/revenue/reports/render?type=channels', dimGroups: [
    { key: 'win', label: 'Window', options: [
      { value: '7d',  label: 'Last 7d'  },
      { value: '30d', label: 'Last 30d' },
      { value: '90d', label: 'Last 90d' },
      { value: 'mtd', label: 'MTD'      },
      { value: 'ytd', label: 'YTD'      },
    ]},
    { key: 'seg', label: 'Segment', options: [
      { value: 'all',      label: 'All'      },
      { value: 'retail',   label: 'Retail'   },
      { value: 'dmc',      label: 'DMC'      },
      { value: 'group',    label: 'Group'    },
      { value: 'discount', label: 'Discount' },
      { value: 'comp',     label: 'Comp'     },
    ]},
    { key: 'channel', label: 'Channel', options: [
      { value: 'all',       label: 'All'       },
      { value: 'direct',    label: 'Direct'    },
      { value: 'ota',       label: 'OTA'       },
      { value: 'wholesale', label: 'Wholesale' },
      { value: 'gds',       label: 'GDS'       },
    ]},
    { key: 'metric', label: 'Metric', options: [
      { value: 'revenue',    label: 'Revenue'    },
      { value: 'rn',         label: 'RN'         },
      { value: 'adr',        label: 'ADR'        },
      { value: 'net_adr',    label: 'Net ADR'    },
      { value: 'commission', label: 'Commission' },
    ]},
    { key: 'cmp', label: 'Compare', options: [
      { value: 'stly', label: 'STLY' },
      { value: 'sdly', label: 'SDLY' },
      { value: 'lm',   label: 'Last month' },
    ]},
  ]},
  { value: 'pricing', label: 'Pricing', hrefBase: '/revenue/reports/render?type=pricing', dimGroups: [
    { key: 'horizon', label: 'Date horizon', options: [
      { value: 'fwd_7d',  label: 'Next 7d'  },
      { value: 'fwd_30d', label: 'Next 30d' },
      { value: 'fwd_90d', label: 'Next 90d' },
    ]},
    { key: 'room', label: 'Room type', options: [
      { value: 'all',       label: 'All'       },
      { value: 'premium',   label: 'Premium'   },
      { value: 'signature', label: 'Signature' },
      { value: 'entry',     label: 'Entry'     },
    ]},
    { key: 'plan', label: 'Rate plan', options: [
      { value: 'all',         label: 'All'         },
      { value: 'bar',         label: 'BAR'         },
      { value: 'promotional', label: 'Promotional' },
      { value: 'package',     label: 'Package'     },
    ]},
    { key: 'compare', label: 'Compare', options: [
      { value: 'comp',    label: 'vs comp set'      },
      { value: 'ly_date', label: 'vs LY same date'  },
    ]},
  ]},
  { value: 'comp_set', label: 'Comp Set', hrefBase: '/revenue/reports/render?type=comp_set', dimGroups: [
    { key: 'window', label: 'Window', options: [
      { value: 'last_7d',  label: 'Last 7d'  },
      { value: 'last_30d', label: 'Last 30d' },
      { value: 'last_90d', label: 'Last 90d' },
    ]},
    { key: 'property', label: 'Property', options: [
      { value: 'all', label: 'All peers'       },
      { value: 'avg', label: 'Average'         },
      { value: 'top', label: 'Top performer'   },
    ]},
    { key: 'metric', label: 'Metric', options: [
      { value: 'mpi',    label: 'MPI'    },
      { value: 'ari',    label: 'ARI'    },
      { value: 'rgi',    label: 'RGI'    },
      { value: 'adr',    label: 'ADR'    },
      { value: 'occ',    label: 'OCC'    },
      { value: 'revpar', label: 'RevPAR' },
    ]},
    { key: 'date_type', label: 'Date type', options: [
      { value: 'stay', label: 'Stay date' },
      { value: 'shop', label: 'Shop date' },
    ]},
  ]},
  { value: 'forecast', label: 'Forecast', hrefBase: '/revenue/reports/render?type=forecast', dimGroups: [
    { key: 'horizon', label: 'Horizon', options: [
      { value: 'fwd_7d',   label: 'Next 7d'   },
      { value: 'fwd_30d',  label: 'Next 30d'  },
      { value: 'fwd_90d',  label: 'Next 90d'  },
      { value: 'fwd_180d', label: 'Next 180d' },
    ]},
    { key: 'confidence', label: 'Confidence', options: [
      { value: 'p50', label: 'P50' },
      { value: 'p90', label: 'P90' },
    ]},
    { key: 'driver', label: 'Driver', options: [
      { value: 'pace', label: 'Pace'     },
      { value: 'mix',  label: 'Mix'      },
      { value: 'comp', label: 'Comp set' },
    ]},
    { key: 'compare', label: 'Compare', options: [
      { value: 'budget', label: 'Budget' },
      { value: 'ly',     label: 'LY'     },
    ]},
  ]},
  { value: 'variance', label: 'Variance', hrefBase: '/revenue/reports/render?type=variance', dimGroups: [
    { key: 'win',     label: 'Window',  options: [{ value: 'mtd', label: 'MTD' }, { value: 'ytd', label: 'YTD' }, { value: 'last_month', label: 'Last month' }] },
    { key: 'cmp',     label: 'Compare', options: [{ value: 'budget', label: 'vs budget' }, { value: 'sdly',  label: 'vs same-day-last-year' }, { value: 'both',   label: 'both' }] },
  ]},
  { value: 'pickup', label: 'Pickup', hrefBase: '/revenue/reports/render?type=pickup', dimGroups: [
    { key: 'window', label: 'Window', options: [
      { value: 'today',    label: 'Today'     },
      { value: 'last_1d',  label: 'Last 1d'   },
      { value: 'last_7d',  label: 'Last 7d'   },
      { value: 'last_28d', label: 'Last 28d'  },
    ]},
    { key: 'frequency', label: 'Send frequency', options: [
      { value: 'once',  label: 'Once now'  },
      { value: 'daily', label: 'Daily 08:00' },
    ]},
    { key: 'email', label: 'Email to', options: [
      { value: 'me',       label: 'Just me'       },
      { value: 'rev_team', label: 'Revenue team'  },
      { value: 'gm',       label: 'GM + revenue'  },
    ]},
  ]},
  { value: 'all', label: 'All revenue', hrefBase: '/revenue/reports/render?type=pulse', dimGroups: [
    { key: 'win', label: 'Window', options: [
      { value: '7d',   label: 'Last 7d'  },
      { value: '30d',  label: 'Last 30d' },
      { value: 'mtd',  label: 'MTD'      },
      { value: 'ytd',  label: 'YTD'      },
    ]},
    { key: 'cmp', label: 'Compare', options: [
      { value: 'stly',   label: 'STLY'   },
      { value: 'budget', label: 'Budget' },
    ]},
  ]},
];

const TODAY = new Date().toISOString().slice(0, 10);

// ─── Sales report catalogue ─────────────────────────────────────────────
// PBS 2026-07-08: light per-dept report catalogues so the Build-a-report
// container renders on every HoD. All non-revenue hrefBase paths point at
// the shared reports app (/h/<pid>/reports?dept=<slug>&type=<key>) — the
// dept-scoped render routes can be built later without breaking these keys.
const SALES_REPORT_TYPES: NonNullable<DeptCfg['reportTypes']> = [
  { value: 'inquiries', label: 'Inquiries', hrefBase: '/h/260955/reports?dept=sales&type=inquiries', dimGroups: [
    { key: 'win', label: 'Window', options: [
      { value: 'today', label: 'Today' }, { value: '7d', label: 'Last 7d' },
      { value: '30d', label: 'Last 30d' }, { value: 'mtd', label: 'MTD' },
    ]},
    { key: 'status', label: 'Status', options: [
      { value: 'all', label: 'All' }, { value: 'open', label: 'Open' },
      { value: 'qualified', label: 'Qualified' }, { value: 'won', label: 'Won' }, { value: 'lost', label: 'Lost' },
    ]},
  ]},
  { value: 'conversion', label: 'Conversion', hrefBase: '/h/260955/reports?dept=sales&type=conversion', dimGroups: [
    { key: 'win', label: 'Window', options: [
      { value: '7d', label: 'Last 7d' }, { value: '30d', label: 'Last 30d' }, { value: '90d', label: 'Last 90d' },
    ]},
    { key: 'source', label: 'Source', options: [
      { value: 'all', label: 'All' }, { value: 'direct', label: 'Direct' },
      { value: 'agent', label: 'Agent' }, { value: 'dmc', label: 'DMC' },
    ]},
  ]},
  { value: 'pipeline', label: 'Pipeline', hrefBase: '/h/260955/reports?dept=sales&type=pipeline', dimGroups: [
    { key: 'stage', label: 'Stage', options: [
      { value: 'all', label: 'All' }, { value: 'qualified', label: 'Qualified' },
      { value: 'proposal', label: 'Proposal' }, { value: 'won', label: 'Won' },
    ]},
    { key: 'value', label: 'Deal size', options: [
      { value: 'all', label: 'All' }, { value: 'small', label: 'Small' }, { value: 'large', label: 'Large' },
    ]},
  ]},
];

// ─── Marketing report catalogue ──────────────────────────────────────────
const MARKETING_REPORT_TYPES: NonNullable<DeptCfg['reportTypes']> = [
  { value: 'campaigns', label: 'Campaigns', hrefBase: '/h/260955/reports?dept=marketing&type=campaigns', dimGroups: [
    { key: 'win', label: 'Window', options: [
      { value: '7d', label: 'Last 7d' }, { value: '30d', label: 'Last 30d' }, { value: '90d', label: 'Last 90d' },
    ]},
    { key: 'channel', label: 'Channel', options: [
      { value: 'all', label: 'All' }, { value: 'email', label: 'Email' },
      { value: 'social', label: 'Social' }, { value: 'paid', label: 'Paid' },
    ]},
  ]},
  { value: 'prospects', label: 'Prospects', hrefBase: '/h/260955/reports?dept=marketing&type=prospects', dimGroups: [
    { key: 'status', label: 'Status', options: [
      { value: 'all', label: 'All' }, { value: 'new', label: 'New' },
      { value: 'mx_verified', label: 'MX verified' }, { value: 'engaged', label: 'Engaged' },
    ]},
    { key: 'source', label: 'Source', options: [
      { value: 'all', label: 'All' }, { value: 'apify', label: 'Apify' },
      { value: 'csv', label: 'CSV import' }, { value: 'manual', label: 'Manual' },
    ]},
  ]},
  { value: 'funnels', label: 'Funnels', hrefBase: '/h/260955/reports?dept=marketing&type=funnels', dimGroups: [
    { key: 'win', label: 'Window', options: [
      { value: '30d', label: 'Last 30d' }, { value: '90d', label: 'Last 90d' }, { value: 'ytd', label: 'YTD' },
    ]},
    { key: 'stage', label: 'Stage', options: [
      { value: 'all', label: 'All' }, { value: 'top', label: 'Top-of-funnel' },
      { value: 'mid', label: 'Mid' }, { value: 'bottom', label: 'Bottom' },
    ]},
  ]},
];

// ─── Contacts (Guest) report catalogue ───────────────────────────────────
const CONTACTS_REPORT_TYPES: NonNullable<DeptCfg['reportTypes']> = [
  { value: 'reputation', label: 'Reputation', hrefBase: '/h/260955/reports?dept=guest&type=reputation', dimGroups: [
    { key: 'win', label: 'Window', options: [
      { value: '30d', label: 'Last 30d' }, { value: '90d', label: 'Last 90d' }, { value: 'all', label: 'All-time' },
    ]},
    { key: 'source', label: 'Source', options: [
      { value: 'all', label: 'All' }, { value: 'booking', label: 'Booking.com' },
      { value: 'tripadvisor', label: 'TripAdvisor' }, { value: 'expedia', label: 'Expedia' }, { value: 'ctrip', label: 'Trip.com' },
    ]},
  ]},
  { value: 'newsletter', label: 'Newsletter', hrefBase: '/h/260955/reports?dept=guest&type=newsletter', dimGroups: [
    { key: 'win', label: 'Window', options: [
      { value: '30d', label: 'Last 30d' }, { value: '90d', label: 'Last 90d' },
    ]},
    { key: 'campaign', label: 'Campaign', options: [
      { value: 'all', label: 'All' }, { value: 'anticipation', label: 'Anticipation' },
      { value: 'gratitude', label: 'Gratitude' }, { value: 'monthly', label: 'Monthly' },
    ]},
  ]},
  { value: 'retention', label: 'Retention', hrefBase: '/h/260955/reports?dept=guest&type=retention', dimGroups: [
    { key: 'win', label: 'Window', options: [
      { value: '90d', label: 'Last 90d' }, { value: 'ytd', label: 'YTD' }, { value: 'all', label: 'All-time' },
    ]},
    { key: 'cohort', label: 'Cohort', options: [
      { value: 'all', label: 'All' }, { value: 'repeat', label: 'Repeat' },
      { value: 'vip', label: 'VIP' }, { value: 'winback', label: 'Win-back' },
    ]},
  ]},
];

// ─── Operations report catalogue ─────────────────────────────────────────
const OPS_REPORT_TYPES: NonNullable<DeptCfg['reportTypes']> = [
  { value: 'covers', label: 'Covers', hrefBase: '/h/260955/reports?dept=operations&type=covers', dimGroups: [
    { key: 'win', label: 'Window', options: [
      { value: 'today', label: 'Today' }, { value: '7d', label: 'Last 7d' }, { value: '30d', label: 'Last 30d' },
    ]},
    { key: 'dept', label: 'Department', options: [
      { value: 'all', label: 'All' }, { value: 'rooms', label: 'Rooms' },
      { value: 'fnb', label: 'F&B' }, { value: 'spa', label: 'Spa' }, { value: 'activities', label: 'Activities' },
    ]},
  ]},
  { value: 'capture_rate', label: 'Capture rate', hrefBase: '/h/260955/reports?dept=operations&type=capture_rate', dimGroups: [
    { key: 'win', label: 'Window', options: [
      { value: '30d', label: 'Last 30d' }, { value: '90d', label: 'Last 90d' }, { value: 'ytd', label: 'YTD' },
    ]},
    { key: 'outlet', label: 'Outlet', options: [
      { value: 'all', label: 'All' }, { value: 'fnb', label: 'F&B' },
      { value: 'spa', label: 'Spa' }, { value: 'activities', label: 'Activities' }, { value: 'retail', label: 'Retail' },
    ]},
  ]},
  { value: 'suppliers', label: 'Suppliers', hrefBase: '/h/260955/reports?dept=operations&type=suppliers', dimGroups: [
    { key: 'status', label: 'Status', options: [
      { value: 'all', label: 'All' }, { value: 'active', label: 'Active' }, { value: 'inactive', label: 'Inactive' },
    ]},
    { key: 'category', label: 'Category', options: [
      { value: 'all', label: 'All' }, { value: 'food', label: 'Food' },
      { value: 'beverage', label: 'Beverage' }, { value: 'consumables', label: 'Consumables' },
    ]},
  ]},
];

// ─── Administration (Finance) report catalogue ───────────────────────────
const FIN_REPORT_TYPES: NonNullable<DeptCfg['reportTypes']> = [
  { value: 'pnl', label: 'P&L', hrefBase: '/h/260955/reports?dept=finance&type=pnl', dimGroups: [
    { key: 'win', label: 'Window', options: [
      { value: 'mtd', label: 'MTD' }, { value: 'qtd', label: 'QTD' }, { value: 'ytd', label: 'YTD' },
      { value: 'last_month', label: 'Last month' },
    ]},
    { key: 'cmp', label: 'Compare', options: [
      { value: 'budget', label: 'vs Budget' }, { value: 'ly', label: 'vs LY' }, { value: 'both', label: 'Both' },
    ]},
  ]},
  { value: 'ledger', label: 'Ledger', hrefBase: '/h/260955/reports?dept=finance&type=ledger', dimGroups: [
    { key: 'win', label: 'Window', options: [
      { value: 'mtd', label: 'MTD' }, { value: 'last_month', label: 'Last month' }, { value: 'ytd', label: 'YTD' },
    ]},
    { key: 'account', label: 'Account', options: [
      { value: 'all', label: 'All' }, { value: 'revenue', label: 'Revenue' },
      { value: 'cost', label: 'Cost' }, { value: 'payroll', label: 'Payroll' },
    ]},
  ]},
  { value: 'variance', label: 'Variance', hrefBase: '/h/260955/reports?dept=finance&type=variance', dimGroups: [
    { key: 'win', label: 'Window', options: [
      { value: 'mtd', label: 'MTD' }, { value: 'ytd', label: 'YTD' }, { value: 'last_month', label: 'Last month' },
    ]},
    { key: 'cmp', label: 'Compare', options: [
      { value: 'budget', label: 'vs Budget' }, { value: 'ly', label: 'vs LY' }, { value: 'both', label: 'Both' },
    ]},
  ]},
];

const REVENUE_CFG: DeptCfg = {
  slug: 'revenue',
  pillTitle: 'Revenue',
  hodName: 'Vector',
  hodEmoji: '⚓',
  ownerRole: 'revenue_hod',
  hodTagline: 'Ask Vector anything about revenue.',
  chatPlaceholder: 'e.g. how are we pacing for next weekend?',
  storageKeyPrefix: 'rev',
  // PBS 2026-07-06 late evening: canonical Revenue nav — 6 top-level groups.
  // Three of them are HUBS with sub-tabs (rendered on their landing pages as an
  // inline strip below the main tab bar):
  //   Demand & Pace  → Demand / Pace / Pickup / Cancellations
  //   Performance    → Rooms / Channels / Rate Plans / Markets
  //   Market & Control → Comp Set / Leakage / Parity
  // The parent tab links to the first child so clicking it always lands somewhere useful.
  subPages: [
    // PBS 2026-07-07 evening: HoD + Overview split. /revenue = HoD chat cockpit.
    // /revenue/overview = new dept-wide summary landing with Pulse + Calendar sub-tabs.
    // PBS 2026-07-07 night: Overview tab lands on /revenue/pulse (dept summary
    // page is no longer used). Sub-strip on Pulse shows Calendar (sibling filter
    // hides Pulse itself).
    { label: 'HoD',             href: '/revenue'          },
    { label: 'Overview',        href: '/revenue/pulse'    },
    { label: 'Demand & Pace',   href: '/revenue/demand'   },
    { label: 'Performance',     href: '/revenue/rooms'    },
    { label: 'Market & Control',href: '/revenue/compset'  },
    { label: 'Reports',         href: '/h/260955/reports?dept=revenue' },
  ],
  quickChips: [
    { label: 'Pulse',    href: '/revenue/pulse'    },
    { label: 'Demand',   href: '/revenue/demand'   },
    { label: 'Pace',     href: '/revenue/pace'     },
    { label: 'Channels', href: '/revenue/channels' },
    { label: 'Comp Set', href: '/revenue/compset'  },
    { label: 'Parity',   href: '/revenue/parity'   },
    { label: 'Forecast', href: '/revenue/forecast' },
  ],
  defaultAttn: [
    { id: 'l1', label: 'OTA parity breach — BDC $142 vs direct $158',  severity: 'high',   kind: 'leakage'     },
    { id: 'l2', label: 'Comp set data stale — last sync 48h ago',      severity: 'low',    kind: 'leakage'     },
    { id: 'o1', label: 'Pace −14% vs STLY for next 30 days',           severity: 'medium', kind: 'opportunity' },
    { id: 'o2', label: 'Long-weekend BAR ladder under-priced vs comp', severity: 'medium', kind: 'opportunity' },
  ],
  // PBS 2026-05-09 #report-builder repair: defaults now point at the
  // printable render route. Pressing the tile pops a print-ready report
  // open in a new tab (target=_blank handled in DeptEntry via /revenue
  // prefix → same-origin link).
  defaultDocs: [
    { id: 'd1', label: 'Pulse · last 30d',            href: '/revenue/reports/render?type=pulse&win=30d&cmp=stly',  kind: 'report', report_type: 'pulse'    },
    { id: 'd2', label: 'Pace · −30d → +30d vs STLY',   href: '/revenue/reports/render?type=pace&win=30d&cmp=stly',   kind: 'report', report_type: 'pace'     },
    { id: 'd3', label: 'Channel mix · last 30d',       href: '/revenue/reports/render?type=channels&win=30d',        kind: 'report', report_type: 'channels' },
    { id: 'd4', label: 'P&L · current month',          href: '/revenue/reports/render?type=pl-month',                kind: 'report', report_type: 'pl-month' },
  ],
  defaultTasks: [
    { id: 't1', label: 'Review OTA parity alerts',    done: false, created: TODAY },
    { id: 't2', label: 'Update BAR for long weekend', done: false, created: TODAY },
    { id: 't3', label: 'Sign off on group quote #12', done: false, created: TODAY },
  ],
  attentionRoutes: [
    { matcher: 'parity',  href: '/revenue/parity'   },
    { matcher: 'comp',    href: '/revenue/compset'  },
    { matcher: 'compset', href: '/revenue/compset'  },
    { matcher: 'pace',    href: '/revenue/pace'     },
    { matcher: 'channel', href: '/revenue/channels' },
    { matcher: 'rate',    href: '/revenue/pricing'  },
    { matcher: 'bar',     href: '/revenue/pricing'  },
    { matcher: 'forecast', href: '/revenue/forecast' },
  ],
  defaultDrilldown: '/revenue/pulse',
  kpiTiles: [
    { k: 'OCC',    v: '78%',  d: '+4 vs LY'        },
    { k: 'ADR',    v: '$182', d: '+$6 vs STLY'     },
    { k: 'RevPAR', v: '$142', d: '+$11 vs LY'      },
    { k: 'PACE',   v: '−14%', d: 'next 30d vs STLY' },
  ],
  reportTypes: REVENUE_REPORT_TYPES,
  brandHex: '#084838',
};

// ─── Sales — Mercer ──────────────────────────────────────────────────────
const SALES_CFG: DeptCfg = {
  slug: 'sales',
  pillTitle: 'Sales',
  hodName: 'Mercer',
  hodEmoji: '✉',
  ownerRole: 'sales_hod',
  hodTagline: 'Ask Mercer anything about the inbound funnel.',
  chatPlaceholder: 'e.g. which inquiries went silent past 48h?',
  storageKeyPrefix: 'sal',
  subPages: [
    // PBS 2026-05-16: 4-page collapse — Pipeline absorbs Inquiries/Leads/BTB/Groups/FIT
    // as filter chips. Accounts is the new mini-CRM. Old pages parked (still
    // accessible at their URLs with a deprecation banner) until PBS confirms deletion.
    { label: 'HoD',       href: '/sales'           },
    { label: 'Pipeline',  href: '/sales/leads'     },
    { label: 'Accounts',  href: '/sales/accounts'  },
    { label: 'Packages',  href: '/sales/packages'  },
    { label: 'Reports',   href: '/h/260955/reports?dept=sales' },
  ],
  quickChips: [
    { label: 'Inquiries', href: '/sales/inquiries' },
    { label: 'Leads',     href: '/sales/leads'     },
    { label: 'Packages',  href: '/sales/packages'  },
    { label: 'B2B / DMC', href: '/sales/b2b'       },
  ],
  defaultAttn: [
    { id: 'l1', label: 'Inquiry → quote SLA breach (>48h) for 4 leads', severity: 'high',   kind: 'leakage'     },
    { id: 'l2', label: 'B2B contract renewal lapsed — DMC Asia',        severity: 'medium', kind: 'leakage'     },
    { id: 'o1', label: 'Long-weekend group request needs proposal',     severity: 'medium', kind: 'opportunity' },
    { id: 'o2', label: 'Repeat guest enquiring about retreat package',  severity: 'low',    kind: 'opportunity' },
  ],
  defaultDocs: [
    { id: 'd1', label: 'Sales Playbook 2026',     href: '/sales/inquiries' },
    { id: 'd2', label: 'B2B Rate Card · Apr 2026', href: '/sales/b2b'      },
    { id: 'd3', label: 'Group Quote Template',     href: '/sales/groups'   },
  ],
  defaultTasks: [
    { id: 't1', label: 'Reply to overdue inquiries',          done: false, created: TODAY },
    { id: 't2', label: 'Send group proposal — long weekend',  done: false, created: TODAY },
    { id: 't3', label: 'DMC contract renewal call',           done: false, created: TODAY },
  ],
  attentionRoutes: [
    { matcher: 'inquir',   href: '/sales/inquiries' },
    { matcher: 'lead',     href: '/sales/leads'     },
    { matcher: 'group',    href: '/sales/groups'    },
    { matcher: 'package',  href: '/sales/packages'  },
    { matcher: 'b2b',      href: '/sales/b2b'       },
    { matcher: 'dmc',      href: '/sales/b2b'       },
    { matcher: 'pipeline', href: '/sales/pipeline'  },
    { matcher: 'fit',      href: '/sales/fit'       },
  ],
  defaultDrilldown: '/sales/inquiries',
  kpiTiles: [
    { k: 'INBOX',   v: '12',  d: 'open · 4 overdue' },
    { k: 'WIN %',   v: '34%', d: 'last 30d'         },
    { k: 'LEAD T',  v: '2.4d', d: 'avg → quote'     },
    { k: 'B2B',     v: '7',   d: 'active contracts' },
  ],
  reportTypes: SALES_REPORT_TYPES,
};

// ─── Marketing — Lumen ───────────────────────────────────────────────────
const MARKETING_CFG: DeptCfg = {
  slug: 'marketing',
  pillTitle: 'Marketing',
  hodName: 'Lumen',
  hodEmoji: '✶',
  ownerRole: 'marketing_hod',
  hodTagline: 'Ask Lumen anything about brand reach.',
  chatPlaceholder: 'e.g. which channel grew most this month?',
  storageKeyPrefix: 'mkt',
  // PBS 2026-07-06 late evening: sharper hierarchical Marketing nav — 6 top-level parents
  // (plus Reports). Sub-tabs render on each parent's landing page:
  //   Overview          → Info / Reports
  //   Acquisition       → Campaigns / Funnels / Prospects
  //   Products & Offers → Compiler
  //   Content           → Media / Social
  //   Digital           → Web
  //   Library           → Docs
  // Parent tab links to the first child so clicking always lands somewhere useful.
  subPages: [
    // PBS 2026-07-07 night:
    // - Overview lands on /marketing/library (Library becomes Overview's home).
    // - Info removed as sub-tab; Library + Docs now sit directly under Overview.
    // - Library top-level tab removed (merged into Overview).
    // - Content lands on /marketing/gallery (Media page, not the empty stub).
    { label: 'HoD',               href: '/marketing'                 },
    { label: 'Overview',          href: '/marketing/library'         },
    { label: 'Acquisition',       href: '/marketing/acquisition'     },
    { label: 'Products & Offers', href: '/marketing/offers'          },
    { label: 'Content',           href: '/marketing/gallery'         },
    { label: 'Digital',           href: '/marketing/digital'         },
    { label: 'Reports',           href: '/h/260955/reports?dept=marketing' },
  ],
  quickChips: [
    { label: 'HoD',       href: '/marketing'             },
    { label: 'Library',   href: '/marketing/library'     },
    { label: 'Media',     href: '/marketing/gallery'       },
    { label: 'Campaigns', href: '/marketing/campaigns'   },
    { label: 'Prospects', href: '/marketing/prospects'   },
    { label: 'Funnels',   href: '/marketing/funnels'     },
    { label: 'Social',    href: '/marketing/social'      },
    { label: 'Reviews',   href: '/marketing/reviews'     },
    { label: 'Audiences', href: '/marketing/audiences'   },
  ],
  defaultAttn: [
    { id: 'l1', label: 'BDC review score down 0.2 vs comp area',     severity: 'high',   kind: 'leakage'     },
    { id: 'l2', label: 'IG engagement rate −18% week-on-week',       severity: 'medium', kind: 'leakage'     },
    { id: 'o1', label: 'Wedding influencer ask for 3-night stay',    severity: 'medium', kind: 'opportunity' },
    { id: 'o2', label: 'Untapped audience: returning guests · 2024', severity: 'low',    kind: 'opportunity' },
  ],
  defaultDocs: [
    { id: 'd1', label: 'Brand Guide 2026',          href: '/marketing/taxonomy'  },
    { id: 'd2', label: 'Q2 Campaign Plan',          href: '/marketing/campaigns' },
    { id: 'd3', label: 'Social media calendar',     href: '/marketing/social'    },
  ],
  defaultTasks: [
    { id: 't1', label: 'Reply to 7 BDC reviews (last 7d)',     done: false, created: TODAY },
    { id: 't2', label: 'Approve August campaign creative',     done: false, created: TODAY },
    { id: 't3', label: 'Schedule influencer site-visit',       done: false, created: TODAY },
  ],
  attentionRoutes: [
    { matcher: 'review',     href: '/marketing/reviews'     },
    { matcher: 'social',     href: '/marketing/social'      },
    { matcher: 'influenc',   href: '/marketing/influencers' },
    { matcher: 'campaign',   href: '/marketing/campaigns'   },
    { matcher: 'audience',   href: '/marketing/audiences'   },
    { matcher: 'library',    href: '/marketing/library'     },
  ],
  defaultDrilldown: '/marketing',
  kpiTiles: [
    { k: 'REVIEW',    v: '4.7', d: '128 last 30d'       },
    { k: 'IG REACH',  v: '38k', d: '+12% vs LM'         },
    { k: 'CAMPAIGNS', v: '3',   d: 'live'               },
    { k: 'UGC',       v: '24',  d: 'unused assets'      },
  ],
  reportTypes: MARKETING_REPORT_TYPES,
};

// ─── Operations — Forge ──────────────────────────────────────────────────
const OPERATIONS_CFG: DeptCfg = {
  slug: 'operations',
  pillTitle: 'Operations',
  hodName: 'Forge',
  hodEmoji: '⚙',
  ownerRole: 'operations_hod',
  hodTagline: 'Ask Forge anything about live ops.',
  chatPlaceholder: 'e.g. is the spa fully booked this week?',
  storageKeyPrefix: 'ops',
  // PBS 2026-07-07 evening: canonical Operations nav — mirrors Revenue/Marketing
  // hierarchical pattern. HoD chat cockpit + Overview landing + Departments hub
  // (with sub-tabs for Rooms/F&B/Spa/Activities/Retail/Transport/Other) + QA/Docs/Suppliers.
  // Sub-tabs render inline on each parent's landing via nav-subgroups.
  subPages: [
    // PBS 2026-07-07 night: QA back as top-level tab. Docs moved to a sub-tab
    // of Overview (renders below the top strip when on Overview).
    { label: 'HoD',              href: '/operations'                 },
    { label: 'Overview',         href: '/operations/overview'        },
    { label: 'Departments',      href: '/operations/rooms'           },
    { label: 'Suppliers',        href: '/operations/suppliers'       },
    { label: 'QA',               href: '/operations/sops'            },
    { label: 'Reports',          href: '/h/260955/reports?dept=operations' },
  ],
  quickChips: [
    { label: 'HoD',        href: '/operations'             },
    { label: 'Rooms',      href: '/operations/rooms'       },
    { label: 'F&B',        href: '/operations/restaurant'  },
    { label: 'Spa',        href: '/operations/spa'         },
    { label: 'Activities', href: '/operations/activities'  },
    { label: 'Retail',     href: '/operations/retail'      },
    { label: 'Transport',  href: '/operations/transport'   },
    { label: 'Other',      href: '/operations/other'       },
    { label: 'Suppliers',  href: '/operations/suppliers'   },
  ],
  defaultAttn: [
    { id: 'l1', label: 'F&B waste +18% vs last week',         severity: 'medium', kind: 'leakage'     },
    { id: 'l2', label: 'Inventory shortfall — coffee beans',  severity: 'high',   kind: 'leakage'     },
    { id: 'o1', label: 'Spa midweek slots empty next week',   severity: 'medium', kind: 'opportunity' },
    { id: 'o2', label: 'Activities cross-sell at check-in',   severity: 'low',    kind: 'opportunity' },
  ],
  defaultDocs: [
    { id: 'd1', label: 'F&B SOP 2026',          href: '/operations/restaurant' },
    { id: 'd2', label: 'Spa treatment menu',    href: '/operations/spa'        },
    { id: 'd3', label: 'Inventory par levels',  href: '/operations/inventory'  },
  ],
  defaultTasks: [
    { id: 't1', label: 'Restock coffee beans',         done: false, created: TODAY },
    { id: 't2', label: 'Approve weekly staff roster',  done: false, created: TODAY },
    { id: 't3', label: 'Audit activity bookings',      done: false, created: TODAY },
  ],
  attentionRoutes: [
    { matcher: 'staff',      href: '/operations/staff'           },
    { matcher: 'f&b',        href: '/operations/restaurant'      },
    { matcher: 'restaurant', href: '/operations/restaurant'      },
    { matcher: 'spa',        href: '/operations/spa'             },
    { matcher: 'activit',    href: '/operations/activities'      },
    { matcher: 'inventory',  href: '/operations/inventory'       },
    { matcher: 'catalog',    href: '/finance/messy-data'         },
  ],
  defaultDrilldown: '/operations',
  kpiTiles: [
    { k: 'OCC TODAY',  v: '24/30', d: 'incl. 2 walk-ins'    },
    { k: 'F&B COVERS', v: '38',    d: 'lunch · today'       },
    { k: 'SPA',        v: '6/8',   d: 'slots used today'    },
    { k: 'INV ALERTS', v: '3',     d: 'below par'           },
  ],
  reportTypes: OPS_REPORT_TYPES,
};

// ─── Guest — Felix (no formal HoD; PBS uses Felix here) ──────────────────
const GUEST_CFG: DeptCfg = {
  slug: 'guest',
  // PBS 2026-07-06 evening: pillTitle renamed Guest → Contacts. slug stays 'guest' + URL /guest to keep every existing deep link alive.
  pillTitle: 'Contacts',
  hodName: 'Felix',
  hodEmoji: '★',
  ownerRole: 'lead',
  hodTagline: 'Ask Felix anything about the guest journey.',
  chatPlaceholder: 'e.g. who is checking in this evening?',
  storageKeyPrefix: 'gst',
  subPages: [
    // PBS 2026-07-06 evening: dept renamed Guest → Contacts.
    // - Directory tab renamed "Guests"
    // - Prospects tab added (data still lives at /marketing/prospects until physical move)
    // - Findings dropped (all its content lives on HoD conclusions now)
    // - Newsletters moved to just before Reports
    // PBS 2026-07-06 late evening: Prospects URL moved from /marketing/prospects → /guest/prospects.
    { label: 'HoD',         href: '/guest'             },
    { label: 'Guests',      href: '/guest/directory'   },
    { label: 'Prospects',   href: '/guest/prospects'   },
    { label: 'Reputation',  href: '/guest/reputation'  },
    { label: 'Behaviour',   href: '/guest/behaviour'   },
    { label: 'Newsletters', href: '/guest/newsletters' },
    { label: 'Reports',     href: '/h/260955/reports?dept=guest' },
  ],
  quickChips: [
    { label: 'Guests',     href: '/guest/directory'  },
    { label: 'Prospects',  href: '/guest/prospects'  },
    { label: 'Reputation', href: '/guest/reputation' },
    { label: 'Behaviour',  href: '/guest/behaviour'  },
    { label: 'Newsletters',href: '/guest/newsletters'},
  ],
  defaultAttn: [
    { id: 'l1', label: 'Negative review on TripAdvisor — needs reply', severity: 'high',   kind: 'leakage'     },
    { id: 'l2', label: 'No-show rate +3pp vs last month',              severity: 'medium', kind: 'leakage'     },
    { id: 'o1', label: 'Returning guest arriving — VIP gesture due',   severity: 'medium', kind: 'opportunity' },
    { id: 'o2', label: 'Loyalty member 3rd stay — upgrade window',     severity: 'low',    kind: 'opportunity' },
  ],
  defaultDocs: [
    { id: 'd1', label: 'Retention cockpit',     href: '/guest/behaviour'   },
    { id: 'd2', label: 'Guest directory',       href: '/guest/directory'   },
    { id: 'd3', label: 'Reputation',            href: '/guest/reputation'  },
  ],
  defaultTasks: [
    { id: 't1', label: 'Reply to TripAdvisor review',         done: false, created: TODAY },
    { id: 't2', label: 'Brief team on tonight\'s VIP arrival', done: false, created: TODAY },
    { id: 't3', label: 'Confirm loyalty upgrade for room 12', done: false, created: TODAY },
  ],
  attentionRoutes: [
    { matcher: 'review',     href: '/guest/reputation' },
    { matcher: 'reputation', href: '/guest/reputation' },
    { matcher: 'no-show',    href: '/guest/behaviour'  },
    { matcher: 'directory',  href: '/guest/directory'  },
    { matcher: 'journey',    href: '/guest/behaviour'  },
    { matcher: 'loyalty',    href: '/guest/behaviour'  },
    { matcher: 'behaviour',  href: '/guest/behaviour'  },
    { matcher: 'retention',  href: '/guest/behaviour'  },
    { matcher: 'vip',        href: '/guest/directory'  },
  ],
  defaultDrilldown: '/guest',
  kpiTiles: [
    { k: 'NPS',     v: '64',  d: 'last 30d'         },
    { k: 'REPUTE',  v: '4.7', d: 'all channels'     },
    { k: 'LOYALTY', v: '18%', d: 'repeat share'     },
    { k: 'NO-SHOW', v: '2.1%', d: '+0.6pp vs LM'    },
  ],
  reportTypes: CONTACTS_REPORT_TYPES,
};

// ─── Finance — Intel ─────────────────────────────────────────────────────
const FINANCE_CFG: DeptCfg = {
  slug: 'finance',
  // PBS 2026-07-06: label renamed Finance → Administration. URL stays /finance
  // to keep every existing deep link + bookmark alive.
  pillTitle: 'Administration',
  hodName: 'Intel',
  hodEmoji: '$',
  ownerRole: 'finance_hod',
  hodTagline: 'Ask Intel anything about the books.',
  chatPlaceholder: 'e.g. how is GOP tracking vs budget?',
  storageKeyPrefix: 'fin',
  subPages: [
    // PBS 2026-07-07 night: Legal restored as a top-level tab (helpers stripped it
    // by mistake). Ledger stays a sub-tab of Finance (visible when on any Finance
    // child page — see nav-subgroups /finance/pnl group).
    { label: 'HoD',             href: '/finance'                          },
    { label: 'Overview',        href: '/finance/overview'                 },
    { label: 'HR',              href: '/finance/hr'                       },
    { label: 'Finance',         href: '/finance/pnl'                      },
    { label: 'Legal',           href: '/finance/legal'                    },
    { label: 'Reports',         href: '/h/260955/reports?dept=finance'    },
  ],
  quickChips: [
    { label: 'HoD',            href: '/finance'             },
    { label: 'Overview',       href: '/finance/overview'    },
    { label: 'P&L',            href: '/finance/pnl'         },
    { label: 'Ledger',         href: '/finance/ledger'      },
    { label: 'Transactions',   href: '/finance/transactions' },
    { label: 'HR',             href: '/finance/hr'          },
    { label: 'Budget',         href: '/finance/budget'      },
    { label: 'Cashflow',       href: '/finance/cashflow'    },
  ],
  // PBS 2026-05-15: Messy data pulled out of submenu, surfaced as an
  // orange accent button under the HoD chat input on /finance.
  extraChatButtons: [
    { label: 'Messy data', href: '/finance/messy-data', color: '#d68a3a' },
  ],
  defaultAttn: [
    { id: 'l1', label: 'AR > 60 days — $4.2k unpaid',          severity: 'high',   kind: 'leakage'     },
    { id: 'l2', label: 'Variance: F&B cost +9% vs budget',     severity: 'medium', kind: 'leakage'     },
    { id: 'o1', label: 'GOP +6% vs LY — protect mix',          severity: 'medium', kind: 'opportunity' },
    { id: 'o2', label: 'Refund rate down — keep cancellation policy', severity: 'low', kind: 'opportunity' },
  ],
  defaultDocs: [
    { id: 'd1', label: 'USALI 11 chart of accounts', href: '/finance/mapping' },
    { id: 'd2', label: 'Budget 2026 v3',             href: '/finance/budget'  },
    { id: 'd3', label: 'AP supplier playbook',       href: '/finance/supplier-mapping' },
  ],
  defaultTasks: [
    { id: 't1', label: 'Reconcile POS · Cloudbeds (last 7d)', done: false, created: TODAY },
    { id: 't2', label: 'Chase AR > 60 days',                  done: false, created: TODAY },
    { id: 't3', label: 'Sign off on April P&L',               done: false, created: TODAY },
  ],
  attentionRoutes: [
    { matcher: 'p&l',        href: '/finance/pnl'          },
    { matcher: 'ledger',     href: '/finance/ledger'       },
    { matcher: 'transaction', href: '/finance/transactions' },
    { matcher: 'pos',        href: '/finance/pos'              },
    { matcher: 'budget',     href: '/finance/budget'       },
    { matcher: 'supplier',   href: '/finance/supplier-mapping' },
    { matcher: 'mapping',    href: '/finance/mapping'      },
    { matcher: 'cash',       href: '/finance/cashflow'     },
    { matcher: 'variance',   href: '/finance/variance'     },
  ],
  defaultDrilldown: '/finance',
  kpiTiles: [
    { k: 'GOP',    v: '$48k', d: 'MTD · +6% LY'   },
    { k: 'F&B',    v: '32%',  d: 'cost ratio'      },
    { k: 'AR>60',  v: '$4.2k', d: '5 invoices'     },
    { k: 'CASH',   v: '$112k', d: 'on hand'        },
  ],
  reportTypes: FIN_REPORT_TYPES,
};

// ─── IT — Captain Kit ────────────────────────────────────────────────────
const IT_CFG: DeptCfg = {
  slug: 'it',
  pillTitle: 'IT',
  hodName: 'Captain Kit',
  hodEmoji: '🧭',
  ownerRole: 'it_manager',
  hodTagline: 'Ask Kit anything about the platform.',
  chatPlaceholder: 'e.g. why is the chat slow today?',
  storageKeyPrefix: 'it',
  subPages: [
    { label: 'Cockpit',   href: '/cockpit'           },
    { label: 'Tasks',     href: '/cockpit/tasks'     },
    { label: 'Schedule',  href: '/cockpit/schedule'  },
    { label: 'Knowledge', href: '/knowledge'         },
    { label: 'Audit log', href: '/cockpit?tab=audit' },
    { label: 'Agents',    href: '/cockpit?tab=team'  },
  ],
  quickChips: [
    { label: 'Cockpit',   href: '/cockpit'           },
    { label: 'Tasks',     href: '/cockpit/tasks'     },
    { label: 'Schedule',  href: '/cockpit/schedule'  },
    { label: 'Knowledge', href: '/knowledge'         },
    { label: 'Audit log', href: '/cockpit?tab=audit' },
    { label: 'Agents',    href: '/cockpit?tab=team'  },
  ],
  defaultAttn: [
    { id: 'l1', label: 'Open cockpit tickets need triage',     severity: 'medium', kind: 'leakage'     },
    { id: 'l2', label: 'Failed deploy on staging — auto-merge', severity: 'medium', kind: 'leakage'    },
    { id: 'o1', label: 'Agent SLA improving — 2x throughput',  severity: 'low',    kind: 'opportunity' },
  ],
  defaultDocs: [
    { id: 'd1', label: 'CLAUDE.md',         href: '/knowledge'      },
    { id: 'd2', label: 'Deploy runbook',    href: '/cockpit'        },
    { id: 'd3', label: 'Cockpit constraints', href: '/knowledge'    },
  ],
  defaultTasks: [
    { id: 't1', label: 'Review pending PRs',         done: false, created: TODAY },
    { id: 't2', label: 'Approve staging deploys',    done: false, created: TODAY },
    { id: 't3', label: 'Triage open tickets',        done: false, created: TODAY },
  ],
  attentionRoutes: [
    { matcher: 'ticket',   href: '/cockpit/tasks'     },
    { matcher: 'deploy',   href: '/cockpit'           },
    { matcher: 'agent',    href: '/cockpit?tab=team'  },
    { matcher: 'audit',    href: '/cockpit?tab=audit' },
    { matcher: 'knowledge', href: '/knowledge'        },
  ],
  defaultDrilldown: '/cockpit',
  kpiTiles: [
    { k: 'TICKETS',  v: '8',   d: 'open · 2 awaits-user' },
    { k: 'AGENTS',   v: '7/9', d: 'active'               },
    { k: 'SLA',      v: '94%', d: '< 5 min triage'       },
    { k: 'DEPLOYS',  v: '12',  d: 'today · 1 failed'     },
  ],
};

// ─── Architect (home) — Felix ────────────────────────────────────────────
const ARCHITECT_CFG: DeptCfg = {
  slug: 'architect',
  pillTitle: 'Architect',
  hodName: 'Felix',
  hodEmoji: '🏛',
  ownerRole: 'lead',
  hodTagline: 'Ask Felix anything — he routes to the right HoD.',
  chatPlaceholder: 'e.g. ship the dept-page redesign',
  storageKeyPrefix: 'arch',
  subPages: [
    { label: 'Revenue',    href: '/revenue'    },
    { label: 'Sales',      href: '/sales'      },
    { label: 'Marketing',  href: '/marketing'  },
    { label: 'Operations', href: '/operations' },
    { label: 'Administration', href: '/finance' },
    { label: 'Guest',      href: '/guest'      },
    { label: 'IT',         href: '/it'         },
  ],
  quickChips: [
    { label: 'Revenue',    href: '/revenue'    },
    { label: 'Sales',      href: '/sales'      },
    { label: 'Marketing',  href: '/marketing'  },
    { label: 'Operations', href: '/operations' },
    { label: 'Administration', href: '/finance' },
    { label: 'Guest',      href: '/guest'      },
    { label: 'IT',         href: '/it'         },
  ],
  defaultAttn: [
    { id: 'l1', label: 'Open cockpit tickets need triage',                 severity: 'medium', kind: 'leakage'     },
    { id: 'l2', label: 'Stale deploys — staging → main approvals waiting', severity: 'low',    kind: 'leakage'     },
    { id: 'o1', label: 'Agent fleet healthy — push autonomous PRs',        severity: 'low',    kind: 'opportunity' },
  ],
  defaultDocs: [
    { id: 'd1', label: 'Cockpit overview',  href: '/cockpit'       },
    { id: 'd2', label: 'Tasks board',       href: '/cockpit/tasks' },
    { id: 'd3', label: 'Knowledge base',    href: '/knowledge'     },
  ],
  defaultTasks: [
    { id: 't1', label: 'Review pending PRs',      done: false, created: TODAY },
    { id: 't2', label: 'Approve staging deploys', done: false, created: TODAY },
    { id: 't3', label: 'Triage open tickets',     done: false, created: TODAY },
  ],
  attentionRoutes: [
    { matcher: 'ticket', href: '/cockpit/tasks' },
    { matcher: 'deploy', href: '/cockpit'       },
    { matcher: 'agent',  href: '/cockpit?tab=team' },
  ],
  defaultDrilldown: '/cockpit',
  kpiTiles: [
    { k: 'TODO',    v: '12', d: 'across all depts'    },
    { k: 'AGENTS',  v: '7',  d: 'active'              },
    { k: 'DEPLOYS', v: '4',  d: 'awaiting approval'   },
    { k: 'PROJECTS', v: '3', d: 'active'              },
  ],
};

// ─── Holding (Beyond Circle) — Felix · cross-property command ────────────
// Same DeptEntry boxes as every HoD / CEO page (My Attention · Reports ·
// Tasks · Bugs · Messages). What makes /holding distinct:
//   • customExtra='holding' injects the BC peach property-tile grid +
//     Cockpit CTA between the chat row and the boxes.
//   • hideWeather=true — temp/AQI pills are property-scoped, not holding.
//   • subPages stays empty — the global TopDeptStrip is hidden on /holding
//     (HIDE_PREFIXES) and the property tiles below the chat fill that role.
const HOLDING_CFG: DeptCfg = {
  slug: 'architect',
  pillTitle: 'Beyond Circle',
  hodName: 'Felix',
  hodEmoji: '🌐',
  ownerRole: 'lead',
  hodTagline: 'Ask Felix anything — he routes cross-property and connects HoDs.',
  chatPlaceholder: 'e.g. how are both properties trending this week?',
  storageKeyPrefix: 'hold',
  subPages: [],
  quickChips: [],
  defaultAttn: [
    { id: 'h1', label: 'Donna DCO 1/2025 · settlement window open · ≈€25k/week bleed', severity: 'high',   kind: 'leakage'     },
    { id: 'h2', label: 'Namkhan Mews tokens dead · backfill blocked on reissue',         severity: 'medium', kind: 'leakage'     },
    { id: 'h3', label: 'Donna April payroll loaded · ready for finance review',          severity: 'low',    kind: 'opportunity' },
    { id: 'h4', label: 'Sherlock Tier 1 dossiers due in 48h',                            severity: 'medium', kind: 'opportunity' },
  ],
  defaultDocs: [
    { id: 'hd1', label: 'Cockpit (operations command)', href: '/cockpit-v2' },
    { id: 'hd2', label: 'TBC public homepage',          href: '/tbc'         },
    { id: 'hd3', label: 'Knowledge base',               href: '/knowledge'   },
  ],
  defaultTasks: [
    { id: 'ht1', label: 'Confirm DCO 1/2025 casación state with Letrada Cañellas', done: false, created: TODAY, alert: true },
    { id: 'ht2', label: 'Authorise Sherlock Tier 1 dossiers (5 priority targets)',  done: false, created: TODAY               },
    { id: 'ht3', label: 'Review April Donna payroll vs March MoM',                  done: false, created: TODAY               },
  ],
  attentionRoutes: [
    { matcher: 'donna',    href: '/h/1000001'              },
    { matcher: 'namkhan',  href: '/h/260955'               },
    { matcher: 'dco',      href: '/h/1000001/finance'      },
    { matcher: 'sherlock', href: '/h/1000001/finance'      },
    { matcher: 'payroll',  href: '/h/1000001/operations/staff' },
    { matcher: 'mews',     href: '/h/260955'               },
  ],
  defaultDrilldown: '/cockpit-v2',
  kpiTiles: [
    { k: 'PROPERTIES', v: '2',     d: '1 live · 1 prospect'      },
    { k: 'AGENTS',     v: '65',    d: 'active across holding'    },
    { k: 'OPEN',       v: '3',     d: 'high-severity items'      },
    { k: 'EXPOSURE',   v: '€440k', d: 'DCO tramitación accrued'  },
  ],
  hideWeather: true,
  customExtra: 'holding',
};

// ─── Holding · Legal — Carla ─────────────────────────────────────────────
// Holding-level legal scope. Carla (role=legal_specialist_donna) is the
// holding generalist counsel — drafts memos, reviews contracts. She is
// NOT a country-specialist; she escalates Spanish/Balearic labour-law
// questions to Vera (legal_local_donna) in Donna · Finance.
const HOLDING_LEGAL_CFG: DeptCfg = {
  slug: 'architect',
  pillTitle: 'Legal · Holding',
  hodName: 'Carla',
  hodEmoji: '⚖️',
  ownerRole: 'legal_specialist_donna',
  hodTagline: 'Holding legal generalist · The Beyond Circle. Contract review and 5th-Avenue-style memos. Escalates Spanish/Balearic labour-law questions to Vera (Donna · Finance).',
  chatPlaceholder: 'e.g. summarize this contract for finance — focus on payments and renewals',
  storageKeyPrefix: 'hold-legal',
  // PBS 2026-07-07: Contracts sub-tab surfaces the Beyond Circle revenue-contract flow.
  // PBS 2026-07-08: Legal · Lao moved out of the top holding strip and into this sub-nav.
  subPages: [
    { label: 'HoD',         href: '/holding/legal'           },
    { label: 'Contracts',   href: '/holding/legal/contracts' },
    { label: 'Legal · Lao', href: '/holding/legal/lao'       },
  ],
  quickChips: [],
  defaultAttn: [
    { id: 'l1', label: 'DCO 1/2025 · 4 months elapsed · settle within 30d (€150-200k target)', severity: 'high',   kind: 'leakage'     },
    { id: 'l2', label: 'D&O / RC patronal insurer notification — confirm filed',                severity: 'high',   kind: 'leakage'     },
    { id: 'l3', label: 'Sherlock Tier 1 dossiers due in 48h',                                    severity: 'medium', kind: 'opportunity' },
    { id: 'l4', label: 'Acción de regreso draft against Five Senses SLs — file in 14d',          severity: 'medium', kind: 'opportunity' },
  ],
  defaultDocs: [
    { id: 'ld1', label: 'TOGA Assessment · DCO 1/2025',          href: '/h/1000001/finance' },
    { id: 'ld2', label: 'SHERLOCK Brief · DCO 1/2025',           href: '/h/1000001/finance' },
    { id: 'ld3', label: 'Sentencia TSJ IB 27/2026',              href: '/h/1000001/finance' },
    { id: 'ld4', label: '47-worker register + tercero matrix',   href: '/h/1000001/finance' },
  ],
  defaultTasks: [
    { id: 'lt1', label: 'Confirm casación procedural state with Letrada Cañellas', done: false, created: TODAY, alert: true },
    { id: 'lt2', label: 'Authorise Sherlock Tier 1 (5 priority targets)',           done: false, created: TODAY               },
    { id: 'lt3', label: 'Open settlement channel with UGT (floor 30%, target 35%)', done: false, created: TODAY               },
  ],
  attentionRoutes: [
    { matcher: 'dco',         href: '/h/1000001/finance' },
    { matcher: 'sherlock',    href: '/h/1000001/finance' },
    { matcher: 'd&o',         href: '/h/1000001/finance' },
    { matcher: 'regreso',     href: '/h/1000001/finance' },
    { matcher: 'casación',    href: '/h/1000001/finance' },
  ],
  defaultDrilldown: '/h/1000001/finance',
  kpiTiles: [
    { k: 'OPEN CASES', v: '1',     d: 'DCO 1/2025 · solidaria' },
    { k: 'EXPOSURE',   v: '€440k', d: 'tramitación accrued'    },
    { k: 'BLEED',      v: '€25k/wk', d: 'until readmisión'      },
    { k: 'TARGET',     v: '€150-200k', d: 'UGT settlement'      },
  ],
  hideWeather: true,
};

// ─── Holding · IT — Kit ──────────────────────────────────────────────────
// Holding-level IT scope. Kit (role=it_manager) runs platform infra.
const HOLDING_IT_CFG: DeptCfg = {
  slug: 'architect',
  pillTitle: 'IT · Holding',
  hodName: 'Kit',
  hodEmoji: '🛠',
  ownerRole: 'it_manager',
  hodTagline: 'Holding IT lead. Owns infrastructure, agent fleet, deploys, integrations.',
  chatPlaceholder: 'e.g. why did the last deploy fail? what does the cron schedule look like?',
  storageKeyPrefix: 'hold-it',
  // PBS 2026-07-09 pm: IT gets a proper sub-strip — Tasks + Cockpit + Agent Fleet + Docs.
  subPages: [
    { label: 'HoD',         href: '/holding/it'               },
    { label: 'Tasks',       href: '/cockpit/tasks'            },
    { label: 'Cockpit',     href: '/cockpit-v2'               },
    { label: 'Agent Fleet', href: '/cockpit-v2?tab=team'      },
    { label: 'Documentation', href: '/cockpit-v2?tab=docs'    },
  ],
  quickChips: [],
  defaultAttn: [
    { id: 'i1', label: 'Mews tokens dead in prod AND demo — blocked on reissue', severity: 'high',   kind: 'leakage'     },
    { id: 'i2', label: 'PDF page-splitting needed for SLH audit (>100 pages)',    severity: 'medium', kind: 'leakage'     },
    { id: 'i3', label: 'Agent fleet healthy — push autonomous PRs',               severity: 'low',    kind: 'opportunity' },
  ],
  defaultDocs: [
    { id: 'id1', label: 'Cockpit V2',                href: '/cockpit-v2'           },
    { id: 'id2', label: 'Tasks board',               href: '/cockpit/tasks'        },
    { id: 'id3', label: 'Knowledge base',            href: '/knowledge'            },
    { id: 'id4', label: 'Claude operating manual',   href: '/cockpit-v2?tab=docs'  },
  ],
  defaultTasks: [
    { id: 'it1', label: 'Wait on Mews token reissue (push side works)', done: false, created: TODAY },
    { id: 'it2', label: 'Ship parse-pdf-doc page-splitting',            done: false, created: TODAY },
    { id: 'it3', label: 'Review pending PRs',                            done: false, created: TODAY },
  ],
  attentionRoutes: [
    { matcher: 'mews',   href: '/h/260955'      },
    { matcher: 'deploy', href: '/cockpit-v2'    },
    { matcher: 'agent',  href: '/cockpit-v2?tab=team' },
    { matcher: 'pdf',    href: '/cockpit-v2?tab=docs' },
  ],
  defaultDrilldown: '/cockpit-v2',
  kpiTiles: [
    { k: 'TICKETS', v: '8',   d: 'open · 2 awaits-user'  },
    { k: 'AGENTS',  v: '65',  d: 'active'                },
    { k: 'DEPLOYS', v: '12',  d: 'today · 1 failed'      },
    { k: 'SLA',     v: '94%', d: '< 5 min triage'        },
  ],
  hideWeather: true,
};


// ─── Holding · Strategy — Fox ────────────────────────────────────────────
// Group strategy & structure advisor. Reports to Felix. Holding scope.
const HOLDING_STRATEGY_CFG: DeptCfg = {
  slug: 'architect',
  pillTitle: 'Strategy · Holding',
  hodName: 'Fox',
  hodEmoji: '🦊',
  ownerRole: 'group_strategy_advisor',
  hodTagline: 'Holding strategy & structure advisor. Group restructuring, cash-flow design, OpCo budgeting, management/lease/intercompany contract review.',
  chatPlaceholder: 'e.g. design an opco/propco split for Donna; review this management contract.',
  storageKeyPrefix: 'hold-strategy',
  subPages: [],
  quickChips: [],
  defaultAttn: [],
  defaultDocs: [
    { id: 'sd1', label: 'Cockpit (operations command)', href: '/cockpit-v2' },
    { id: 'sd2', label: 'Knowledge base',               href: '/knowledge'   },
  ],
  defaultTasks: [],
  attentionRoutes: [],
  defaultDrilldown: '/cockpit-v2',
  kpiTiles: [
    { k: 'PROJECTS', v: '—', d: 'group restructuring · ongoing' },
    { k: 'REVIEWS',  v: '—', d: 'contracts in queue'             },
  ],
  hideWeather: true,
};

// ─── Holding · Legal (Lao) — John ────────────────────────────────────────
// Lao legal & institutional-intelligence counsel · Namkhan + Luang Prabang.
// Holding scope, reports to Felix. Peer to Carla (Spain/Balearic).
const HOLDING_JOHN_CFG: DeptCfg = {
  slug: 'architect',
  pillTitle: 'Legal · Lao',
  hodName: 'John',
  hodEmoji: '⚖️',
  ownerRole: 'legal_specialist',
  hodTagline: 'Lao legal & institutional-intelligence counsel · Namkhan + Luang Prabang. Corporate / property / court structure, chain-of-command and power-mapping, Lao/English doc reading.',
  chatPlaceholder: 'e.g. who actually owns this Lao SOE? draft a 5th-Avenue memo on this Namkhan contract.',
  storageKeyPrefix: 'hold-legal-lao',
  subPages: [],
  quickChips: [],
  defaultAttn: [],
  defaultDocs: [
    { id: 'jd1', label: 'Cockpit (operations command)', href: '/cockpit-v2' },
    { id: 'jd2', label: 'Knowledge base',               href: '/knowledge'   },
  ],
  defaultTasks: [],
  attentionRoutes: [],
  defaultDrilldown: '/cockpit-v2',
  kpiTiles: [
    { k: 'JURISDICTION', v: 'LAO', d: 'Namkhan + Luang Prabang' },
    { k: 'OPEN MATTERS', v: '—',   d: 'contracts in review'      },
  ],
  hideWeather: true,
};

// ─── Holding · CEO — Felix (top-level cross-property command) ────────────
// PBS 2026-07-08: CEO surface promoted from being conceptually part of the
// holding root landing to a first-class dept. Same DeptEntry pattern.
const HOLDING_CEO_CFG: DeptCfg = {
  slug: 'architect',
  pillTitle: 'CEO · Holding',
  hodName: 'Felix',
  hodEmoji: '🌐',
  ownerRole: 'lead',
  hodTagline: 'CEO / owner scope · cross-property command · portfolio + strategy + capital.',
  chatPlaceholder: 'e.g. how is the portfolio trending? what needs my approval this week?',
  storageKeyPrefix: 'hold-ceo',
  // PBS 2026-07-09 pm: Strategy moved out of holding top strip → surfaces here.
  subPages: [
    { label: 'HoD',      href: '/holding/ceo'      },
    { label: 'Strategy', href: '/holding/strategy' },
  ],
  quickChips: [],
  defaultAttn: [
    { id: 'ceo1', label: 'Approve Donna DCO 1/2025 settlement window (€150-200k target)', severity: 'high',   kind: 'leakage'     },
    { id: 'ceo2', label: 'Namkhan portfolio pace ahead of LY · consider price ladder',    severity: 'low',    kind: 'opportunity' },
    { id: 'ceo3', label: 'Q2 board pack due in 14 days',                                   severity: 'medium', kind: 'opportunity' },
  ],
  defaultDocs: [
    { id: 'ceod1', label: 'Cockpit (operations command)', href: '/cockpit-v2' },
    { id: 'ceod2', label: 'Knowledge base',               href: '/knowledge'  },
    { id: 'ceod3', label: 'Holding overview',             href: '/holding'    },
  ],
  defaultTasks: [],
  attentionRoutes: [
    { matcher: 'dco',     href: '/h/1000001/finance' },
    { matcher: 'pace',    href: '/h/260955/revenue/pace' },
    { matcher: 'board',   href: '/holding/finance' },
  ],
  defaultDrilldown: '/cockpit-v2',
  kpiTiles: [
    { k: 'PROPERTIES', v: '2',     d: '1 live · 1 prospect'      },
    { k: 'PORTFOLIO',  v: '—',     d: 'consolidated revenue YTD' },
    { k: 'EXPOSURE',   v: '€440k', d: 'Donna DCO tramitación'    },
    { k: 'APPROVALS',  v: '3',     d: 'high-severity items'      },
  ],
  hideWeather: true,
};

// ─── Holding · Finance — invoice + settlement command ────────────────────
// PBS 2026-07-08: Holding-level finance. Distinct from per-property /finance
// which is Namkhan / Donna P&L. Here lives cross-entity invoicing (Beyond
// Circle bills DMCs, agents, partners) + running invoice numbers.
const HOLDING_FINANCE_CFG: DeptCfg = {
  slug: 'architect',
  pillTitle: 'Finance · Holding',
  hodName: 'Felix',
  hodEmoji: '💶',
  ownerRole: 'lead',
  hodTagline: 'Holding finance · issue invoices to DMCs / partners / third parties · running invoice numbers.',
  chatPlaceholder: 'e.g. generate an invoice for X for Y amount.',
  storageKeyPrefix: 'hold-finance',
  // PBS 2026-07-08: Invoices + editable Template.
  // PBS 2026-07-09: + Clients (simple CRM). Template moved UNDER Invoices sub-menu
  // (Create · Send log · Template) — no longer surfaces at the top level.
  subPages: [
    { label: 'HoD',      href: '/holding/finance'          },
    { label: 'Invoices', href: '/holding/finance/invoices' },
    { label: 'Clients',  href: '/holding/finance/clients'  },
  ],
  quickChips: [],
  defaultAttn: [],
  defaultDocs: [
    { id: 'hfd1', label: 'Invoice generator', href: '/holding/finance/invoices' },
    { id: 'hfd2', label: 'Cockpit (operations command)', href: '/cockpit-v2' },
  ],
  defaultTasks: [],
  attentionRoutes: [],
  defaultDrilldown: '/holding/finance/invoices',
  kpiTiles: [
    { k: 'INVOICES', v: '—', d: 'issued YTD' },
    { k: 'OUTSTAND', v: '—', d: 'unpaid'      },
    { k: 'THIS MO',  v: '—', d: 'net billed'  },
    { k: 'NEXT NO',  v: '—', d: 'running seq' },
  ],
  hideWeather: true,
};

export const DEPT_CFG = {
  revenue:    REVENUE_CFG,
  sales:      SALES_CFG,
  marketing:  MARKETING_CFG,
  operations: OPERATIONS_CFG,
  guest:      GUEST_CFG,
  finance:    FINANCE_CFG,
  it:         IT_CFG,
  architect:  ARCHITECT_CFG,
  holding:           HOLDING_CFG,
  holding_ceo:       HOLDING_CEO_CFG,
  holding_legal:     HOLDING_LEGAL_CFG,
  holding_it:        HOLDING_IT_CFG,
  holding_strategy:  HOLDING_STRATEGY_CFG,
  holding_john:      HOLDING_JOHN_CFG,
  holding_finance:   HOLDING_FINANCE_CFG,
} as const;

export type { DeptCfg } from './types';