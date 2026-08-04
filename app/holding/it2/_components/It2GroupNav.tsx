'use client';

// app/holding/it2/_components/It2GroupNav.tsx
// PBS 2026-07-30 — IT2 group nav. Same two-row pattern as CockpitGroupNav
// (group strip + context-aware sub-strip) but reads the IT2 GROUPS array.
// Active detection: most specific sub-tab match first, then exact group href.
// 2026-08-03 — ⚙ gear added right-aligned in top bar (PBS: top-level placement).

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

export default function It2GroupNav() {
  const pathname = usePathname() ?? '';
  const onSettings = pathname.startsWith('/holding/settings');

  const active =
    GROUPS.find(g => g.subs.length > 0 && (
      g.subs.some(s => pathname === s.href || pathname.startsWith(s.href + '/'))
      || pathname === g.href
    )) ??
    GROUPS.find(g => g.subs.length === 0 && pathname === g.href) ??
    GROUPS[0];

  return (
    <div style={{ background: '#FFFFFF', borderBottom: '1px solid #E6DFCC' }}>
      <nav style={{ display: 'flex', alignItems: 'center', padding: '0 24px', gap: 0, overflowX: 'auto' }}>
        {GROUPS.map(g => {
          const isActive = !onSettings && g.key === active.key;
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
        <Link href="/holding/settings" title="Platform Settings" style={{
          ...GROUP_TAB,
          marginLeft: 'auto',
          fontSize: 16,
          padding: '6px 14px',
          color: onSettings ? '#1B1B1B' : '#5A5A5A',
          fontWeight: onSettings ? 600 : 500,
          borderBottomColor: onSettings ? '#1F3A2E' : 'transparent',
        }}>
          ⚙
        </Link>
      </nav>

      {!onSettings && active.subs.length > 0 && (
        <nav style={{ display: 'flex', padding: '0 24px', gap: 0, overflowX: 'auto', background: '#FAFAF7', borderTop: '1px solid #E6DFCC' }}>
          {active.subs.map(s => {
            const isSub = pathname === s.href || pathname.startsWith(s.href + '/');
            const isNew = s.label === '+ Intake';
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
