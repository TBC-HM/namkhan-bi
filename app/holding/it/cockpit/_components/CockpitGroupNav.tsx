'use client';

// app/holding/it/cockpit/_components/CockpitGroupNav.tsx
// PBS 2026-07-24: persistent group + sub-strip for the IT Cockpit.
// Sits in the layout so ALL cockpit pages get navigation — even legacy pages
// that don't use DashboardPage (e.g. Deploys, Tasks, Skills).
// Reads pathname client-side → renders the matching group's sub-tabs.

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { GROUPS } from '../_lib/groups';

const BASE = '/holding/it/cockpit';

const GROUP_STYLE = {
  fontSize: 13,
  fontWeight: 500,
  padding: '8px 14px',
  textDecoration: 'none',
  color: '#5A5A5A',
  borderBottom: '2px solid transparent',
  display: 'inline-block',
  whiteSpace: 'nowrap' as const,
};

const SUB_STYLE = {
  fontSize: 12,
  fontWeight: 500,
  padding: '6px 10px',
  textDecoration: 'none',
  color: '#5A5A5A',
  borderBottom: '2px solid transparent',
  display: 'inline-block',
  whiteSpace: 'nowrap' as const,
};

export default function CockpitGroupNav() {
  const pathname = usePathname() ?? '';

  // Find active group
  const active = GROUPS.find(g =>
    pathname === g.href ||
    pathname.startsWith(g.href + '/') ||
    g.subs.some(s => pathname === s.href || pathname.startsWith(s.href + '/'))
  ) ?? GROUPS[0];

  return (
    <div style={{ background: '#FFFFFF', borderBottom: '1px solid #E6DFCC' }}>
      {/* Group row */}
      <nav style={{ display: 'flex', padding: '0 24px', gap: 0, overflowX: 'auto' }}>
        {GROUPS.map(g => {
          const isActive = g.key === active.key;
          return (
            <Link key={g.key} href={g.href} style={{
              ...GROUP_STYLE,
              color: isActive ? '#1B1B1B' : '#5A5A5A',
              fontWeight: isActive ? 600 : 500,
              borderBottomColor: isActive ? '#1F3A2E' : 'transparent',
            }}>
              {g.label}
            </Link>
          );
        })}
      </nav>

      {/* Sub-strip — only when active group has subs */}
      {active.subs.length > 0 && (
        <nav style={{ display: 'flex', padding: '0 24px', gap: 0, overflowX: 'auto', background: '#FAFAF7' }}>
          {active.subs.map(s => {
            const isSub = pathname === s.href || pathname.startsWith(s.href + '/');
            const label = s.label;
            const isNewSpec = s.label === '+ New spec';
            return (
              <Link key={s.href} href={s.href} style={{
                ...SUB_STYLE,
                color: isNewSpec ? '#1F3A2E' : (isSub ? '#1B1B1B' : '#5A5A5A'),
                fontWeight: isSub || isNewSpec ? 600 : 500,
                borderBottomColor: isSub ? '#1F3A2E' : 'transparent',
                background: isNewSpec ? 'transparent' : undefined,
              }}>
                {label}
              </Link>
            );
          })}
        </nav>
      )}
    </div>
  );
}
