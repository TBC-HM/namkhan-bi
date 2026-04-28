import { SubNav } from '@/components/nav/SubNav';
import { ReactNode } from 'react';

const items = [
  { href: '/revenue/pulse', label: 'Pulse' },
  { href: '/revenue/demand', label: 'Demand' },
  { href: '/revenue/channels', label: 'Channels' },
  { href: '/revenue/rates', label: 'Rates' },
  { href: '/revenue/rateplans', label: 'Rate Plans' },
  { href: '/revenue/inventory', label: 'Inventory' },
  { href: '/revenue/compset', label: 'Comp Set', live: false },
  { href: '/revenue/promotions', label: 'Promotions', live: false }
];

export default function RevenueLayout({ children }: { children: ReactNode }) {
  return (
    <div className="pt-6">
      <SubNav items={items} />
      {children}
    </div>
  );
}
