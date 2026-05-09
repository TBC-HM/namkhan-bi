// lib/dept-cfg/index.ts
// 2026-05-08 — every dept entry page reads its config from here. PBS
// design directive: each dept has the same entry layout as /revenue,
// adapted with its own data, HoD voice, sub-pages, defaults.

import type { DeptCfg } from './types';

// ─── Revenue ─────────────────────────────────────────────────────────────
const REVENUE_REPORT_TYPES: NonNullable<DeptCfg['reportTypes']> = [
  { value: 'pulse', label: 'Pulse', hrefBase: '/revenue/reports/pulse', dimGroups: [
    { key: 'window',  label: 'Window',  options: [
      { value: 'today',     label: 'Today'    },
      { value: 'last_7d',   label: 'Last 7d'  },
      { value: 'last_30d',  label: 'Last 30d' },
      { value: 'mtd',       label: 'MTD'      },
      { value: 'ytd',       label: 'YTD'      },
    ]},
    { key: 'compare', label: 'Compare', options: [
      { value: 'sdly',   label: 'SDLY'        },
      { value: 'stly',   label: 'STLY'        },
      { value: 'lw',     label: 'Last week'   },
      { value: 'lm',     label: 'Last month'  },
      { value: 'ly',     label: 'LY'          },
      { value: 'budget', label: 'Budget'      },
    ]},
    { key: 'segment', label: 'Segment', options: [
      { value: 'all',    label: 'All'        },
      { value: 'room',   label: 'Room type'  },
      { value: 'source', label: 'Source'     },
      { value: 'rate',   label: 'Rate plan'  },
    ]},
  ]},
  { value: 'pace', label: 'Pace', hrefBase: '/revenue/reports/pace', dimGroups: [
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
  { value: 'channels', label: 'Channels', hrefBase: '/revenue/reports/channels', dimGroups: [
    { key: 'window', label: 'Window', options: [
      { value: 'last_7d',  label: 'Last 7d'  },
      { value: 'last_30d', label: 'Last 30d' },
      { value: 'last_90d', label: 'Last 90d' },
      { value: 'mtd',      label: 'MTD'      },
      { value: 'ytd',      label: 'YTD'      },
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
    { key: 'compare', label: 'Compare', options: [
      { value: 'stly', label: 'STLY' },
      { value: 'ly',   label: 'LY'   },
      { value: 'lm',   label: 'Last month' },
    ]},
  ]},
  { value: 'pricing', label: 'Pricing', hrefBase: '/revenue/reports/pricing', dimGroups: [
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
  { value: 'comp_set', label: 'Comp Set', hrefBase: '/revenue/reports/comp_set', dimGroups: [
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
  { value: 'forecast', label: 'Forecast', hrefBase: '/revenue/reports/forecast', dimGroups: [
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
  { value: 'all', label: 'All revenue', hrefBase: '/revenue', dimGroups: [
    { key: 'window', label: 'Window', options: [
      { value: 'last_7d',  label: 'Last 7d'  },
      { value: 'last_30d', label: 'Last 30d' },
      { value: 'mtd',      label: 'MTD'      },
      { value: 'ytd',      label: 'YTD'      },
    ]},
    { key: 'compare', label: 'Compare', options: [
      { value: 'stly',   label: 'STLY'   },
      { value: 'budget', label: 'Budget' },
    ]},
  ]},
];

const TODAY = new Date().toISOString().slice(0, 10);

const REVENUE_CFG: DeptCfg = {
  slug: 'revenue',
  pillTitle: 'Revenue',
  hodName: 'Vector',
  hodEmoji: '⚓',
  ownerRole: 'revenue_hod',
  hodTagline: 'Ask Vector anything about revenue.',
  chatPlaceholder: 'e.g. how are we pacing for next weekend?',
  storageKeyPrefix: 'rev',
  subPages: [
    // PBS 2026-05-09 (repair-list 11): Agents only reachable via /cockpit.
    { label: 'Pulse',      href: '/revenue/pulse'     },
    { label: 'Pace',       href: '/revenue/pace'      },
    { label: 'Channels',   href: '/revenue/channels'  },
    { label: 'Rate Plans', href: '/revenue/rateplans' },
    { label: 'Pricing',    href: '/revenue/pricing'   },
    { label: 'Comp Set',   href: '/revenue/compset'   },
    { label: 'Parity',     href: '/revenue/parity'    },
  ],
  quickChips: [
    { label: 'Pulse',    href: '/revenue/pulse'    },
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
  defaultDocs: [
    { id: 'd1', label: 'Revenue Strategy 2026',         href: '/revenue/strategy'    },
    { id: 'd2', label: 'Channel Mix Report — Apr 2026', href: '/revenue/channel-mix' },
    { id: 'd3', label: 'BAR Rate Grid',                 href: '/revenue/bar'         },
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
    // PBS 2026-05-09: BTB is the unified MICE / DMC / Retreats / Groups
    // command page. /sales/b2b stays for the deep DMC-contracts +
    // LPA-reconciliation flow but is no longer in the dept menu.
    { label: 'Inquiries', href: '/sales/inquiries' },
    { label: 'Leads',     href: '/sales/leads'     },
    { label: 'BTB',       href: '/sales/btb'       },
    { label: 'Groups',    href: '/sales/groups'    },
    { label: 'FIT',       href: '/sales/fit'       },
    { label: 'Packages',  href: '/sales/packages'  },
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
  subPages: [
    // PBS 2026-05-09 (repair-list 11): Agents only reachable via /cockpit.
    // PBS 2026-05-09 (new): Events schedule joins the strip — drives demand,
    // marketing brief, content + retreat planning.
    { label: 'Snapshot',    href: '/marketing'             },
    { label: 'Events',      href: '/marketing/events'      },
    { label: 'Audiences',   href: '/marketing/audiences'   },
    { label: 'Library',     href: '/marketing/library'     },
    { label: 'Campaigns',   href: '/marketing/campaigns'   },
    { label: 'Compiler',    href: '/marketing/compiler'    },
    { label: 'Social',      href: '/marketing/social'      },
    { label: 'Influencers', href: '/marketing/influencers' },
    { label: 'Taxonomy',    href: '/marketing/taxonomy'    },
  ],
  quickChips: [
    { label: 'Snapshot',  href: '/marketing'             },
    { label: 'Library',   href: '/marketing/library'     },
    { label: 'Campaigns', href: '/marketing/campaigns'   },
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
  subPages: [
    { label: 'Snapshot',         href: '/operations'                 },
    { label: 'Staff',            href: '/operations/staff'           },
    { label: 'F&B',              href: '/operations/restaurant'      },
    { label: 'Spa',              href: '/operations/spa'             },
    { label: 'Activities',       href: '/operations/activities'      },
    { label: 'Events',           href: '/operations/events'          },
    { label: 'Inventory',        href: '/operations/inventory'       },
    { label: 'Suppliers',        href: '/operations/suppliers'       },
    { label: 'Catalog cleanup',  href: '/operations/catalog-cleanup' },
  ],
  quickChips: [
    { label: 'Snapshot',   href: '/operations'             },
    { label: 'Staff',      href: '/operations/staff'       },
    { label: 'F&B',        href: '/operations/restaurant'  },
    { label: 'Spa',        href: '/operations/spa'         },
    { label: 'Activities', href: '/operations/activities'  },
    { label: 'Inventory',  href: '/operations/inventory'   },
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
    { matcher: 'catalog',    href: '/operations/catalog-cleanup' },
  ],
  defaultDrilldown: '/operations',
  kpiTiles: [
    { k: 'OCC TODAY',  v: '24/30', d: 'incl. 2 walk-ins'    },
    { k: 'F&B COVERS', v: '38',    d: 'lunch · today'       },
    { k: 'SPA',        v: '6/8',   d: 'slots used today'    },
    { k: 'INV ALERTS', v: '3',     d: 'below par'           },
  ],
};

// ─── Guest — Felix (no formal HoD; PBS uses Felix here) ──────────────────
const GUEST_CFG: DeptCfg = {
  slug: 'guest',
  pillTitle: 'Guest',
  hodName: 'Felix',
  hodEmoji: '★',
  ownerRole: 'lead',
  hodTagline: 'Ask Felix anything about the guest journey.',
  chatPlaceholder: 'e.g. who is checking in this evening?',
  storageKeyPrefix: 'gst',
  subPages: [
    // PBS 2026-05-09 (repair-list 11): Agents only reachable via /cockpit.
    { label: 'Snapshot',    href: '/guest'             },
    { label: 'Directory',   href: '/guest/directory'   },
    { label: 'Reputation',  href: '/guest/reputation'  },
    { label: 'Journey',     href: '/guest/journey'     },
    { label: 'Loyalty',     href: '/guest/loyalty'     },
    { label: 'Messy data',  href: '/guest/messy-data'  },
    { label: 'Findings',    href: '/guest/findings'    },
  ],
  quickChips: [
    { label: 'Snapshot',   href: '/guest'            },
    { label: 'Directory',  href: '/guest/directory'  },
    { label: 'Reputation', href: '/guest/reputation' },
    { label: 'Journey',    href: '/guest/journey'    },
    { label: 'Loyalty',    href: '/guest/loyalty'    },
    { label: 'Findings',   href: '/guest/findings'   },
  ],
  defaultAttn: [
    { id: 'l1', label: 'Negative review on TripAdvisor — needs reply', severity: 'high',   kind: 'leakage'     },
    { id: 'l2', label: 'No-show rate +3pp vs last month',              severity: 'medium', kind: 'leakage'     },
    { id: 'o1', label: 'Returning guest arriving — VIP gesture due',   severity: 'medium', kind: 'opportunity' },
    { id: 'o2', label: 'Loyalty member 3rd stay — upgrade window',     severity: 'low',    kind: 'opportunity' },
  ],
  defaultDocs: [
    { id: 'd1', label: 'Guest Journey Map 2026', href: '/guest/journey'    },
    { id: 'd2', label: 'Loyalty tier playbook',  href: '/guest/loyalty'    },
    { id: 'd3', label: 'Pre-arrival template',   href: '/guest/directory'  },
  ],
  defaultTasks: [
    { id: 't1', label: 'Reply to TripAdvisor review',         done: false, created: TODAY },
    { id: 't2', label: 'Brief team on tonight\'s VIP arrival', done: false, created: TODAY },
    { id: 't3', label: 'Confirm loyalty upgrade for room 12', done: false, created: TODAY },
  ],
  attentionRoutes: [
    { matcher: 'review',     href: '/guest/reputation' },
    { matcher: 'reputation', href: '/guest/reputation' },
    { matcher: 'no-show',    href: '/guest/findings'   },
    { matcher: 'directory',  href: '/guest/directory'  },
    { matcher: 'journey',    href: '/guest/journey'    },
    { matcher: 'loyalty',    href: '/guest/loyalty'    },
    { matcher: 'vip',        href: '/guest/directory'  },
  ],
  defaultDrilldown: '/guest',
  kpiTiles: [
    { k: 'NPS',     v: '64',  d: 'last 30d'         },
    { k: 'REPUTE',  v: '4.7', d: 'all channels'     },
    { k: 'LOYALTY', v: '18%', d: 'repeat share'     },
    { k: 'NO-SHOW', v: '2.1%', d: '+0.6pp vs LM'    },
  ],
};

// ─── Finance — Intel ─────────────────────────────────────────────────────
const FINANCE_CFG: DeptCfg = {
  slug: 'finance',
  pillTitle: 'Finance',
  hodName: 'Intel',
  hodEmoji: '$',
  ownerRole: 'finance_hod',
  hodTagline: 'Ask Intel anything about the books.',
  chatPlaceholder: 'e.g. how is GOP tracking vs budget?',
  storageKeyPrefix: 'fin',
  subPages: [
    { label: 'Snapshot',         href: '/finance'                  },
    { label: 'P&L',              href: '/finance/pnl'              },
    { label: 'Ledger',           href: '/finance/ledger'           },
    { label: 'Transactions',     href: '/finance/transactions'     },
    { label: 'POS · Cloudbeds',  href: '/finance/pos-transactions' },
    { label: 'POS · Poster',     href: '/finance/poster'           },
    { label: 'Account mapping',  href: '/finance/mapping'          },
    { label: 'Supplier mapping', href: '/finance/supplier-mapping' },
    { label: 'Budget',           href: '/finance/budget'           },
  ],
  quickChips: [
    { label: 'Snapshot',     href: '/finance'              },
    { label: 'P&L',          href: '/finance/pnl'          },
    { label: 'Ledger',       href: '/finance/ledger'       },
    { label: 'Transactions', href: '/finance/transactions' },
    { label: 'Budget',       href: '/finance/budget'       },
    { label: 'Mapping',      href: '/finance/mapping'      },
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
    { matcher: 'pos',        href: '/finance/pos-transactions' },
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
    { label: 'Finance',    href: '/finance'    },
    { label: 'Guest',      href: '/guest'      },
    { label: 'IT',         href: '/it'         },
  ],
  quickChips: [
    { label: 'Revenue',    href: '/revenue'    },
    { label: 'Sales',      href: '/sales'      },
    { label: 'Marketing',  href: '/marketing'  },
    { label: 'Operations', href: '/operations' },
    { label: 'Finance',    href: '/finance'    },
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

export const DEPT_CFG = {
  revenue:    REVENUE_CFG,
  sales:      SALES_CFG,
  marketing:  MARKETING_CFG,
  operations: OPERATIONS_CFG,
  guest:      GUEST_CFG,
  finance:    FINANCE_CFG,
  it:         IT_CFG,
  architect:  ARCHITECT_CFG,
} as const;

export type { DeptCfg } from './types';
