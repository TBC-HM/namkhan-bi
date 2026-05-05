// components/sections/SlimHero.tsx
//
// Slim full-width hero used by Operations · F&B / Spa / Activities / Inventory
// (and any future page that needs the same moss + brass banner).
//
// Pattern locked 2026-05-04 to match the Spa & Activities pattern that the
// user prefers. Centralised here so a single edit updates every page that
// imports it.

import * as React from 'react';

export interface SlimHeroProps {
  /** Mono uppercase label above the title (e.g. "F&B · Last 30 days"). */
  eyebrow: string;
  /** Main title — first word is plain, second is italic brass via `emphasis`. */
  title: string;
  /** Italic brass emphasis word/phrase rendered next to the title. */
  emphasis?: string;
  /** Optional italic sub-line after the title (e.g. "revenue · cost ratios · covers"). */
  sub?: string;
  /** Optional right-aligned action slot (sync buttons, upload, etc.). */
  rightSlot?: React.ReactNode;
}

export default function SlimHero({ eyebrow, title, emphasis, sub, rightSlot }: SlimHeroProps) {
  return (
    <div style={{
      background: 'var(--moss)',
      color: 'var(--paper-warm)',
      borderLeft: '4px solid var(--brass)',
      padding: '14px 22px',
      marginBottom: 12,
      display: 'flex',
      alignItems: 'center',
      gap: 16,
    }}>
      <div style={{ flex: 1, minWidth: 0 }}>
      <div style={{
        fontFamily: 'var(--mono)',
        fontSize: 'var(--t-xs)',
        letterSpacing: 'var(--ls-extra)',
        textTransform: 'uppercase',
        color: 'var(--brass-soft)',
        fontWeight: 600,
        marginBottom: 4,
      }}>{eyebrow}</div>
      <h2 style={{
        margin: 0,
        fontFamily: 'var(--serif)',
        fontWeight: 400,
        fontSize: 'var(--t-2xl)',
        lineHeight: 1.1,
        color: 'var(--paper-warm)',
      }}>
        {title}
        {emphasis ? (
          <>
            {' '}
            <em style={{ color: 'var(--brass)', fontStyle: 'italic' }}>{emphasis}</em>
          </>
        ) : null}
        {sub ? (
          <span style={{
            marginLeft: 14,
            fontFamily: 'var(--serif)',
            fontStyle: 'italic',
            fontSize: 'var(--t-xs)',
            color: 'rgba(245, 233, 207, 0.78)',
          }}>{sub}</span>
        ) : null}
      </h2>
      </div>
      {rightSlot ? (
        <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexShrink: 0 }}>
          {rightSlot}
        </div>
      ) : null}
    </div>
  );
}
