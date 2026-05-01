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
  // ===== 01 Revenue =====
  // Redesign v2 (Federico, 30 Apr 2026): 7 tabs — Pulse, Pace, Channels, Rate Plans, Pricing, Comp Set, Agents.
  // Old routes (Snapshot, Demand, Rates, Inventory, Promotions) kept reachable during migration; cleanup deploy will remove.
  revenue: [
    { href: '/revenue/pulse',       label: 'Pulse' },
    { href: '/revenue/pace',        label: 'Pace' },
    { href: '/revenue/channels',    label: 'Channels' },
    { href: '/revenue/rateplans',   label: 'Rate Plans' },
    { href: '/revenue/pricing',     label: 'Pricing' },
    { href: '/revenue/compset',     label: 'Comp Set' },
    { href: '/revenue/agents',      label: 'Agents' },
  ],

  // ===== 02 Sales (added 2026-04-30) =====
  // First sub-tab Inquiries lands the inbound funnel; remaining tabs are placeholders
  // until each section's IA proposal is approved + shipped.
  sales: [
    { href: '/sales/inquiries',  label: 'Inquiries', isNew: true },
    { href: '/sales/groups',     label: 'Groups',    coming: true },
    { href: '/sales/fit',        label: 'FIT',       coming: true },
    { href: '/sales/packages',   label: 'Packages',  coming: true },
    { href: '/sales/b2b',        label: 'B2B / DMC', coming: true },
    { href: '/sales/pipeline',   label: 'Pipeline',  coming: true },
    { href: '/sales/roster',     label: 'Roster',    coming: true },
    { href: '/sales/agents',     label: 'Agents' },
  ],

  // ===== 03 Marketing (restored 2026-04-30) =====
  // Marketing pillar owns reviews/social/influencers/media (existing /marketing/* routes).
  marketing: [
    { href: '/marketing',              label: 'Snapshot' },
    { href: '/marketing/reviews',      label: 'Reviews' },
    { href: '/marketing/social',       label: 'Social' },
    { href: '/marketing/influencers',  label: 'Influencers' },
    { href: '/marketing/media',        label: 'Media' },
    { href: '/marketing/media/upload', label: 'Upload', isNew: true },
    { href: '/marketing/agents',       label: 'Agents' },
  ],

  // ===== 04 Operations =====
  // Note: Front Office unfolded to its own top-level pillar 2026-05-01 (sibling of Sales/Marketing/Ops).
  // Old /operations/frontoffice placeholder removed; redirect set in next.config.js.
  operations: [
    { href: '/operations',                  label: 'Snapshot' },
    { href: '/operations/today',            label: 'Today' },
    { href: '/operations/restaurant',       label: 'Restaurant' },
    { href: '/operations/spa',              label: 'Spa' },
    { href: '/operations/activities',       label: 'Activities' },
    { href: '/operations/housekeeping',     label: 'Housekeeping',  isNew: true },
    { href: '/operations/maintenance',      label: 'Maintenance',   isNew: true },
    { href: '/operations/agents',           label: 'Agents' },
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

  // ===== 05 Guest =====
  // Reviews/Social/Influencers/Media moved to Marketing pillar.
  guest: [
    { href: '/guest',                  label: 'Snapshot' },
    { href: '/guest/reputation',       label: 'Reputation',  coming: true },
    { href: '/guest/journey',          label: 'Journey',     coming: true },
    { href: '/guest/loyalty',          label: 'Loyalty',     coming: true },
    { href: '/guest/agents',           label: 'Agents' },
  ],

  // ===== 04 Finance =====
  finance: [
    { href: '/finance',                label: 'Snapshot' },
    { href: '/finance/pnl',            label: 'P&L' },
    { href: '/finance/ledger',         label: 'Ledger' },
    { href: '/finance/budget',         label: 'Budget',          coming: true },
    { href: '/finance/cashflow',       label: 'Cashflow',        coming: true },
    { href: '/finance/variance',       label: 'Variance',        coming: true },
    { href: '/finance/apar',           label: 'AP / AR',         coming: true },
    { href: '/finance/agents',         label: 'Agents' },
  ],

  // ===== Knowledge (utility) =====
  knowledge: [
    { href: '/knowledge',          label: 'Snapshot' },
    { href: '/agents/roster',      label: 'Agents · Roster' },
    { href: '/agents/run',         label: 'Agents · Run' },
    { href: '/agents/history',     label: 'Agents · History' },
    { href: '/agents/settings',    label: 'Agents · Settings' },
  ],

  // ===== Settings (utility) — v1.3 =====
  settings: [
    { href: '/settings',                label: 'Snapshot' },
    { href: '/settings/property',       label: 'Property' },
    { href: '/settings/users',          label: 'Users & roles' },
    { href: '/settings/budget',         label: 'Budget' },
    { href: '/settings/integrations',   label: 'Integrations' },
    { href: '/settings/notifications',  label: 'Notifications' },
    { href: '/settings/reports',        label: 'Reports' },
    { href: '/settings/dq',             label: 'DQ engine' },
    { href: '/settings/agents',         label: 'Agent guardrails', isNew: true },
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
  marketing:   { eyebrow: 'Pillar 03 · Marketing',      title: 'Brand',        emphasis: 'reach',           sub: 'Reviews · social · influencers · media' },
  operations:  { eyebrow: 'Pillar 04 · Operations',     title: 'Operations',   emphasis: 'live',            sub: 'Today · F&B · spa · activities · property' },
  frontOffice: { eyebrow: 'Pillar 04b · Front Office',  title: 'Arrivals',     emphasis: 'cockpit',         sub: 'Arrivals · in-house · departures · VIP · groups · roster' },
  guest:       { eyebrow: 'Pillar 05 · Guest',          title: 'Guest',        emphasis: 'voice',           sub: 'Reputation · journey · loyalty' },
  finance:     { eyebrow: 'Pillar 06 · Finance',        title: 'USALI',        emphasis: 'ledger',          sub: 'P&L · ledger · budget · variance' },
  knowledge:   { eyebrow: 'Knowledge',                  title: 'Repos',        emphasis: '& agents',        sub: 'SOPs · brand · automation' },
  settings:    { eyebrow: 'Settings',                   title: 'Property',     emphasis: 'configuration',   sub: 'Preferences · users · API keys' },
};
