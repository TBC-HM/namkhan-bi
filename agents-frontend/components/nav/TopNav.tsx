'use client';

// components/nav/TopNav.tsx
// Main horizontal navigation. AI Agents inserted between Marketing and Finance.

import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';

interface TopNavItem {
  href: string;
  title: string;
  sub: string;
}

const ITEMS: TopNavItem[] = [
  { href: '/overview',    title: 'Overview',         sub: 'Owner' },
  { href: '/today',       title: "Today's Snapshot", sub: 'Operations' },
  { href: '/actions',     title: 'Action Plans',     sub: 'Recommendations' },
  { href: '/revenue',     title: 'Revenue',          sub: 'Management' },
  { href: '/departments', title: 'Departments',      sub: 'F&B · Spa · Activities' },
  { href: '/marketing',   title: 'Marketing',        sub: 'Reviews · Social · Media' },
  { href: '/agents',      title: 'AI Agents',        sub: 'Crew · Predictions · What-If' },
  { href: '/finance',     title: 'Finance',          sub: 'P&L · Budget · Ledger' },
];

export default function TopNav() {
  const pathname = usePathname();
  const sp = useSearchParams();
  const qs = sp.toString();

  return (
    <div className="nav-wrap">
      <nav className="nav">
        {ITEMS.map((it) => {
          const active = pathname.startsWith(it.href);
          const href = qs ? `${it.href}?${qs}` : it.href;
          return (
            <Link key={it.href} href={href} className={active ? 'active' : ''}>
              <span className="nav-title">{it.title}</span>
              <span className="nav-sub">{it.sub}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
