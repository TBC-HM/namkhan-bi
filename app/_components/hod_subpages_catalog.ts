// app/_components/hod_subpages_catalog.ts
// PBS 2026-07-08: curated subpage lists per dept for the ShortcutsPanel dropdown.
// Each entry becomes an `<option>` in the "Pick a page" picker on that dept's HoD landing.

export interface SubpageOption { href: string; label: string }

export const SUBPAGES_BY_DEPT: Record<string, SubpageOption[]> = {
  revenue: [
    { href: '/revenue',                         label: 'Revenue HoD (Vector)' },
    { href: '/revenue/pulse',                   label: 'Pulse' },
    { href: '/revenue/pricing',                 label: 'Calendar · Pricing' },
    { href: '/revenue/pricing?tab=holidays',    label: 'Calendar · Holidays' },
    { href: '/revenue/pricing?tab=otb_density', label: 'Calendar · OTB Density' },
    { href: '/revenue/pricing?tab=restrictions',label: 'Calendar · Restrictions' },
    { href: '/revenue/rateplans',               label: 'Rate Plans' },
    { href: '/revenue/demand',                  label: 'Demand' },
    { href: '/revenue/pace',                    label: 'Pace' },
    { href: '/revenue/pickup',                  label: 'Pickup · Monthly' },
    { href: '/revenue/pickup-day',              label: 'Pickup · Daily' },
    { href: '/revenue/cancellations',           label: 'Cancellations' },
    { href: '/revenue/compset',                 label: 'Comp Set' },
    { href: '/revenue/leakage',                 label: 'Leakage' },
    { href: '/revenue/parity',                  label: 'Parity' },
    { href: '/revenue/lighthouse/overview',     label: 'Lighthouse · Overview' },
    { href: '/revenue/lighthouse/rates',        label: 'Lighthouse · Rates' },
    { href: '/revenue/lighthouse/vs-yesterday', label: 'Lighthouse · vs Yesterday' },
    { href: '/revenue/channels',                label: 'Channels' },
    { href: '/revenue/rooms',                   label: 'Rooms' },
    { href: '/revenue/markets',                 label: 'Markets' },
    { href: '/revenue/reports/scheduled/daily/preview',   label: 'Daily report preview' },
    { href: '/revenue/reports/scheduled/weekly/preview',  label: 'Weekly report preview' },
    { href: '/revenue/reports/scheduled/monthly/preview', label: 'Monthly report preview' },
  ],

  guest: [
    { href: '/guest',                    label: 'Contacts HoD (Felix)' },
    { href: '/guest/directory',          label: 'Directory' },
    { href: '/guest/newsletters',        label: 'Newsletters' },
    { href: '/guest/journey',            label: 'Journey' },
    { href: '/guest/loyalty',            label: 'Loyalty' },
    { href: '/guest/reputation',         label: 'Reputation' },
    { href: '/guest/prospects',          label: 'Prospects' },
    { href: '/guest/segments',           label: 'Segments' },
    { href: '/guest/media',              label: 'Media library' },
  ],

  finance: [
    { href: '/finance',                  label: 'Finance HoD (Intel)' },
    { href: '/finance/pnl',              label: 'P&L · month' },
    { href: '/finance/pnl?period=YTD-2026', label: 'P&L · YTD' },
    { href: '/finance/banks',            label: 'Banks · cash flow' },
    { href: '/finance/budget',           label: 'Budget vs Actual' },
    { href: '/finance/transactions',     label: 'Transactions explorer' },
    { href: '/finance/hr/payroll',       label: 'Payroll register' },
    { href: '/finance/hr',               label: 'HR' },
    { href: '/finance/legal',            label: 'Legal' },
    { href: '/finance/legal/docs',       label: 'Legal · docs' },
    { href: '/finance/legal/cases',      label: 'Legal · cases' },
  ],

  sales: [
    { href: '/departments/sales',        label: 'Sales HoD (Mercer)' },
    { href: '/departments/sales/b2b',    label: 'B2B partners' },
    { href: '/departments/sales/inquiries', label: 'Inquiries' },
    { href: '/departments/sales/contracts', label: 'Contracts' },
  ],

  marketing: [
    { href: '/marketing',                label: 'Marketing HoD (Lumen)' },
    { href: '/marketing/campaigns',      label: 'Campaigns' },
    { href: '/marketing/funnels',        label: 'Funnels' },
    { href: '/marketing/prospects',      label: 'Prospects engine' },
    { href: '/marketing/prospects/sequences', label: 'Sequences' },
    { href: '/marketing/docs',           label: 'Docs' },
    { href: '/marketing/reputation',     label: 'Reputation' },
    { href: '/marketing/seo',            label: 'SEO' },
    { href: '/marketing/agents',         label: 'Agents' },
  ],

  operations: [
    { href: '/departments',              label: 'Operations HoD (Forge)' },
    { href: '/operations/restaurant',    label: 'Restaurant' },
    { href: '/operations/spa',           label: 'Spa' },
    { href: '/operations/activities',    label: 'Activities' },
    { href: '/operations/retail',        label: 'Retail' },
    { href: '/operations/transport',     label: 'Transport' },
    { href: '/operations/other',         label: 'Other services' },
  ],
};
