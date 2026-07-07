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
  // PBS 2026-07-07 night: Overview tab lands on /revenue/pulse. Sub-strip surfaces
  // Calendar (Pulse itself hidden by sibling filter in DashboardPage).
  {
    parentHref: '/revenue/pulse',
    members: ['/revenue/pulse', '/revenue/pricing'],
    tabs: [
      { label: 'Pulse',    href: '/revenue/pulse'   },
      { label: 'Calendar', href: '/revenue/pricing' },
    ],
  },
  // PBS 2026-07-07 pm: Pickup gets its own Month/Day sub-strip. Must come BEFORE
  // the Demand & Pace group (findSubGroup returns first match); /revenue/pickup
  // therefore removed from that group's members list below.
  {
    parentHref: '/revenue/pickup',
    members: ['/revenue/pickup', '/revenue/pickup-day'],
    tabs: [
      { label: 'Month', href: '/revenue/pickup'     },
      { label: 'Day',   href: '/revenue/pickup-day' },
    ],
  },
  {
    parentHref: '/revenue/demand',
    members: ['/revenue/demand', '/revenue/pace', '/revenue/cancellations'],
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
    members: [
      '/revenue/compset', '/revenue/leakage', '/revenue/parity',
      '/revenue/lighthouse',
      '/revenue/lighthouse/overview', '/revenue/lighthouse/rates',
      '/revenue/lighthouse/vs-yesterday', '/revenue/lighthouse/vs-3d', '/revenue/lighthouse/vs-7d',
    ],
    tabs: [
      { label: 'Comp Set',   href: '/revenue/compset'              },
      { label: 'Leakage',    href: '/revenue/leakage'              },
      { label: 'Parity',     href: '/revenue/parity'               },
      { label: 'Lighthouse', href: '/revenue/lighthouse/overview'  },
    ],
  },

  // ─── Operations ───────────────────────────────────────────
  // PBS 2026-07-07 night: Overview parent gets Docs as a sub-tab (Docs was
  // dropped from the top strip earlier and PBS wants it accessible from Overview).
  {
    parentHref: '/operations/overview',
    members: ['/operations/overview', '/operations/docs'],
    tabs: [
      { label: 'Docs', href: '/operations/docs' },
    ],
  },
  {
    parentHref: '/operations/rooms',
    members: [
      '/operations/rooms',
      '/operations/restaurant',
      '/operations/spa',
      '/operations/activities',
      '/operations/retail',
      '/operations/transport',
      '/operations/other',
    ],
    tabs: [
      { label: 'Rooms',      href: '/operations/rooms'      },
      { label: 'F&B',        href: '/operations/restaurant' },
      { label: 'Spa',        href: '/operations/spa'        },
      { label: 'Activities', href: '/operations/activities' },
      { label: 'Retail',     href: '/operations/retail'     },
      { label: 'Transport',  href: '/operations/transport'  },
      { label: 'Other',      href: '/operations/other'      },
    ],
  },

  // ─── Marketing ────────────────────────────────────────────
  // PBS 2026-07-07 night: Overview lands on /marketing/library. Info sub-tab
  // removed; Library + Docs sit directly under Overview alongside Reports.
  {
    parentHref: '/marketing/library',
    members: ['/marketing/library', '/marketing/docs'],
    tabs: [
      { label: 'Library', href: '/marketing/library' },
      { label: 'Docs',    href: '/marketing/docs'    },
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
  // PBS 2026-07-07 night: Content lands on /marketing/gallery (Media) directly,
  // not the empty stub. Sub-strip shows Social (Media hidden by sibling filter).
  {
    parentHref: '/marketing/gallery',
    members: ['/marketing/gallery', '/marketing/social'],
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
  // (The old /marketing/library standalone subgroup is now merged into Overview
  //  above — Library + Docs live directly under Overview.)

  // ─── Administration (Finance) ─────────────────────────────
  // PBS 2026-07-07 night: sub-tabs also show on /finance HoD + /finance/overview
  // so P&L/Ledger/Transactions/Budget are visible even before you click Finance.
  {
    parentHref: '/finance/pnl',
    members: ['/finance', '/finance/overview', '/finance/pnl', '/finance/ledger', '/finance/transactions', '/finance/budget'],
    tabs: [
      { label: 'P&L',          href: '/finance/pnl'          },
      { label: 'Ledger',       href: '/finance/ledger'       },
      { label: 'Transactions', href: '/finance/transactions' },
      { label: 'Budget',       href: '/finance/budget'       },
    ],
  },
];

export function findSubGroup(pathname: string): SubGroup | null {
  for (const g of NAV_SUBGROUPS) {
    if (g.members.includes(pathname)) return g;
  }
  return null;
}
