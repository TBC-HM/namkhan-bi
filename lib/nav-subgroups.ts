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
  // PBS 2026-07-08: Pickup Month/Day dropped from nav-subgroups. Was causing
  // the Demand & Pace strip to disappear when landing on /revenue/pickup.
  // Month/Day is now rendered inline inside the Pickup page body (like a
  // /pricing-tab strip), so Pickup keeps the Demand | Pace | Pickup |
  // Cancellations sub-strip while still switching Month ↔ Day.
  {
    parentHref: '/revenue/demand',
    members: ['/revenue/demand', '/revenue/pace', '/revenue/pickup', '/revenue/pickup-day', '/revenue/cancellations'],
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
    // PBS 2026-07-09 pm: Performance order — Channels · Rate Plans · Markets · Rooms.
    tabs: [
      { label: 'Channels',   href: '/revenue/channels'  },
      { label: 'Rate Plans', href: '/revenue/rateplans' },
      { label: 'Markets',    href: '/revenue/markets'   },
      { label: 'Rooms',      href: '/revenue/rooms'     },
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
    // PBS 2026-07-09 pm (reverted): Strategy pulled BACK OUT of Market & Control.
    // Belongs only under /holding/ceo subPages.
    tabs: [
      { label: 'Comp Set',   href: '/revenue/compset'              },
      { label: 'Comp Rates', href: '/revenue/lighthouse/overview'  },
      { label: 'Parity',     href: '/revenue/parity'               },
      { label: 'Leakage',    href: '/revenue/leakage'              },
    ],
  },
  // PBS 2026-08-05 (F8): Forecast sub-tabs — Forecast (main summary) + Scenarios.
  // Property-scoped only (/h/[pid]/revenue/forecast).
  {
    parentHref: '/revenue/forecast',
    members: ['/revenue/forecast', '/revenue/forecast/scenarios'],
    tabs: [
      { label: 'Forecast',  href: '/revenue/forecast'           },
      { label: 'Scenarios', href: '/revenue/forecast/scenarios' },
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
  // PBS 2026-07-09 pm: QA sub-strip — SOPs + Registry + Proposals + Generate.
  {
    parentHref: '/operations/sops',
    members: [
      '/operations/sops', '/operations/qa',
      '/operations/qa/registry', '/operations/qa/proposals',
      '/operations/qa/generate', '/operations/qa/agent-instructions',
    ],
    tabs: [
      { label: 'SOPs',               href: '/operations/sops'                  },
      { label: 'QA registry',        href: '/operations/qa/registry'           },
      { label: 'Proposals',          href: '/operations/qa/proposals'          },
      { label: 'Generate',           href: '/operations/qa/generate'           },
      { label: 'Agent instructions', href: '/operations/qa/agent-instructions' },
    ],
  },
  {
    parentHref: '/operations/rooms',
    members: [
      '/operations/rooms',
      '/operations/restaurant',
      '/operations/spa',
      '/operations/sports',
      '/operations/wellness',
      '/operations/dive',
      '/operations/events',
    ],
    tabs: [
      { label: 'Rooms',      href: '/operations/rooms'      },
      { label: 'Restaurant', href: '/operations/restaurant' },
      { label: 'Spa',        href: '/operations/spa'        },
      { label: 'Sports',     href: '/operations/sports'     },
      { label: 'Wellness',   href: '/operations/wellness'   },
      { label: 'Dive',       href: '/operations/dive'       },
      { label: 'Events',     href: '/operations/events'     },
    ],
  },
  {
    parentHref: '/operations/inventory',
    members: [
      '/operations/inventory',
      '/operations/suppliers',
      '/operations/catalog-cleanup',
    ],
    tabs: [
      { label: 'Inventory',        href: '/operations/inventory'        },
      { label: 'Suppliers',        href: '/operations/suppliers'        },
      { label: 'Catalog cleanup',  href: '/operations/catalog-cleanup'  },
    ],
  },

  // ─── Guest ────────────────────────────────────────────────
  {
    parentHref: '/guest/stay-timeline',
    members: ['/guest/stay-timeline', '/guest/repeat', '/guest/preferences', '/guest/conversations'],
    tabs: [
      { label: 'Timeline',      href: '/guest/stay-timeline'    },
      { label: 'Repeat',        href: '/guest/repeat'           },
      { label: 'Preferences',   href: '/guest/preferences'      },
      { label: 'Conversations', href: '/guest/conversations'    },
    ],
  },

  // ─── Finance ──────────────────────────────────────────────
  {
    parentHref: '/finance/hr',
    members: ['/finance/hr', '/finance/hr/recruitment', '/finance/hr/onboarding', '/finance/hr/holidays', '/finance/hr/offboarding', '/finance/hr/payroll', '/finance/hr/staff'],
    tabs: [
      { label: 'Overview',    href: '/finance/hr'              },
      { label: 'Recruitment', href: '/finance/hr/recruitment'  },
      { label: 'Onboarding',  href: '/finance/hr/onboarding'   },
      { label: 'Holidays',    href: '/finance/hr/holidays'     },
      { label: 'Offboarding', href: '/finance/hr/offboarding'  },
      { label: 'Payroll',     href: '/finance/hr/payroll'      },
      { label: 'Staff',       href: '/finance/hr/staff'        },
    ],
  },
  {
    parentHref: '/finance/procurement',
    members: ['/finance/procurement', '/finance/procurement/approval-needed', '/finance/procurement/archive'],
    tabs: [
      { label: 'Procurement',      href: '/finance/procurement'                  },
      { label: 'Approval needed',  href: '/finance/procurement/approval-needed'  },
      { label: 'Archive',          href: '/finance/procurement/archive'          },
    ],
  },

  // ─── Sales ────────────────────────────────────────────────
  {
    parentHref: '/sales/pipeline',
    members: ['/sales/pipeline', '/sales/accounts', '/sales/history'],
    tabs: [
      { label: 'Pipeline', href: '/sales/pipeline' },
      { label: 'Accounts', href: '/sales/accounts' },
      { label: 'History',  href: '/sales/history'  },
    ],
  },

  // ─── Marketing ────────────────────────────────────────────
  {
    parentHref: '/marketing/campaigns',
    members: ['/marketing/campaigns', '/marketing/ads', '/marketing/email', '/marketing/social', '/marketing/content'],
    tabs: [
      { label: 'Campaigns', href: '/marketing/campaigns' },
      { label: 'Ads',       href: '/marketing/ads'       },
      { label: 'Email',     href: '/marketing/email'     },
      { label: 'Social',    href: '/marketing/social'    },
      { label: 'Content',   href: '/marketing/content'   },
    ],
  },
  // PBS 2026-07-17: Newsletter sub-tabs (Newsletter · Archive · Templates)
  {
    parentHref: '/marketing/newsletter',
    members: ['/marketing/newsletter', '/marketing/newsletter/archive', '/marketing/newsletter/templates'],
    tabs: [
      { label: 'Newsletter', href: '/marketing/newsletter'           },
      { label: 'Archive',    href: '/marketing/newsletter/archive'   },
      { label: 'Templates',  href: '/marketing/newsletter/templates' },
    ],
  },

  // ─── IT ───────────────────────────────────────────────────
  {
    parentHref: '/it/network',
    members: ['/it/network', '/it/servers', '/it/security', '/it/support'],
    tabs: [
      { label: 'Network',  href: '/it/network'  },
      { label: 'Servers',  href: '/it/servers'  },
      { label: 'Security', href: '/it/security' },
      { label: 'Support',  href: '/it/support'  },
    ],
  },

  // ─── Holding ──────────────────────────────────────────────
  {
    parentHref: '/holding/ceo',
    members: ['/holding/ceo', '/holding/ceo/dashboard', '/holding/ceo/board', '/holding/ceo/calendar', '/holding/ceo/strategy', '/holding/ceo/goals'],
    tabs: [
      { label: 'CEO',      href: '/holding/ceo'           },
      { label: 'Dashboard',href: '/holding/ceo/dashboard' },
      { label: 'Board',    href: '/holding/ceo/board'     },
      { label: 'Calendar', href: '/holding/ceo/calendar'  },
      { label: 'Strategy', href: '/holding/ceo/strategy'  },
      { label: 'Goals',    href: '/holding/ceo/goals'     },
    ],
  },
  // PBS 2026-07-17: IT2 sub-tabs (Modules · Spec Source + Brain Chat from July PR move)
  {
    parentHref: '/holding/it2/modules',
    members: ['/holding/it2/modules', '/holding/it2/modules/specs', '/holding/it2/brain'],
    tabs: [
      { label: 'Modules',      href: '/holding/it2/modules'       },
      { label: 'Spec source',  href: '/holding/it2/modules/specs' },
      { label: 'Brain chat',   href: '/holding/it2/brain'         },
    ],
  },
];

// ─── Path utilities ───────────────────────────────────────────────────────

export function findSubGroup(pathname: string): SubGroup | undefined {
  const clean = pathname.split('?')[0];
  const { unprefixedPath } = stripTenantPrefix(clean);
  for (const grp of NAV_SUBGROUPS) {
    // First check members against the stripped path (so /h/260955/revenue/forecast
    // matches /revenue/forecast in members).
    if (grp.members.includes(unprefixedPath)) return grp;
    // Then check against the original clean (allows /h/260955/... prefixed paths
    // in members too).
    if (grp.members.includes(clean)) return grp;
  }
  return undefined;
}

export function prefixTabHref(pathname: string, href: string): string {
  const { tenantPrefix } = stripTenantPrefix(pathname);
  if (!tenantPrefix) return href;
  if (href.startsWith('/h/')) return href; // already prefixed
  if (href.startsWith('/'))  return tenantPrefix + href;
  return href;
}

/**
 * Given /h/260955/revenue/forecast?win=30d, returns:
 *   { tenantPrefix: '/h/260955', unprefixedPath: '/revenue/forecast' }
 * Given /revenue/pulse, returns:
 *   { tenantPrefix: '', unprefixedPath: '/revenue/pulse' }
 */
export function stripTenantPrefix(pathname: string): { tenantPrefix: string; unprefixedPath: string } {
  const clean = pathname.split('?')[0];
  const m = clean.match(/^(\/h\/\d+)(\/.*)?$/);
  if (!m) return { tenantPrefix: '', unprefixedPath: clean };
  return { tenantPrefix: m[1], unprefixedPath: m[2] ?? '/' };
}
