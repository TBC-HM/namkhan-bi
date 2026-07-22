'use client';
// app/marketing/audience/_components/AudienceSubTabs.tsx
// PBS 2026-07-21 · Audience sub-strip [Audience · Scrape Engine].
// Canonical SubTabStrip pattern (matches ClarifyTab in /marketing/media):
//   padding 4px 8px · fontSize 12 · gap 8 · role='tablist' ·
//   2px solid #1F3A2E active border · transparent inactive border.

import type { CSSProperties } from 'react';

const HAIR = '#E6DFCC';
const INK      = 'var(--ink, #1B1B1B)';
const INK_SOFT = 'var(--ink-soft, #5A5A5A)';
const PRIMARY  = 'var(--primary, #1F3A2E)';

export type AudienceSubTabKey = 'audience' | 'scrape';

interface Props {
  active: AudienceSubTabKey;
  onChange: (k: AudienceSubTabKey) => void;
}

export default function AudienceSubTabs({ active, onChange }: Props) {
  return (
    <nav
      role="tablist"
      aria-label="Audience sub-tabs"
      style={{
        display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap',
        marginTop: 2, marginBottom: 12,
        borderBottom: '1px solid ' + HAIR, paddingBottom: 4,
      }}
    >
      {(['audience','scrape'] as const).map((k) => {
        const on = active === k;
        const label = k === 'audience' ? 'Audience' : 'Scrape Engine';
        const style: CSSProperties = {
          background: 'transparent',
          border: 'none',
          padding: '4px 8px',
          fontSize: 12,
          fontWeight: on ? 600 : 500,
          color: on ? INK : INK_SOFT,
          cursor: 'pointer',
          borderBottom: on ? ('2px solid ' + PRIMARY) : '2px solid transparent',
          textDecoration: 'none',
          fontFamily: 'inherit',
        };
        return (
          <button
            key={k}
            role="tab"
            aria-selected={on}
            onClick={() => onChange(k)}
            style={style}
          >
            {label}
          </button>
        );
      })}
    </nav>
  );
}
