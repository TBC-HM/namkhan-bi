// app/revenue/_subpages.ts
// Shared sub-pages list rendered by the <Page subPages={REVENUE_SUBPAGES}> strip
// on every revenue sub-route. Single source of truth so adding/removing a tab
// changes one file.

export const REVENUE_SUBPAGES = [
  { label: 'Pulse',    href: '/revenue/pulse'    },
  { label: 'Pace',     href: '/revenue/pace'     },
  { label: 'Channels', href: '/revenue/channels' },
  { label: 'Pricing',  href: '/revenue/pricing'  },
  { label: 'Compset',  href: '/revenue/compset'  },
  { label: 'Demand',   href: '/revenue/demand'   },
];
