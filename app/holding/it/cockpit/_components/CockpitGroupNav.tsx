'use client';

// app/holding/it/cockpit/_components/CockpitGroupNav.tsx
// PBS 2026-07-24 v2: fixed active group detection — check sub-tabs first
// (most specific match) before falling back to exact group href, avoiding
// the Home group stealing all /holding/it/cockpit/* paths via prefix match.

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { GROUPS } from '../_lib/groups';

const GROUP_TAB: React.CSSProperties = {
  fontSize: 13, fontWeight: 500, padding: '8px 14px',
  textDecoration: 'none', color: '#5A5A5A',
  borderBottom: '2px solid transparent', display: 'inline-block',
  whiteSpace: 'nowrap',
};
const SUB_TAB: React.CSSProperties = {
  fontSize: 12, fontWeight: 500, padding: '6px 10px',
  textDecoration: 'none', color: '#5A5A5A',
  borderBottom: '2px solid transparent', display: 'inline-block',
  whiteSpace: 'nowrap',
};

export default function CockpitGroupNav() {
  const pathname = usePathname() ?? '';

  // Check sub-tabs first (most specific), then exact group href.
  // Never use startsWith for the group href — all cockpit paths start with
  // /holding/it/cockpit/ which would make Home steal every match.
  const active =
    GROUPS.find(g => g.subs.length > 0 && (
      g.subs.some(s => pathname === s.href || pathname.startsWith(s.href + '/'))
      || pathname === g.href
    )) ??
    GROUPS.find(g => g.subs.length === 0 && pathname === g.href) ??
    GROUPS[0];

  return (
    <div style={{ background: '#FFFFFF', borderBottom: '1px solid #E6DFCC' }}>
      {/* Group row */}
      <nav style={{ display: 'flex', padding: '0 24px', gap: 0, overflowX: 'auto' }}>
        {GROUPS.map(g => {
          const isActive = g.key === active.key;
          return (
            <Link key={g.key} href={g.href} style={{
              ...GROUP_TAB,
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
        <nav style={{ display: 'flex', padding: '0 24px', gap: 0, overflowX: 'auto', background: '#FAFAF7', borderTop: '1px solid #E6DFCC' }}>
          {active.subs.map(s => {
            const isSub = pathname === s.href || pathname.startsWith(s.href + '/');
            const isNew = s.label === '+ New spec';
            return (
              <Link key={s.href} href={s.href} style={{
                ...SUB_TAB,
                color: isNew ? '#1F3A2E' : (isSub ? '#1B1B1B' : '#5A5A5A'),
                fontWeight: isSub || isNew ? 600 : 500,
                borderBottomColor: isSub ? '#1F3A2E' : 'transparent',
              }}>
                {s.label}
              </Link>
            );
          })}
        </nav>
      )}
    </div>
  );
}
