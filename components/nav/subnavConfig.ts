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

  // ===== 02 Operations =====
  operations: [
    { href: '/operations',                  label: 'Snapshot' },
    { href: '/operations/today',            label: 'Today' },
    { href: '/operations/restaurant',       label: 'Restaurant' },
    { href: '/operations/spa',              label: 'Spa' },
    { href: '/operations/activities',       label: 'Activities' },
    { href: '/operations/frontoffice',      label: 'Front Office',  coming: true },
    { href: '/operations/housekeeping',     label: 'Housekeeping',  coming: true },
    { href: '/operations/maintenance',      label: 'Maintenance',   coming: true },
  ],

  // ===== 03 Guest =====
  guest: [
    { href: '/guest',                  label: 'Snapshot' },
    { href: '/guest/reviews',          label: 'Reviews' },
    { href: '/guest/reputation',       label: 'Reputation',  coming: true },
    { href: '/guest/journey',          label: 'Journey',     coming: true },
    { href: '/guest/loyalty',          label: 'Loyalty',     coming: true },
    { href: '/guest/social',           label: 'Social' },
    { href: '/guest/influencers',      label: 'Influencers' },
    { href: '/guest/media',            label: 'Media' },
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
  ],

  // ===== Knowledge (utility) =====
  knowledge: [
    { href: '/knowledge',          label: 'Snapshot' },
    { href: '/agents/roster',      label: 'Agents · Roster' },
    { href: '/agents/run',         label: 'Agents · Run' },
    { href: '/agents/history',     label: 'Agents · History' },
    { href: '/agents/settings',    label: 'Agents · Settings' },
  ],
};

// Page banner config — eyebrow, title, emphasis.
export const PILLAR_HEADER: Record<
  string,
  { eyebrow: string; title: string; emphasis?: string; sub?: string }
> = {
  overview:    { eyebrow: 'Home',                       title: 'The',          emphasis: 'Namkhan',         sub: 'Right-now operator intelligence' },
  revenue:     { eyebrow: 'Pillar 01 · Revenue',        title: 'Revenue',      emphasis: 'management',      sub: 'Pricing · pace · channels · yield' },
  operations:  { eyebrow: 'Pillar 02 · Operations',     title: 'Operations',   emphasis: 'live',            sub: 'Today · F&B · spa · activities · property' },
  guest:       { eyebrow: 'Pillar 03 · Guest',          title: 'Guest',        emphasis: 'voice',           sub: 'Reviews · reputation · journey · loyalty · social' },
  finance:     { eyebrow: 'Pillar 04 · Finance',        title: 'USALI',        emphasis: 'ledger',          sub: 'P&L · ledger · budget · variance' },
  knowledge:   { eyebrow: 'Knowledge',                  title: 'Repos',        emphasis: '& agents',        sub: 'SOPs · brand · automation' },
  settings:    { eyebrow: 'Settings',                   title: 'Property',     emphasis: 'configuration',   sub: 'Preferences · users · API keys' },
};
