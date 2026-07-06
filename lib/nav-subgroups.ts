// lib/nav-subgroups.ts
// PBS 2026-07-07: Sub-tab groups. When a page's URL is in `members`, the
// DashboardPage sticky region renders `tabs` as a second row below the main strip.
//
// Structure lives here so both dept-cfg and DashboardPage can consult one source.

export interface SubGroup {
  parentHref: string;                              // canonical landing for the group
  members: string[];                               // URLs that show this subgroup
  tabs: { label: string; href: string }[];         // children rendered in the sub-strip
}

export const NAV_SUBGROUPS: SubGroup[] = [
  // ─── Revenue ──────────────────────────────────────────────
  // PBS 2026-07-07 evening: Overview parent moved to /revenue/overview (was /revenue).
  // /revenue is now the HoD chat cockpit and does not carry Overview sub-tabs.
  {
    parentHref: '/revenue/overview',
    members: ['/revenue/overview', '/revenue/pulse', '/revenue/pricing'],
    tabs: [
      { label: 'Pulse',    href: '/revenue/pulse'   },
      { label: 'Calendar', href: '/revenue/pricing' },
    ],
  },
  {
    parentHref: '/revenue/demand',
    members: ['/revenue/demand', '/revenue/pace', '/revenue/pickup', '/revenue/cancellations'],
    tabs: [
      { label: 'Demand',        href: '/revenue/demand'        },
      { label: 'Pace',          href: '/revenue/pace'          },
      { label: 'Pickup',        href: '/revenue/pickup'        },
      { label: 'Cancellations', href: '/revenue/cancellations' },
    ],
  },
  {
    parentHref: '/revenue/rooms',
    members: ['/revenue/rooms', '/revenue/channels', '/revenue/rateplans', '/revenue/markets'],
    tabs: [
      { label: 'Rooms',      href: '/revenue/rooms'     },
      { label: 'Channels',   href: '/revenue/channels'  },
      { label: 'Rate Plans', href: '/revenue/rateplans' },
      { label: 'Markets',    href: '/revenue/markets'   },
    ],
  },
  {
    parentHref: '/revenue/compset',
    members: ['/revenue/compset', '/revenue/leakage', '/revenue/parity'],
    tabs: [
      { label: 'Comp Set', href: '/revenue/compset' },
      { label: 'Leakage',  href: '/revenue/leakage' },
      { label: 'Parity',   href: '/revenue/parity'  },
    ],
  },

  // ─── Marketing ────────────────────────────────────────────
  // PBS 2026-07-07 evening: Overview parent moved to /marketing/overview (was /marketing).
  // /marketing is now the HoD chat cockpit.
  {
    parentHref: '/marketing/overview',
    members: ['/marketing/overview'],
    tabs: [
      { label: 'Info',    href: '/marketing/library' },
      { label: 'Reports', href: '/h/260955/reports?dept=marketing' },
    ],
  },
  {
    parentHref: '/marketing/acquisition',
    members: ['/marketing/acquisition', '/marketing/campaigns', '/marketing/funnels', '/marketing/prospects', '/guest/prospects'],
    tabs: [
      { label: 'Campaigns', href: '/marketing/campaigns' },
      { label: 'Funnels',   href: '/marketing/funnels'   },
      { label: 'Prospects', href: '/guest/prospects'     },
    ],
  },
  {
    parentHref: '/marketing/offers',
    members: ['/marketing/offers', '/marketing/compiler'],
    tabs: [
      { label: 'Compiler', href: '/marketing/compiler' },
    ],
  },
  {
    parentHref: '/marketing/content',
    members: ['/marketing/content', '/marketing/gallery', '/marketing/social'],
    tabs: [
      { label: 'Media',  href: '/marketing/gallery' },
      { label: 'Social', href: '/marketing/social'  },
    ],
  },
  {
    parentHref: '/marketing/digital',
    members: ['/marketing/digital', '/marketing/web'],
    tabs: [
      { label: 'Web', href: '/marketing/web' },
    ],
  },
  {
    parentHref: '/marketing/library',
    members: ['/marketing/library', '/marketing/docs'],
    tabs: [
      { label: 'Docs', href: '/marketing/docs' },
    ],
  },

  // ─── Finance (PBS 2026-07-07 consolidation) ───────────────
  // Overview parent stands alone (no children yet, but included so future
  // sub-tabs can be added without another wiring pass).
  {
    parentHref: '/finance/overview',
    members: ['/finance/overview'],
    tabs: [
      { label: 'Overview', href: '/finance/overview' },
    ],
  },
  // Finance parent → P&L / Ledger / Account mapping
  {
    parentHref: '/finance/pnl',
    members: ['/finance/pnl', '/finance/ledger', '/finance/mapping'],
    tabs: [
      { label: 'P&L',             href: '/finance/pnl'     },
      { label: 'Ledger',          href: '/finance/ledger'  },
      { label: 'Account mapping', href: '/finance/mapping' },
    ],
  },
  // Transactions parent → Transactions / POS · PMS / POS · Poster
  {
    parentHref: '/finance/transactions',
    members: ['/finance/transactions', '/finance/pos-transactions', '/finance/poster'],
    tabs: [
      { label: 'Transactions', href: '/finance/transactions'     },
      { label: 'POS · PMS',    href: '/finance/pos-transactions' },
      { label: 'POS · Poster', href: '/finance/poster'           },
    ],
  },
  // Working capital parent → Cashflow / Variance / AP / AR
  {
    parentHref: '/finance/cashflow',
    members: ['/finance/cashflow', '/finance/variance', '/finance/apar'],
    tabs: [
      { label: 'Cashflow', href: '/finance/cashflow' },
      { label: 'Variance', href: '/finance/variance' },
      { label: 'AP / AR',  href: '/finance/apar'     },
    ],
  },
];

export function findSubGroup(pathname: string): SubGroup | null {
  for (const g of NAV_SUBGROUPS) {
    if (g.members.includes(pathname)) return g;
  }
  return null;
}
