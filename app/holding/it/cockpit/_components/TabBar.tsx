'use client';

// app/holding/it/cockpit/_components/TabBar.tsx
// Persistent tab strip rendered inside the cockpit-v2 layout. Uses
// Next.js Link + usePathname so the active state survives navigation.
// Counts are passed in by the server layout so each tab can show a live
// count without each tab page having to refetch.

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { TOKENS, SERIF, MONO } from './tokens';

type TabSpec = { href: string; label: string; n?: number | null };

export function TabBar({ tabs }: { tabs: TabSpec[] }) {
  const path = usePathname() || '';
  return (
    <nav
      style={{
        background: TOKENS.bgRaised,
        borderBottom: `1px solid ${TOKENS.border}`,
        padding: '0 32px',
        display: 'flex',
        gap: 0,
        flexWrap: 'wrap',
      }}
    >
      {tabs.map((t) => {
        const active = path === t.href || path.startsWith(t.href + '/');
        return (
          <Link
            key={t.href}
            href={t.href}
            style={{
              padding: '16px 22px',
              border: 'none',
              background: 'transparent',
              color: active ? TOKENS.ink : TOKENS.text2,
              fontSize: 14,
              fontWeight: active ? 600 : 500,
              cursor: 'pointer',
              borderBottom: `2px solid ${active ? TOKENS.terracotta : 'transparent'}`,
              marginBottom: -1,
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              fontFamily: SERIF,
              letterSpacing: 0.5,
              textDecoration: 'none',
              transition: 'color 120ms',
            }}
          >
            {t.label}
            {typeof t.n === 'number' && (
              <span style={{ fontFamily: MONO, fontSize: 11, opacity: 0.55, fontWeight: 400 }}>{t.n}</span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}
