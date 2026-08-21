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
  // PBS 2026-08-21: Overview sub-strip removed. Pulse stands alone as the
  // single Overview page. Calendar (/revenue/pricing) moved to the Demand &
  // Pace sub-strip below (after Cancellations, per PBS request).
  // PBS 2026-07-08: Pickup Month/Day dropped from nav-subgroups. Was causing
  // the Demand & Pace strip to disappear when landing on /revenue/pickup.
  // Month/Day is now rendered inline inside the Pickup page body (like a
  // /pricing-tab strip), so Pickup keeps the Demand | Pace | Pickup |
  // Cancellations sub-strip while still switching Month ↔ Day.
  {
    parentHref: '/revenue/demand',
    // PBS 2026-08-21: Reservations added before Cancellations · Calendar appended
    // after Cancellations (moved out of Overview per PBS request) · all hrefs
    // property-scoped per URL LAW (rewriter swaps /h/260955/ → /h/{pid}/ for Donna).
    members: ['/revenue/demand', '/revenue/pace', '/revenue/pickup', '/revenue/pickup-day', '/revenue/reservations', '/revenue/cancellations', '/revenue/pricing'],
    tabs: [
      { label: 'Demand',        href: '/h/260955/revenue/demand'        },
      { label: 'Pace',          href: '/h/260955/revenue/pace'          },
      { label: 'Pickup',        href: '/h/260955/revenue/pickup'        },
      { label: 'Reservations',  href: '/h/260955/revenue/reservations'  },
      { label: 'Cancellations', href: '/h/260955/revenue/cancellations' },
      { label: 'Calendar',      href: '/h/260955/revenue/pricing'       },
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
      { label: 'Docs', href: '/h/260955/operations/docs' },
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
      { label: 'SOPs',               href: '/h/260955/operations/sops'                  },
      { label: 'QA registry',        href: '/h/260955/operations/qa/registry'           },
      { label: 'Proposals',          href: '/h/260955/operations/qa/proposals'          },
      { label: 'Generate',           href: '/h/260955/operations/qa/generate'           },
      { label: 'Agent instructions', href: '/h/260955/operations/qa/agent-instructions' },
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
      { label: 'Rooms',      href: '/h/260955/operations/rooms'      },
      { label: 'F&B',        href: '/h/260955/operations/restaurant' },
      { label: 'Spa',        href: '/h/260955/operations/spa'        },
      { label: 'Activities', href: '/h/260955/operations/activities' },
      { label: 'Retail',     href: '/h/260955/operations/retail'     },
      { label: 'Transport',  href: '/h/260955/operations/transport'  },
      { label: 'Other',      href: '/h/260955/operations/other'      },
    ],
  },
  // PBS 2026-07-21 · Inventory hub — full sub-strip so operator sees every child page
  // 2026-07-30: + Dishes + Spa (PBS 2026-07-24 pages, registered per inventory
  // completion brief A7 — were direct-URL only).
  {
    parentHref: '/operations/inventory',
    members: [
      '/operations/inventory',
      '/operations/inventory/assets',
      '/operations/inventory/capex',
      '/operations/inventory/catalog',
      '/operations/inventory/counts',
      '/operations/inventory/dishes',
      '/operations/inventory/items',
      '/operations/inventory/orders',
      '/operations/inventory/par',
      '/operations/inventory/requests',
      '/operations/inventory/shop',
      '/operations/inventory/spa',
      '/operations/inventory/stock',
      '/operations/inventory/suppliers',
    ],
    tabs: [
      { label: 'Overview',  href: '/h/260955/operations/inventory'           },
      { label: 'Assets',    href: '/h/260955/operations/inventory/assets'    },
      { label: 'Capex',     href: '/h/260955/operations/inventory/capex'     },
      { label: 'Catalog',   href: '/h/260955/operations/inventory/catalog'   },
      { label: 'Counts',    href: '/h/260955/operations/inventory/counts'    },
      { label: 'Dishes',    href: '/h/260955/operations/inventory/dishes'    },
      { label: 'Items',     href: '/h/260955/operations/inventory/items'     },
      { label: 'Orders',    href: '/h/260955/operations/inventory/orders'    },
      { label: 'Par',       href: '/h/260955/operations/inventory/par'       },
      { label: 'Requests',  href: '/h/260955/operations/inventory/requests'  },
      { label: 'Shop',      href: '/h/260955/operations/inventory/shop'      },
      { label: 'Spa',       href: '/h/260955/operations/inventory/spa'       },
      { label: 'Stock',     href: '/h/260955/operations/inventory/stock'     },
      { label: 'Suppliers', href: '/h/260955/operations/inventory/suppliers' },
    ],
  },

  // ─── Marketing ────────────────────────────────────────────
  // PBS 2026-07-21 · IA v2: Channels top tab killed; Socials + Digital promoted
  // to top-strip peers. YouTube moved into Digital sub-strip. SEO dropped from nav.
  // /marketing/{content,digital} are nav-hubs — their bodies are empty; the sub-strip
  // IS the nav. Order matters — findSubGroup returns FIRST match. Content is placed
  // first because its members (offers/compiler/campaigns/newsletter/media) must beat
  // the legacy /marketing/acquisition subgroup below on /marketing/campaigns.
  {
    // PBS 2026-07-21 · Content sub-strip · replaces box grid on /marketing/content hub
    // PBS 2026-08-21: removed 'Products & Offers' tab. Newsletter surfaced under
    // /marketing/content/newsletters (redirects to /h/260955/... on Namkhan; tenant
    // route mounts the /guest/newsletters body directly with propertyId scope).
    parentHref: '/marketing/content',
    members: [
      '/marketing/content',
      '/marketing/compiler',
      '/marketing/campaigns',
      '/marketing/content/newsletters',
      '/marketing/media',
    ],
    tabs: [
      { label: 'Compiler',          href: '/marketing/compiler'             },
      { label: 'Campaigns',         href: '/marketing/campaigns'            },
      { label: 'Newsletter',        href: '/marketing/content/newsletters'  },
      { label: 'Media',             href: '/marketing/media'                },
    ],
  },
  // PBS 2026-07-21 · Digital sub-strip · YouTube moved here from Channels · SEO restored as 4th tab per PBS
  {
    parentHref: '/marketing/digital',
    members: [
      '/marketing/digital',
      '/marketing/digital/web',
      '/marketing/web',
      '/marketing/funnels',
      '/marketing/youtube',
      '/marketing/youtube/dashboard',
      '/marketing/youtube/playlists',
      '/marketing/youtube/planning',
      '/marketing/youtube/production',
      '/marketing/youtube/analytics',
      '/marketing/seo',
      '/marketing/website',
    ],
    tabs: [
      { label: 'Web',     href: '/marketing/digital/web'       },
      { label: 'Funnels', href: '/marketing/funnels'           },
      { label: 'YouTube', href: '/marketing/youtube/dashboard' },
      { label: 'SEO',     href: '/marketing/seo'               },
      // website-module-v1 P3 (2026-07-30): Website capability — editor over
      // website.* rows + publish. Brief §MENU: Marketing substripe → Website.
      { label: 'Website', href: '/marketing/website'           },
    ],
  },
  // PBS 2026-07-21 · Channels subgroup deleted — Socials + Digital are now top-strip peers.
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
    // 2026-07-30: + Studio (Spreadsheet Studio v1, brief module-spreadsheet-studio-v1 —
    // Administration substripe placement per PBS 2026-07-29 menu directive).
    members: ['/finance', '/finance/overview', '/finance/pnl', '/finance/ledger', '/finance/transactions', '/finance/banks', '/finance/pos', '/finance/budget', '/finance/studio'],
    tabs: [
      { label: 'P&L',          href: '/finance/pnl'          },
      { label: 'Ledger',       href: '/finance/ledger'       },
      { label: 'Transactions', href: '/finance/transactions' },
      { label: 'Banks',        href: '/finance/banks'        },
      { label: 'POS',          href: '/finance/pos'          },
      { label: 'Budget',       href: '/finance/budget'       },
      { label: 'Studio',       href: '/finance/studio'       },
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
  // ─── Revenue HoD sub-strip (Rate Desk + Forecast) ───────────
  // PBS 2026-08-21: Rate Desk + Forecast moved out of the top strip.
  // They now surface as a sub-strip on the Revenue HoD landing (and
  // stay visible when the user clicks into either one, so the flow
  // Landing ↔ Rate Desk ↔ Forecast is discoverable in one place).
  {
    parentHref: '/revenue',
    members: ['/revenue', '/revenue/cockpit', '/revenue/forecast'],
    tabs: [
      { label: 'Overview',  href: '/h/260955/revenue'           },
      { label: 'Rate Desk', href: '/h/260955/revenue/cockpit'   },
      { label: 'Forecast',  href: '/h/260955/revenue/forecast'  },
    ],
  },

  // ─── Marketing · Socials · Channels sub-strip ──────────────
  // PBS 2026-08-21: sub-strip listing every social channel + GBP.
  // Renders on the /marketing/social landing AND on each channel
  // landing (IG/FB/X/LinkedIn/Pinterest/TikTok/GBP) so the operator
  // can jump between channels without going back to the parent.
  {
    parentHref: '/marketing/social',
    members: [
      '/marketing/social',
      '/marketing/social/instagram',
      '/marketing/social/facebook',
      '/marketing/social/x',
      '/marketing/social/linkedin',
      '/marketing/social/pinterest',
      '/marketing/social/tiktok',
      '/marketing/social/google-business',
    ],
    tabs: [
      { label: 'Overview',         href: '/h/260955/marketing/social'                    },
      { label: 'Instagram',        href: '/h/260955/marketing/social/instagram'          },
      { label: 'Facebook',         href: '/h/260955/marketing/social/facebook'           },
      { label: 'X / Twitter',      href: '/h/260955/marketing/social/x'                  },
      { label: 'LinkedIn',         href: '/h/260955/marketing/social/linkedin'           },
      { label: 'Pinterest',        href: '/h/260955/marketing/social/pinterest'          },
      { label: 'TikTok',           href: '/h/260955/marketing/social/tiktok'             },
      { label: 'Google Business',  href: '/h/260955/marketing/social/google-business'    },
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
  // Exact match on member first
  for (const g of NAV_SUBGROUPS) {
    if (g.members.includes(normalized)) return g;
  }
  // PBS 2026-08-21: detail-page fallback — strip ONE trailing segment
  // so /revenue/compset/{uuid} still shows the Comp & Parity sub-strip
  // (and /revenue/rooms/{id} shows Performance, /marketing/social/{platform}
  // already handled by explicit members). Only kicks in when the stripped
  // parent is a 2-segment path (/a/b), never for shallower URLs — avoids
  // /revenue/pulse accidentally matching /revenue.
  const segCount = normalized.split('/').filter(Boolean).length;
  if (segCount >= 3) {
    const idx = normalized.lastIndexOf('/');
    const parent = normalized.slice(0, idx);
    for (const g of NAV_SUBGROUPS) {
      if (g.members.includes(parent)) return g;
    }
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
