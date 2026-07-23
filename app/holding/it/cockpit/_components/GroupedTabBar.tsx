'use client';

// app/holding/it/cockpit/_components/GroupedTabBar.tsx
// PBS 2026-05-17: 14-flat-button bar replaced with 5 top groups + per-active
// group sub-strip. Same component pattern as /finance — top strip + sub-strip
// when a group is open. Routes outside any group fall back to "Home".

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { TOKENS, SERIF, MONO } from './tokens';

export type SubTab = { href: string; label: string; n?: number | null };
export type Group = { key: string; label: string; href: string; subs: SubTab[] };

interface Props {
  groups: Group[];
}

export function GroupedTabBar({ groups }: Props) {
  const path = usePathname() || '';

  // resolve active group: first group whose href OR sub.href is a prefix of path
  const active = groups.find((g) =>
    path === g.href ||
    path.startsWith(g.href + '/') ||
    g.subs.some((s) => path === s.href || path.startsWith(s.href + '/'))
  ) ?? groups[0];

  return (
    <>
      {/* Top — 5 groups */}
      <nav style={{
        background: TOKENS.bgRaised,
        borderBottom: `1px solid ${TOKENS.border}`,
        padding: '0 32px',
        display: 'flex', gap: 0, flexWrap: 'wrap',
      }}>
        {groups.map((g) => {
          const isActive = g.key === active.key;
          return (
            <Link key={g.key} href={g.href}
              style={{
                padding: '16px 28px',
                color: isActive ? TOKENS.ink : TOKENS.text2,
                fontSize: 15, fontWeight: isActive ? 600 : 500,
                fontFamily: SERIF, letterSpacing: 0.5, textDecoration: 'none',
                borderBottom: `3px solid ${isActive ? TOKENS.brass : 'transparent'}`,
                marginBottom: -1, transition: 'color 120ms',
              }}>
              {g.label}
            </Link>
          );
        })}
      </nav>

      {/* Sub-strip — only when the active group has subs */}
      {active.subs.length > 0 && (
        <nav style={{
          background: TOKENS.bg,
          borderBottom: `1px solid ${TOKENS.borderSoft}`,
          padding: '0 32px',
          display: 'flex', gap: 0, flexWrap: 'wrap',
        }}>
          {active.subs.map((s) => {
            const isSubActive = path === s.href || path.startsWith(s.href + '/');
            return (
              <Link key={s.href} href={s.href}
                style={{
                  padding: '10px 18px',
                  color: isSubActive ? TOKENS.brass : TOKENS.text2,
                  fontFamily: MONO, fontSize: 11, letterSpacing: '0.12em',
                  textTransform: 'uppercase', fontWeight: isSubActive ? 600 : 500,
                  borderBottom: `2px solid ${isSubActive ? TOKENS.brass : 'transparent'}`,
                  marginBottom: -1, textDecoration: 'none',
                  display: 'inline-flex', alignItems: 'center', gap: 6,
                }}>
                {s.label}
                {typeof s.n === 'number' && (
                  <span style={{ opacity: 0.55, fontSize: 10 }}>{s.n}</span>
                )}
              </Link>
            );
          })}
        </nav>
      )}
    </>
  );
}
