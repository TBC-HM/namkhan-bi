'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { CurrencyToggle } from '@/components/ui/CurrencyToggle';

const TABS: { href: string; title: string; sub: string; live: boolean }[] = [
  { href: '/overview', title: 'Overview', sub: 'Owner', live: true },
  { href: '/today', title: "Today's Snapshot", sub: 'Operations', live: false },
  { href: '/actions', title: 'Action Plans', sub: 'Recommendations', live: false },
  { href: '/revenue', title: 'Revenue', sub: 'Management', live: true },
  { href: '/departments', title: 'Departments', sub: 'F&B · Spa · Activities', live: true },
  { href: '/finance', title: 'Finance', sub: 'P&L · Budget · Ledger', live: true }
];

export function TopNav() {
  const pathname = usePathname();
  return (
    <div className="border-y border-line bg-bg sticky top-0 z-40">
      <div className="max-w-[1500px] mx-auto px-8">
        <nav className="flex items-stretch justify-between">
          <div className="flex">
            {TABS.map(t => {
              const active = pathname === t.href || pathname.startsWith(t.href + '/');
              return (
                <Link
                  key={t.href}
                  href={t.href}
                  className={`flex flex-col py-4 pr-7 ${active ? 'text-text border-b-2 border-sand' : 'text-muted hover:text-text'} ${!t.live ? 'opacity-60' : ''}`}
                >
                  <span className="serif text-[18px] leading-none">{t.title}</span>
                  <span className={`text-[9px] tracking-wide3 uppercase mt-1 ${active ? 'text-sand' : 'text-muted'}`}>
                    {t.sub}{!t.live && ' · soon'}
                  </span>
                </Link>
              );
            })}
          </div>
          <div className="flex items-center pr-2">
            <CurrencyToggle />
          </div>
        </nav>
      </div>
    </div>
  );
}
