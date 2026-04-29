'use client';

// components/nav/TopNav.tsx
// Main horizontal navigation: 9 top-level tabs.
// Active state determined by pathname prefix.

import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';

interface TopNavItem {
  href: string;
  title: string;
  sub: string;
}

const ITEMS: TopNavItem[] = [
  { href: '/overview',      title: 'Overview',        sub: 'Owner' },
  { href: '/today',         title: "Today's Snapshot", sub: 'Operations' },
  { href: '/actions',       title: 'Action Plans',    sub: 'Recommendations' },
  { href: '/revenue',       title: 'Revenue',         sub: 'Management' },
  { href: '/departments',   title: 'Departments',     sub: 'F&B · Spa · Activities' },
  { href: '/finance',       title: 'Finance',         sub: 'P&L · Budget · Ledger' },
  { href: '/marketing',     title: 'Marketing',       sub: 'Channels · Reviews' },
  { href: '/agents',        title: 'Agents',          sub: 'AI · Automation' },
  { href: '/period-wiring', title: 'Period Wiring',   sub: 'Config' },
];

export default function TopNav() {
  const pathname = usePathname();
  const sp = useSearchParams();
  const qs = sp.toString();

  return (
    <nav className="top-nav">
      {ITEMS.map((item) => {
        const active = pathname.startsWith(item.href);
        const href = qs ? `${item.href}?${qs}` : item.href;
        return (
          <Link key={item.href} href={href} className={`top-nav__item${active ? ' top-nav__item--active' : ''}`}>
            <span className="top-nav__title">{item.title}</span>
            <span className="top-nav__sub">{item.sub}</span>
          </Link>
        );
      })}
    </nav>
  );
}
