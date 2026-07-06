// components/nav/subnavConfig.ts
// Sub-nav tabs for each of the 4 pillars (Revenue · Operations · Guest · Finance).
// Knowledge & Settings are utility (under-rail).
//
// Folding decisions vs old 8-tab structure:
//   Overview                    → Home (rail mark "N")
//   Today                       → Operations · Today
//   Action Plans                → REMOVED (action cards live inline on each pillar snapshot)
//   Departments / Roots         → Operations · Restaurant
//   Departments / Spa-Activities→ Operations · Spa & Activities
//   Marketing / Reviews         → Guest · Reviews
//   Marketing / Social          → Guest · Social
//   Marketing / Influencers     → Guest · Influencers
//   Marketing / Media           → Guest · Media
//   Agents                      → Knowledge · Agents
//
// Old paths still work via redirects in next.config.js.

export interface SubNavTab {
  href: string;
  label: string;
  coming?: boolean;
  badge?: number;
  isNew?: boolean;
}

export const RAIL_SUBNAV: Record<string, SubNavTab[]> = {
  // ===== 01 Revenue (PBS 2026-07-06 late evening — hierarchical) =====
  // Six top-level groups. Three are hubs with sub-tabs (rendered on the child page):
  //   Demand & Pace     → Demand / Pace / Pickup / Cancellations
  //   Performance       → Rooms / Channels / Rate Plans / Markets
  //   Market & Control  → Comp Set / Leakage / Parity
  revenue: [
    { href: '/revenue',              label: 'Overview' },
    { href: '/revenue/pulse',        label: 'Pulse' },
    { href: '/revenue/pricing',      label: 'Calendar' },
    { href: '/revenue/demand',       label: 'Demand & Pace' },
    { href: '/revenue/rooms',        label: 'Performance' },
    { href: '/revenue/compset',      label: 'Market & Control' },
  ],

  // ===== 02 Sales (added 2026-04-30) =====
  // First sub-tab Inquiries lands the inbound funnel; remaining tabs are placeholders
  // until each section's IA proposal is approved + shipped.
  // PBS 2026-05-09 (repair list): Roster (was /sales/roster — staff roster
  // duplicates /operations/staff) removed; Agents tab stripped — agents are
  // only reachable via /cockpit now. Pages still exist; nav links gone.
  sales: [
    { href: '/sales/inquiries',  label: 'Inquiries', isNew: true },
    { href: '/sales/leads',      label: 'Leads',     isNew: true },
    { href: '/sales/groups',     label: 'Groups',    coming: true },
    { href: '/sales/fit',        label: 'FIT',       coming: true },
    { href: '/sales/packages',   label: 'Packages',  isNew: true },
    { href: '/sales/b2b',        label: 'B2B / DMC', isNew: true },
    { href: '/sales/pipeline',   label: 'Pipeline',  coming: true },
  ],

  // ===== 03 Marketing (PBS 2026-07-06 evening — canonical strip) =====
  // Order: Overview · Info · Acquisition · Campaigns · Funnels · Prospects · Products & Offers
  //        · Compiler · Content · Media · Social · Digital · Web · Library · Docs
  marketing: [
    { href: '/marketing',              label: 'Overview' },
    { href: '/marketing/library',      label: 'Info' },
    { href: '/marketing/acquisition',  label: 'Acquisition',       isNew: true },
    { href: '/marketing/campaigns',    label: 'Campaigns' },
    { href: '/marketing/funnels',      label: 'Funnels' },
    { href: '/marketing/prospects',    label: 'Prospects' },
    { href: '/marketing/offers',       label: 'Products & Offers', isNew: true },
    { href: '/marketing/compiler',     label: 'Compiler' },
    { href: '/marketing/content',      label: 'Content',           isNew: true },
    { href: '/marketing/gallery',      label: 'Media' },
    { href: '/marketing/social',       label: 'Social' },
    { href: '/marketing/digital',      label: 'Digital',           isNew: true },
    { href: '/marketing/web',          label: 'Web' },
    { href: '/marketing/library',      label: 'Library' },
    { href: '/marketing/docs',         label: 'Docs' },
  ],

  // ===== 04 Operations =====
  // Note: Front Office unfolded to its own top-level pillar 2026-05-01 (sibling of Sales/Marketing/Ops).
  // Old /operations/frontoffice placeholder removed; redirect set in next.config.js.
  // PBS 2026-06-29: Staff moved out of Operations into Finance · HR. /operations/staff
  // still 307-redirects to /finance/hr (operations/staff/page.tsx).
  operations: [
    { href: '/operations',                  label: 'Snapshot' },
    // Today merged into /operations 2026-05-04 — /operations/today now 307-redirects.
    { href: '/operations/restaurant',       label: 'F&B' },
    { href: '/operations/spa',              label: 'Spa' },
    { href: '/operations/activities',       label: 'Activities' },
    { href: '/operations/events',           label: 'Events',     isNew: true },
    // Housekeeping + Maintenance hidden — stub-only, hide until real content lands.
    { href: '/operations/inventory',        label: 'Inventory' },
    { href: '/operations/suppliers',        label: 'Suppliers',  isNew: true },
    { href: '/operations/catalog-cleanup',  label: 'Catalog cleanup' },
  ],

  // ===== 04b Front Office (added 2026-05-01) =====
  // Top-level pillar shipped with /front-office/arrivals (NEW). Other 6 sub-tabs
  // (In-house · Departures · Walk-ins · Handover · VIP & Cases · Roster) are
  // `coming: true` placeholders until each IA proposal lands.
  frontOffice: [
    { href: '/front-office/arrivals',   label: 'Arrivals',      isNew: true },
    { href: '/front-office/inhouse',    label: 'In-house',      coming: true },
    { href: '/front-office/departures', label: 'Departures',    coming: true },
    { href: '/front-office/walkins',    label: 'Walk-ins',      coming: true },
    { href: '/front-office/handover',   label: 'Handover',      coming: true },
    { href: '/front-office/vip',        label: 'VIP & Cases',   coming: true },
    { href: '/front-office/roster',     label: 'Roster',        coming: true },
  ],

  // ===== 05 Contacts (formerly Guest — PBS 2026-07-06 evening) =====
  // slug stays 'guest' + URL stays /guest to keep every existing deep link alive.
  // Sub-tabs: Overview · Guests · Prospects · Reputation · Behaviour · Newsletters.
  // Findings dropped (surface merged into HoD conclusions). Journey + Loyalty merged into Behaviour.
  guest: [
    { href: '/guest',                  label: 'Overview' },
    { href: '/guest/directory',        label: 'Guests' },
    { href: '/guest/prospects',        label: 'Prospects',   isNew: true },
    { href: '/guest/reputation',       label: 'Reputation' },
    { href: '/guest/behaviour',        label: 'Behaviour',   isNew: true },
    { href: '/guest/newsletters',      label: 'Newsletters' },
  ],

  // ===== 04 Finance =====
  // PBS 2026-06-29: HR added (was hanging under /operations/staff). Staff
  // landing now lives at /finance/hr — single source of truth.
  finance: [
    { href: '/finance',                  label: 'Snapshot' },
    { href: '/finance/hr',               label: 'HR' },
    { href: '/finance/pnl',              label: 'P&L' },
    { href: '/finance/ledger',           label: 'Ledger' },
    { href: '/finance/transactions',     label: 'Transactions' },
    { href: '/finance/pos-transactions', label: 'POS · PMS' },
    { href: '/finance/poster',           label: 'POS · Poster',    isNew: true },
    { href: '/finance/mapping',          label: 'Account mapping' },
    { href: '/finance/supplier-mapping', label: 'Supplier mapping' },
    { href: '/finance/budget',           label: 'Budget' },
    { href: '/finance/cashflow',         label: 'Cashflow',        coming: true },
    { href: '/finance/variance',         label: 'Variance',        coming: true },
    { href: '/finance/apar',             label: 'AP / AR',         coming: true },
    // PBS 2026-05-09: agents only reachable via /cockpit.
  ],

  // ===== Knowledge (utility) =====
  // PBS 2026-05-09: /agents/{roster,run,history,settings} stripped — agents
  // only reachable via /cockpit (Team tab + topbar quick-links). Pages still
  // exist for direct URL access.
  knowledge: [
    { href: '/knowledge',          label: 'Snapshot' },
    { href: '/knowledge/alerts',   label: 'Alerts',          isNew: true },
  ],

  // ===== Settings (utility) =====
  // PBS 2026-05-09 #26: only Property stays in settings. Users & roles, VAT,
  // Manual entries, Integrations, Notifications, Reports, DQ engine, Platform
  // map and the cockpit status page move to /cockpit (still reachable via
  // direct URL until cockpit shell is updated to surface them).
  settings: [
    { href: '/settings',            label: 'Snapshot' },
    { href: '/settings/property',   label: 'Property' },
    { href: '/settings/guardrails', label: 'Guardrails', isNew: true },
  ],
};

// Page banner config — eyebrow, title, emphasis.
export const PILLAR_HEADER: Record<
  string,
  { eyebrow: string; title: string; emphasis?: string; sub?: string }
> = {
  overview:    { eyebrow: 'Home',                       title: 'The',          emphasis: 'Namkhan',         sub: 'Right-now operator intelligence' },
  revenue:     { eyebrow: 'Pillar 01 · Revenue',        title: 'Revenue',      emphasis: 'management',      sub: 'Pricing · pace · channels · yield' },
  sales:       { eyebrow: 'Pillar 02 · Sales',          title: 'Inbound',      emphasis: 'funnel',          sub: 'Inquiries · groups · FIT · packages · B2B/DMC · pipeline' },
  marketing:   { eyebrow: 'Pillar 03 · Marketing',      title: 'Brand',        emphasis: 'reach',           sub: 'Library · campaigns · reviews · social · influencers' },
  operations:  { eyebrow: 'Pillar 04 · Operations',     title: 'Operations',   emphasis: 'live',            sub: 'Today · F&B · spa · activities · property' },
  frontOffice: { eyebrow: 'Pillar 04b · Front Office',  title: 'Arrivals',     emphasis: 'cockpit',         sub: 'Arrivals · in-house · departures · VIP · groups · roster' },
  guest:       { eyebrow: 'Pillar 05 · Contacts',       title: 'Contacts',     emphasis: 'directory',       sub: 'Guests · prospects · reputation · behaviour · newsletters' },
  finance:     { eyebrow: 'Pillar 06 · Finance',        title: 'USALI',        emphasis: 'ledger',          sub: 'HR · P&L · ledger · budget · variance' },
  knowledge:   { eyebrow: 'Knowledge',                  title: 'Repos',        emphasis: '& agents',        sub: 'SOPs · brand · automation' },
  settings:    { eyebrow: 'Settings',                   title: 'Property',     emphasis: 'configuration',   sub: 'Preferences · users · API keys' },
};
