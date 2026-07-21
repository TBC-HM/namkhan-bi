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
  // PBS 2026-07-21: /marketing/{content,channels,digital} become nav-hubs.
  // Their bodies are empty (link-card grids removed); the sub-strip IS the nav.
  // Order matters — findSubGroup returns FIRST match. Digital MUST precede
  // Channels so /marketing/digital lands on Digital's sub-strip (Web/Funnels/SEO)
  // instead of Channels' three-tab strip. Content is placed first because its
  // members (offers/compiler/campaigns/newsletter/media) must beat the legacy
  // /marketing/acquisition subgroup below on /marketing/campaigns.
  {
    // PBS 2026-07-21 · Content sub-strip · replaces box grid on /marketing/content hub
    parentHref: '/marketing/content',
    members: [
      '/marketing/content',
      '/marketing/offers',
      '/marketing/compiler',
      '/marketing/campaigns',
      '/marketing/newsletter',
      '/marketing/media',
    ],
    tabs: [
      { label: 'Products & Offers', href: '/marketing/offers'     },
      { label: 'Compiler',          href: '/marketing/compiler'   },
      { label: 'Campaigns',         href: '/marketing/campaigns'  },
      { label: 'Newsletter',        href: '/marketing/newsletter' },
      { label: 'Media',             href: '/marketing/media'      },
    ],
  },
  {
    // PBS 2026-07-21 · Digital sub-sub-strip · MUST come before Channels so
    // /marketing/digital resolves to Digital's Web/Funnels/SEO — not Channels'.
    parentHref: '/marketing/digital',
    members: ['/marketing/digital', '/marketing/digital/web', '/marketing/web', '/marketing/funnels', '/marketing/seo'],
    tabs: [
      { label: 'Web',     href: '/marketing/digital/web' },
      { label: 'Funnels', href: '/marketing/funnels'     },
      { label: 'SEO',     href: '/marketing/seo'         },
    ],
  },
  {
    // PBS 2026-07-21 · Channels sub-strip · replaces box grid on /marketing/channels hub
    parentHref: '/marketing/channels',
    members: [
      '/marketing/channels',
      '/marketing/social',
      '/marketing/youtube',
      '/marketing/youtube/dashboard',
    ],
    tabs: [
      { label: 'Socials', href: '/marketing/social'            },
      { label: 'YouTube', href: '/marketing/youtube/dashboard' },
      { label: 'Digital', href: '/marketing/digital'           },
    ],
  },
  // PBS 2026-07-07 night: Overview lands on /marketing/library. Info sub-tab
  // removed; Library + Docs sit directly under Overview alongside Reports.
  // PBS 2026-07-09 pm: Gallery folded under Overview (was Content top-strip · same DB source as Library).
  // PBS 2026-07-09 pm (later): Social restored — was hidden because the standalone
  // /marketing/gallery subgroup below never triggered (Overview matched first).
  {
    // PBS 2026-07-11 pm: /marketing/library now 307-redirects to /marketing/media.
    // Library UI lives inside the Media Hub as a sub-tab. Kept Gallery/Social/Docs
    // accessible from a slim strip, but they no longer share a parent with Library.
    parentHref: '/marketing/gallery',
    members: ['/marketing/gallery', '/marketing/docs'],
    tabs: [
      { label: 'Gallery', href: '/marketing/gallery' },
      { label: 'Docs',    href: '/marketing/docs'    },
    ],
  },
  {
    parentHref: '/marketing/acquisition',
    // PBS 2026-07-21: /marketing/campaigns + /marketing/funnels removed from
    // this subgroup — they now belong to Content and Digital respectively.
    // Kept acquisition landing itself + prospects references.
    members: ['/marketing/acquisition', '/marketing/prospects', '/guest/prospects'],
    tabs: [
      { label: 'Campaigns', href: '/marketing/campaigns' },
      { label: 'Funnels',   href: '/marketing/funnels'   },
      { label: 'Prospects', href: '/guest/prospects'     },
    ],
  },
  // PBS 2026-07-21: standalone /marketing/offers subgroup removed — its only
  // sub-tab (Compiler) is now part of the Content sub-strip above.
  // PBS 2026-07-21: standalone /marketing/digital (Web + YouTube) subgroup
  // removed — replaced by the new Digital sub-sub-strip declared above.
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

  // ─── Finance · HR sub-strip ─────────────────────────────────
  // PBS 2026-07-09 pm: HR area sub-menu — was missing entirely for both
  // properties. Donna Finance HR is Factorial-fed and much richer than
  // Namkhan, but neither could see the child pages without this strip.
  {
    parentHref: '/finance/hr',
    members: [
      '/finance/hr',
      '/finance/hr/attendance',
      '/finance/hr/data',
      '/finance/hr/holidays',
      '/finance/hr/lifecycle',
      '/finance/hr/onboarding',
      '/finance/hr/offboarding',
      '/finance/hr/schedule',
      '/finance/hr/recruitment',
    ],
    tabs: [
      { label: 'HoD',          href: '/finance/hr'              },
      { label: 'Schedule',     href: '/finance/hr/schedule'     },
      { label: 'Attendance',   href: '/finance/hr/attendance'   },
      { label: 'Holidays',     href: '/finance/hr/holidays'     },
      { label: 'Lifecycle',    href: '/finance/hr/lifecycle'    },
      { label: 'Onboarding',   href: '/finance/hr/onboarding'   },
      { label: 'Offboarding',  href: '/finance/hr/offboarding'  },
      { label: 'Recruitment',  href: '/finance/hr/recruitment'  },
      { label: 'Data',         href: '/finance/hr/data'         },
    ],
  },
];

// PBS 2026-07-07 pm: sub-strip matching must survive the tenant `/h/{id}` prefix.
// Members are declared as unprefixed paths (e.g. `/revenue/pickup`), so on Donna
// URLs like `/h/1000001/revenue/pickup` we need to strip the prefix before matching
// AND re-apply it when rendering tab hrefs.
function stripTenantPrefix(p: string): { normalized: string; tenantPrefix: string } {
  const m = p.match(/^\/h\/(\d+)/);
  return m
    ? { normalized: p.slice(m[0].length) || '/', tenantPrefix: m[0] }
    : { normalized: p, tenantPrefix: '' };
}

export function findSubGroup(pathname: string): SubGroup | null {
  const { normalized } = stripTenantPrefix(pathname);
  for (const g of NAV_SUBGROUPS) {
    if (g.members.includes(normalized)) return g;
  }
  return null;
}

/**
 * Rewrite an unprefixed subgroup tab href to include the current tenant prefix.
 * Returns href unchanged when there's no tenant prefix in the current pathname,
 * or the href is already tenant-prefixed / non-root.
 */
export function prefixTabHref(pathname: string, href: string): string {
  const { tenantPrefix } = stripTenantPrefix(pathname);
  if (!tenantPrefix) return href;
  if (href.startsWith('/h/')) return href; // already prefixed
  if (href.startsWith('/'))  return tenantPrefix + href;
  return href;
}
