// app/revenue/lighthouse/_shared/LighthouseNav.tsx
// Client-side sub-nav: rewrites hrefs with the tenant prefix (/h/PID) when
// the current URL is tenant-scoped so clicks stay on the same tenant.

'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { prefixTabHref } from '@/lib/nav-subgroups';

export type LighthouseView = 'overview' | 'rates' | 'yesterday' | 'three_days' | 'seven_days';

export const LIGHTHOUSE_VIEWS: Array<{ key: LighthouseView; href: string; label: string }> = [
  { key: 'overview',    href: '/revenue/lighthouse/overview',      label: 'Overview'      },
  { key: 'rates',       href: '/revenue/lighthouse/rates',         label: 'Rates'         },
  { key: 'yesterday',   href: '/revenue/lighthouse/vs-yesterday',  label: 'vs Yesterday'  },
  { key: 'three_days',  href: '/revenue/lighthouse/vs-3d',         label: 'vs 3 days ago' },
  { key: 'seven_days',  href: '/revenue/lighthouse/vs-7d',         label: 'vs 7 days ago' },
];

export function LighthouseNav({ active }: { active: LighthouseView }) {
  const pathname = usePathname() ?? '';
  return (
    <nav style={strip} role="tablist" aria-label="Lighthouse views">
      {LIGHTHOUSE_VIEWS.map((v) => {
        const isActive = v.key === active;
        const href = prefixTabHref(pathname, v.href);
        return (
          <Link key={v.key} href={href} role="tab" aria-selected={isActive}
            style={{ ...tab, ...(isActive ? tabActive : null) }}>
            {v.label}
          </Link>
        );
      })}
    </nav>
  );
}

const strip: React.CSSProperties = {
  display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap',
  padding: '6px 0', borderBottom: '1px solid #E6DFCC',
};
const tab: React.CSSProperties = {
  padding: '6px 10px', fontSize: 12, fontWeight: 500,
  color: '#5A5A5A', textDecoration: 'none', borderBottom: '2px solid transparent',
};
const tabActive: React.CSSProperties = {
  color: '#1B1B1B', fontWeight: 700, borderBottomColor: '#084838',
};
