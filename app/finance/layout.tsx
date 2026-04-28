import { SubNav } from '@/components/nav/SubNav';
import { ReactNode } from 'react';
const items = [
  { href: '/finance/pnl', label: 'P&L' },
  { href: '/finance/budget', label: 'Budget', live: false },
  { href: '/finance/ledger', label: 'Guest Ledger & Deposits' }
];
export default function L({ children }: { children: ReactNode }) {
  return (<div className="pt-6"><SubNav items={items} />{children}</div>);
}
