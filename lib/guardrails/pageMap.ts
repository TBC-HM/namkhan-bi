// lib/guardrails/pageMap.ts
// PBS 2026-07-17 — maps every guardrail rule_key to the page it belongs to.
// Enables Property Settings > Guardrails to render Dept-tab → Page-block layout.
//
// Extend by adding rows to RULE_PAGE_MAP. Rules not listed here fall into the
// per-dept "Unassigned" block — visible so nothing goes missing when a new rule
// is added; PBS or the next PR assigns it to a page.

export interface PageDescriptor {
  page_slug: string;   // stable id used for grouping — kebab-case
  page_label: string;  // human label shown in the block title
  page_href: string;   // relative link — rendered as "Go to page" chip
}

// Revenue page catalog — subpages under /revenue.
export const REVENUE_PAGES: PageDescriptor[] = [
  { page_slug: 'hod',            page_label: 'HoD Landing',        page_href: '/revenue' },
  { page_slug: 'briefing',       page_label: 'Briefing',           page_href: '/revenue/briefing' },
  { page_slug: 'pulse',          page_label: 'Pulse',              page_href: '/revenue/pulse' },
  { page_slug: 'demand',         page_label: 'Demand',             page_href: '/revenue/demand' },
  { page_slug: 'pace',           page_label: 'Pace',               page_href: '/revenue/pace' },
  { page_slug: 'pickup',         page_label: 'Pickup',             page_href: '/revenue/pickup' },
  { page_slug: 'rooms',          page_label: 'Rooms',              page_href: '/revenue/rooms' },
  { page_slug: 'channels',       page_label: 'Channels',           page_href: '/revenue/channels' },
  { page_slug: 'compset',        page_label: 'Comp set',           page_href: '/revenue/compset' },
  { page_slug: 'parity',         page_label: 'Parity',             page_href: '/revenue/parity' },
  { page_slug: 'leakage',        page_label: 'Leakage',            page_href: '/revenue/leakage' },
  { page_slug: 'markets',        page_label: 'Markets',            page_href: '/revenue/markets' },
  { page_slug: 'rateplans',      page_label: 'Rate Plans',         page_href: '/revenue/rateplans' },
  { page_slug: 'pricing',        page_label: 'Pricing',            page_href: '/revenue/pricing' },
  { page_slug: 'performance',    page_label: 'Performance',        page_href: '/revenue/performance' },
  { page_slug: 'market-control', page_label: 'Market & Control',   page_href: '/revenue/market-control' },
  { page_slug: 'reports',        page_label: 'Reports',            page_href: '/revenue/reports' },
];

// Other dept catalogs — start empty (flat list until PBS provides per-page split).
export const SALES_PAGES: PageDescriptor[]        = [];
export const MARKETING_PAGES: PageDescriptor[]    = [];
export const OPERATIONS_PAGES: PageDescriptor[]   = [];
export const CONTACTS_PAGES: PageDescriptor[]     = [];
export const FINANCE_PAGES: PageDescriptor[]      = []; // 'Administration' domain
export const REPUTATION_PAGES: PageDescriptor[]   = [];
export const RETENTION_PAGES: PageDescriptor[]    = [];
export const NEWSLETTER_PAGES: PageDescriptor[]   = [];
export const OBSERVATIONS_PAGES: PageDescriptor[] = [];

export const PAGES_BY_DOMAIN: Record<string, PageDescriptor[]> = {
  revenue:      REVENUE_PAGES,
  sales:        SALES_PAGES,
  marketing:    MARKETING_PAGES,
  operations:   OPERATIONS_PAGES,
  contacts:     CONTACTS_PAGES,
  finance:      FINANCE_PAGES,
  reputation:   REPUTATION_PAGES,
  retention:    RETENTION_PAGES,
  newsletter:   NEWSLETTER_PAGES,
  observations: OBSERVATIONS_PAGES,
};

// Rule → page mapping. Every currently-known rule_key. Extend as new guardrails are added.
// If a rule isn't in this map, it falls into the dept's "Unassigned" block on the UI.
export const RULE_PAGE_MAP: Record<string, string> = {
  // ── Revenue · HoD ─────────────────────────────────────────────────
  occupancy_target:   'hod',
  adr_target:         'hod',
  revpar_target:      'hod',
  pickup_min_daily:   'hod',
  pace_gap_pp:        'pace',

  // ── Revenue · Parity ──────────────────────────────────────────────
  parity_breach_usd:              'parity',
  integrity_max_spread_pct:       'parity',
  integrity_soldout_days_max:     'parity',
  lighthouse_stale_days:          'parity',

  // ── Revenue · Compset ─────────────────────────────────────────────
  compset_stale_days:             'compset',
  compset_undercut_days_pct:      'compset',
  compset_avg_delta_pct:          'compset',
  compset_rate_change_3d_max_pct: 'compset',
  compset_rate_change_7d_max_pct: 'compset',

  // ── Revenue · Rate Plans ──────────────────────────────────────────
  nrr_share_target:            'rateplans',
  early_bird_share_target:     'rateplans',
  flex_share_max:              'rateplans',
  sleeping_plan_max_days:      'rateplans',
  never_booked_plan_max_share: 'rateplans',
  orphan_catalogue_gap_max:    'rateplans',
};

// Lookup helper — returns the PageDescriptor for a rule within a domain, or null.
export function pageForRule(domain: string, rule_key: string): PageDescriptor | null {
  const slug = RULE_PAGE_MAP[rule_key];
  if (!slug) return null;
  const pages = PAGES_BY_DOMAIN[domain] ?? [];
  return pages.find((p) => p.page_slug === slug) ?? null;
}
