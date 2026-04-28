'use client';

// components/nav/SubNav.tsx
// Horizontal pill-style sub-navigation with active state matching mockup.
// Active state: bottom border in --sand color, text in --text.
// Items can be marked `coming` to dim them and append "· soon".

import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';

export interface SubNavItem {
  label: string;
  href: string;
  coming?: boolean;
}

export default function SubNav({ items }: { items: SubNavItem[] }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const qs = searchParams.toString();

  return (
    <div className="subnav">
      {items.map((it) => {
        const active = pathname === it.href || pathname.startsWith(it.href + '/');
        const href = qs ? `${it.href}?${qs}` : it.href;
        return (
          <Link
            key={it.href}
            href={href}
            className={`subnav-btn${active ? ' active' : ''}${it.coming ? ' coming' : ''}`}
          >
            {it.label}
            {it.coming ? <span className="coming-suffix"> · soon</span> : null}
          </Link>
        );
      })}
    </div>
  );
}
