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
  // PBS 2026-07-07 evening: HoD + Overview split. Pulse & Calendar are sub-tabs of Overview.
  revenue: [
    { href: '/revenue',              label: 'HoD' },
    { href: '/revenue/overview',     label: 'Overview' },
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

  // ===== 03 Marketing (PBS 2026-07-06 late evening — hierarchical) =====
  // Six top-level parents. Sub-tabs render on each parent's landing page:
  //   Overview          → Info / Reports
  //   Acquisition       → Campaigns / Funnels / Prospects
  //   Products & Offers → Compiler
  //   Content           → Media / Social
  //   Digital           → Web
  //   Library           → Docs
  marketing: [
    // PBS 2026-07-07 evening: HoD + Overview split.
    { href: '/marketing',              label: 'HoD' },
    { href: '/marketing/overview',     label: 'Overview' },
    { href: '/marketing/acquisition',  label: 'Acquisition' },
    { href: '/marketing/offers',       label: 'Products & Offers' },
    { href: '/marketing/content',      label: 'Content' },
    { href: '/marketing/digital',      label: 'Digital' },
    { href: '/marketing/library',      label: 'Library' },
  ],

  // ===== 04 Operations (PBS 2026-07-07 evening — hierarchical) =====
  // PBS 2026-07-07 late evening: QA + Docs dropped from top strip (still reachable
  // by URL). Top strip = HoD / Overview / Departments / Suppliers.
  operations: [
    { href: '/operations',              label: 'HoD' },
    { href: '/operations/overview',     label: 'Overview' },
    { href: '/operations/rooms',        label: 'Departments' },
    { href: '/operations/suppliers',    label: 'Suppliers',  isNew: true },
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

  // ===== 04 Finance (PBS 2026-07-07 — hierarchical) =====
  // Consolidation: 3 parent groups own the sub-tabs (Finance / Transactions /
  // Working capital), 4 flat leaves stay top-level (HoD / Overview / HR / Budget).
  // Parent tabs link to the first child; sub-tabs render on child pages via
  // lib/nav-subgroups.ts NAV_SUBGROUPS.
  // PBS 2026-07-07 late evening: single "Finance" parent (sub-tabs P&L / Ledger /
  // Transactions / Budget). Working capital was an invention — removed.
  finance: [
    { href: '/finance',              label: 'HoD' },
    { href: '/finance/overview',     label: 'Overview',        isNew: true },
    { href: '/finance/hr',           label: 'HR' },
    { href: '/finance/pnl',          label: 'Finance' },
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
