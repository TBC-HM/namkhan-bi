// app/revenue/layout.tsx
// Revenue section layout — adds horizontal sub-navigation per mockup.

import SubNav from '@/components/nav/SubNav';

export default function RevenueLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <SubNav
        items={[
          { label: 'Pulse', href: '/revenue/pulse' },
          { label: 'Demand', href: '/revenue/demand' },
          { label: 'Channels', href: '/revenue/channels' },
          { label: 'Rates', href: '/revenue/rates' },
          { label: 'Rate Plans', href: '/revenue/rateplans' },
          { label: 'Comp Set', href: '/revenue/compset', coming: true },
          { label: 'Promotions', href: '/revenue/promotions', coming: true },
          { label: 'Inventory', href: '/revenue/inventory' },
        ]}
      />
      {children}
    </>
  );
}
