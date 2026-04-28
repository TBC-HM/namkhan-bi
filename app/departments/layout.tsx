import { SubNav } from '@/components/nav/SubNav';
import { ReactNode } from 'react';
const items = [
  { href: '/departments/roots', label: 'Roots (F&B)' },
  { href: '/departments/spa-activities', label: 'Spa & Activities' }
];
export default function L({ children }: { children: ReactNode }) {
  return (<div className="pt-6"><SubNav items={items} />{children}</div>);
}
