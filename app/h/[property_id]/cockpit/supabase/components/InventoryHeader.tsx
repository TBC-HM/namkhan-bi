// Summary header for the Supabase Inventory page.
// Purely text — no bespoke card chrome. Brief acceptance #3:
// no foreign-visual imports.

'use client';

import type { CSSProperties } from 'react';

interface Props {
  total: number;
  green: number;
  red: number;
  amber: number;
  propertyName: string;
}

export default function InventoryHeader({ total, green, red, amber, propertyName }: Props) {
  return (
    <div style={S.wrap}>
      <div style={S.summary}>
        <span style={S.totalNum}>{total}</span>
        <span style={S.totalLabel}>items</span>
        <span style={S.sep}>·</span>
        <span style={{ ...S.split, color: 'var(--status-green, #2E7D32)' }}>{green} wired</span>
        <span style={S.sep}>·</span>
        <span style={{ ...S.split, color: 'var(--status-red, #B8542A)' }}>{red} not wired</span>
        {amber > 0 && (
          <>
            <span style={S.sep}>·</span>
            <span style={{ ...S.split, color: 'var(--status-amber, #B8A878)' }}>{amber} partial</span>
          </>
        )}
      </div>
      <span style={S.viewingAs}>Viewing as: <strong style={S.propName}>{propertyName}</strong></span>
    </div>
  );
}

const S: Record<string, CSSProperties> = {
  wrap: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 16,
    alignItems: 'baseline',
    justifyContent: 'space-between',
  },
  summary: { display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'baseline', fontSize: 12 },
  totalNum: { fontSize: 28, fontWeight: 600, color: 'var(--ink, #1B1B1B)', lineHeight: 1, fontVariantNumeric: 'tabular-nums' },
  totalLabel: { fontSize: 11, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--ink-soft, #5A5A5A)' },
  sep: { color: 'var(--ink-soft, #5A5A5A)' },
  split: { fontSize: 11, fontWeight: 500, letterSpacing: '0.06em', textTransform: 'uppercase' },
  viewingAs: { fontSize: 11, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--ink-soft, #5A5A5A)' },
  propName: { color: 'var(--ink, #1B1B1B)', fontWeight: 600 },
};
