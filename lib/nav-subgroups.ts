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
    // PBS 2026-08-25: Promotions added — the five OTA promotion registers had
    // no nav entry at all and were reachable only from the per-source action bar.
    members: ['/revenue/rooms', '/revenue/channels', '/revenue/channels/promotions', '/revenue/rateplans', '/revenue/markets'],
    // PBS 2026-07-09 pm: Performance order — Channels · Rate Plans · Markets · Rooms.
    tabs: [
      { label: 'Channels',   href: '/h/260955/revenue/channels'  },
      { label: 'Promotions', href: '/h/260955/revenue/channels/promotions' },
      { label: 'Rate Plans', href: '/h/260955/revenue/rateplans' },
      { label: 'Markets',    href: '/h/260955/revenue/markets'   },
      { label: 'Rooms',      href: '/h/260955/revenue/rooms'     },
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
      { label: 'Comp Set',   href: '/h/260955/revenue/compset'              },
      { label: 'Comp Rates', href: '/h/260955/revenue/lighthouse/overview'  },
      { label: 'Parity',     href: '/h/260955/revenue/parity'               },
      { label: 'Leakage',    href: '/h/260955/revenue/leakage'              },
    ],
  },

  // PBS 2026-08-05 (F8): Forecast sub-tabs — Forecast (main summary) + Scenarios.
  // Property-scoped only (/h/[pid]/revenue/forecast).
  {
    parentHref: '/revenue/forecast',
    members: ['/revenue/forecast', '/revenue/forecast/scenarios'],
    tabs: [
      { label: 'Forecast',  href: '/h/260955/revenue/forecast'           },
      { label: 'Scenarios', href: '/h/260955/revenue/forecast/scenarios' },
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
      '/operations/menus',
    ],
    tabs: [
      { label: 'Rooms',      href: '/h/260955/operations/rooms'      },
      { label: 'F&B',        href: '/h/260955/operations/restaurant' },
      { label: 'Spa',        href: '/h/260955/operations/spa'        },
      { label: 'Activities', href: '/h/260955/operations/activities' },
      { label: 'Retail',     href: '/h/260955/operations/retail'     },
      { label: 'Transport',  href: '/h/260955/operations/transport'  },
      { label: 'Other',      href: '/h/260955/operations/other'      },
      { label: 'Menus',      href: '/h/260955/operations/menus'      },
    ],
  },
  // ─── Operations · Inventory · Orders sub-strip · PBS 2026-08-24 ──
  // Requests + Shop + Suppliers moved under Orders.
  {
    parentHref: '/operations/inventory/orders',
    members: [
      '/operations/inventory/orders',
      '/operations/inventory/requests',
      '/operations/inventory/shop',
      '/operations/inventory/suppliers',
    ],
    tabs: [
      { label: 'Orders',    href: '/h/260955/operations/inventory/orders'    },
      { label: 'Requests',  href: '/h/260955/operations/inventory/requests'  },
      { label: 'Shop',      href: '/h/260955/operations/inventory/shop'      },
      { label: 'Suppliers', href: '/h/260955/operations/inventory/suppliers' },
    ],
  },
  // ─── Operations · Inventory · Stock sub-strip · PBS 2026-08-25 ──
  // Catalog + Par + Counts nest under Stock.
  {
    parentHref: '/operations/inventory/stock',
    members: [
      '/operations/inventory/stock',
      '/operations/inventory/catalog',
      '/operations/inventory/par',
      '/operations/inventory/counts',
    ],
    tabs: [
      { label: 'Stock',   href: '/h/260955/operations/inventory/stock'   },
      { label: 'Catalog', href: '/h/260955/operations/inventory/catalog' },
      { label: 'Par',     href: '/h/260955/operations/inventory/par'     },
      { label: 'Counts',  href: '/h/260955/operations/inventory/counts'  },
    ],
  },
  // ─── Operations · Restaurant dept sub-strip · PBS 2026-08-24 ──
  // Dishes analytics page surfaces under Departments / Restaurant.
  {
    parentHref: '/operations/restaurant',
    members: ['/operations/restaurant', '/operations/inventory/dishes'],
    tabs: [
      { label: 'Analytics', href: '/h/260955/operations/inventory/dishes' },
    ],
  },

  // PBS 2026-07-21 · Inventory hub — top-level entry points.
  // Catalog/Par/Counts now live under Stock sub-strip.
  // Suppliers/Requests/Shop now live under Orders sub-strip.
  {
    parentHref: '/operations/inventory',
    members: [
      '/operations/inventory',
      '/operations/inventory/assets',
      '/operations/inventory/capex',
      '/operations/inventory/items',
      '/operations/inventory/stock',
      '/operations/inventory/orders',
    ],
    tabs: [
      { label: 'Overview', href: '/h/260955/operations/inventory'        },
      { label: 'Stock',    href: '/h/260955/operations/inventory/stock'  },
      { label: 'Orders',   href: '/h/260955/operations/inventory/orders' },
      { label: 'Items',    href: '/h/260955/operations/inventory/items'  },
      { label: 'Assets',   href: '/h/260955/operations/inventory/assets' },
      { label: 'Capex',    href: '/h/260955/operations/inventory/capex'  },
    ],
  },

  // ─── Operations · Spa department sub-strip · PBS 2026-08-24 ──
  // Analytics tab moved here from inventory strip; accessible from Spa dept page.
  {
    parentHref: '/operations/spa',
    members: ['/operations/spa', '/operations/inventory/spa'],
    tabs: [
      { label: 'Analytics', href: '/h/260955/operations/inventory/spa' },
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
      { label: 'Compiler',          href: '/h/260955/marketing/compiler'             },
      { label: 'Campaigns',         href: '/h/260955/marketing/campaigns'            },
      { label: 'Newsletter',        href: '/h/260955/marketing/content/newsletters'  },
      { label: 'Media',             href: '/h/260955/marketing/media'                },
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
      '/marketing/seo',
      '/marketing/website',
    ],
    tabs: [
      // PBS 2026-08-22: "Web" tab renamed to "Analytics"; YouTube moved to Socials sub-strip.
      { label: 'Analytics', href: '/h/260955/marketing/digital/web'     },
      { label: 'Funnels',   href: '/h/260955/marketing/funnels'         },
      { label: 'SEO',       href: '/h/260955/marketing/seo'             },
      { label: 'Website',   href: '/h/260955/marketing/website'         },
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
      { label: 'Gallery', href: '/h/260955/marketing/gallery' },
      { label: 'Docs',    href: '/h/260955/marketing/docs'    },
    ],
  },
  {
    parentHref: '/marketing/acquisition',
    // PBS 2026-07-21: /marketing/campaigns + /marketing/funnels removed from
    // this subgroup — they now belong to Content and Digital respectively.
    // Kept acquisition landing itself + prospects references.
    members: ['/marketing/acquisition', '/marketing/prospects', '/guest/prospects'],
    tabs: [
      { label: 'Campaigns', href: '/h/260955/marketing/campaigns' },
      { label: 'Funnels',   href: '/h/260955/marketing/funnels'   },
      { label: 'Prospects', href: '/h/260955/guest/prospects'     },
    ],
  },
  // PBS 2026-07-21: standalone /marketing/offers subgroup removed — its only
  // sub-tab (Compiler) is now part of the Content sub-strip above.
  // PBS 2026-07-21: standalone /marketing/digital (Web + YouTube) subgroup
  // removed — replaced by the new Digital sub-sub-strip declared above.
  // (The old /marketing/library standalone subgroup is now merged into Overview
  //  above — Library + Docs live directly under Overview.)

  // ─── Finance landing strip · PBS 2026-08-25 ─────────────────
  // Finance HoD sub-strip: Planning · Budget · Studio (no HoD — already the current page).
  // PBS 2026-09-06: the three destinations were missing from `members`, so the strip
  // appeared on /finance but vanished the moment you clicked one of its own tabs —
  // no way back except the browser button. They are 2-segment paths, so the
  // detail-page fallback below (3+ segments only) never rescued them.
  {
    parentHref: '/finance',
    members: [
      '/finance', '/finance/overview',
      '/finance/planning', '/finance/budget', '/finance/studio',
    ],
    tabs: [
      { label: 'Planning', href: '/h/260955/finance/planning' },
      { label: 'Budget',   href: '/h/260955/finance/budget'   },
      { label: 'Studio',   href: '/h/260955/finance/studio'   },
    ],
  },

  // ─── Finance · Acc sub-strip · PBS 2026-08-25 ──
  // Acc groups: Costs · Suppliers · PMS · Accounting · Ledger.
  // PMS/Banks/POS excluded from members — they have their own sub-strip
  // below; if included here they shadow it (first-match-wins).
  // PBS 2026-08-29: Transactions renamed → PMS; Accounting tab added for QB feed.
  {
    parentHref: '/finance/costs',
    members: ['/finance/costs', '/finance/suppliers', '/finance/ledger', '/finance/accounting'],
    tabs: [
      { label: 'Costs',        href: '/h/260955/finance/costs'        },
      { label: 'Suppliers',    href: '/h/260955/finance/suppliers'    },
      { label: 'PMS',          href: '/h/260955/finance/transactions' },
      { label: 'Accounting',   href: '/h/260955/finance/accounting'   },
      { label: 'Ledger',       href: '/h/260955/finance/ledger'       },
    ],
  },

  // ─── Finance · PMS sub-strip · PBS 2026-08-22/29 ──────
  // Banks + POS are children of PMS (formerly Transactions).
  {
    parentHref: '/finance/transactions',
    members: ['/finance/transactions', '/finance/banks', '/finance/pos'],
    tabs: [
      { label: 'PMS',          href: '/h/260955/finance/transactions' },
      { label: 'Banks',        href: '/h/260955/finance/banks'        },
      { label: 'POS',          href: '/h/260955/finance/pos'          },
    ],
  },



  // ─── Finance · HR · Schedule sub-sub-strip · PBS 2026-08-24 ──
  {
    parentHref: '/finance/hr/schedule',
    members: ['/finance/hr/schedule'],
    tabs: [
      { label: 'Planer',  href: '/h/260955/finance/hr/schedule?tab=planer'  },
      { label: 'Dayview', href: '/h/260955/finance/hr/schedule?tab=dayview' },
    ],
  },

  // ─── Finance · HR · Lifecycle sub-sub-strip · PBS 2026-08-24 ──
  {
    parentHref: '/finance/hr/lifecycle',
    members: [
      '/finance/hr/lifecycle',
      '/finance/hr/recruitment',
      '/finance/hr/onboarding',
      '/finance/hr/offboarding',
      '/finance/hr/warning',
    ],
    tabs: [
      { label: 'Recruitment', href: '/h/260955/finance/hr/recruitment' },
      { label: 'Onboarding',  href: '/h/260955/finance/hr/onboarding'  },
      { label: 'Offboarding', href: '/h/260955/finance/hr/offboarding' },
      { label: 'Warning',     href: '/h/260955/finance/hr/warning'     },
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
      '/finance/hr/register',
      '/finance/hr/attendance',
      '/finance/hr/data',
      '/finance/hr/holidays',
      '/finance/hr/lifecycle',
      '/finance/hr/schedule',
    ],
    tabs: [
      { label: 'HoD',        href: '/h/260955/finance/hr'            },
      { label: 'Register',   href: '/h/260955/finance/hr/register'   },
      { label: 'Schedule',   href: '/h/260955/finance/hr/schedule'   },
      { label: 'Attendance', href: '/h/260955/finance/hr/attendance' },
      { label: 'Holidays',   href: '/h/260955/finance/hr/holidays'   },
      { label: 'Lifecycle',  href: '/h/260955/finance/hr/lifecycle'  },
      { label: 'Data',       href: '/h/260955/finance/hr/data'       },
    ],
  },
  // ─── Revenue HoD sub-strip (Rate Desk + Forecast) ───────────
  // PBS 2026-08-21: Rate Desk + Forecast moved out of the top strip.
  // They now surface as a sub-strip on the Revenue HoD landing (and
  // stay visible when the user clicks into either one, so the flow
  // Landing ↔ Rate Desk ↔ Forecast is discoverable in one place).
  {
    parentHref: '/revenue',
    members: ['/revenue', '/revenue/cockpit', '/revenue/forecast', '/revenue/revreports'],
    tabs: [
      { label: 'Overview',   href: '/h/260955/revenue'            },
      { label: 'Rate Desk',  href: '/h/260955/revenue/cockpit'    },
      { label: 'Forecast',   href: '/h/260955/revenue/forecast'   },
      // PBS 2026-09-06: revenue-side twin of Administration > Reports, filtered
      // to the Cloudbeds stock reports a revenue manager actually uses.
      { label: 'RevReports', href: '/h/260955/revenue/revreports' },
    ],
  },

  // ─── Marketing · Socials · Channels sub-strip ──────────────
  // PBS 2026-08-21: sub-strip listing every social channel + GBP.
  // Renders on the /marketing/social landing AND on each channel
  // landing (IG/FB/X/LinkedIn/Pinterest/TikTok/GBP) so the operator
  // can jump between channels without going back to the parent.
  {
    parentHref: '/marketing/social/channels',  // synthetic parent — sub-strip renders on individual channel pages only
    members: [
      // PBS 2026-08-22: '/marketing/social' removed from members so the parent
      // page can host an inline channel-tabs strip inside the "channels" view
      // (below the calendar/flow/channels/boost view-switcher).
      '/marketing/social/instagram',
      '/marketing/social/facebook',
      '/marketing/social/x',
      '/marketing/social/linkedin',
      '/marketing/social/pinterest',
      '/marketing/social/tiktok',
      '/marketing/social/google-business',
      '/marketing/youtube',
      '/marketing/youtube/dashboard',
      '/marketing/youtube/playlists',
      '/marketing/youtube/planning',
      '/marketing/youtube/production',
      '/marketing/youtube/analytics',
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
      { label: 'YouTube',          href: '/h/260955/marketing/youtube/dashboard'         },
    ],
  },

  // ─── Finance · Legal sub-strip · PBS 2026-08-22, re-parented 2026-09-06 ──
  // Archive used to be a top-level Administration tab with its own sub-strip.
  // It is a legal-archive surface, so it now sits under Legal. Landing on
  // /finance/legal, /finance/archive or the docs directory shows the same strip,
  // which is what makes Archive reachable at all now it is off the top row.
  {
    parentHref: '/finance/legal',
    members: ['/finance/legal', '/finance/archive', '/finance/legal/docs'],
    tabs: [
      { label: 'Legal',          href: '/h/260955/finance/legal'          },
      { label: 'Archive',        href: '/h/260955/finance/archive'        },
      { label: 'Directory',      href: '/h/260955/finance/legal/docs'     },
      { label: 'Brain Settings', href: '/h/260955/settings/brain'         },
    ],
  },

  // ─── Sales · ICP sub-strip · PBS 2026-08-22 ────────────────
  // Ensures /sales/icp renders a sub-strip below the top strip.
  {
    parentHref: '/sales/icp',
    members: ['/sales/icp'],
    tabs: [
      { label: 'ICP Segments', href: '/h/260955/sales/icp' },
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
 * Rewrite a tab href to include the current tenant prefix.
 * - Bare /some/path → /h/{pid}/some/path
 * - /h/260955/some/path on a Donna URL → /h/1000001/some/path
 *   (cross-tenant swap so DEPT_CFG Namkhan-anchored hrefs work on any tenant)
 */
export function prefixTabHref(pathname: string, href: string): string {
  const { tenantPrefix } = stripTenantPrefix(pathname);
  if (!tenantPrefix) return href;
  if (href.startsWith('/h/')) {
    // Cross-tenant rewrite: swap /h/{other}/ → /h/{current}/ so tabs built
    // from DEPT_CFG (which anchors to Namkhan) stay in the active tenant.
    const hrefStripped = stripTenantPrefix(href);
    if (hrefStripped.tenantPrefix && hrefStripped.tenantPrefix !== tenantPrefix) {
      return tenantPrefix + hrefStripped.normalized;
    }
    return href; // same tenant prefix — already correct
  }
  if (href.startsWith('/'))  return tenantPrefix + href;
  return href;
}

