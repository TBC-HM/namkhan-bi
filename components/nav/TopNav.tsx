'use client';

// components/nav/TopNav.tsx
// Main horizontal navigation: 8 top-level tabs + ND button on the right.
// Active state determined by pathname prefix.
// 2026-05-08: ND button restored — was working before working-tree rollback.

import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import NDButton from './NDButton';

interface TopNavItem {
    href: string;
    title: string;
    sub: string;
}

const ITEMS: TopNavItem[] = [
  { href: '/overview',    title: 'Overview',          sub: 'Owner' },
  { href: '/today',       title: "Today's Snapshot",  sub: 'Operations' },
  { href: '/actions',     title: 'Action Plans',      sub: 'Recommendations' },
  { href: '/revenue',     title: 'Revenue',           sub: 'Management' },
  { href: '/departments', title: 'Departments',       sub: 'F&B · Spa · Activities' },
  { href: '/finance',     title: 'Finance',           sub: 'P&L · Budget · Ledger' },
  { href: '/marketing',   title: 'Marketing',         sub: 'Channels · Reviews' },
  { href: '/agents',      title: 'Agents',            sub: 'AI · Automation' },
  ];

export default function TopNav() {
    const pathname = usePathname();
    const sp = useSearchParams();
    const qs = sp.toString();

  return (
        <div className="nav-wrap" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
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
              <div style={{ paddingRight: 12 }}>
                <NDButton />
              </div>
        </div>
      );
}
