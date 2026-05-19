'use client';

import type { CSSProperties } from 'react';

export default function EmptyState({ title, hint, height }: { title: string; hint?: string; height?: number }) {
  return (
    <div style={{ ...S.wrap, minHeight: height ?? 200 }}>
      <div style={S.title}>{title}</div>
      {hint && <div style={S.hint}>{hint}</div>}
    </div>
  );
}

const S: Record<string, CSSProperties> = {
  wrap: {
    border: '1px dashed var(--hairline, #E6DFCC)',
    borderRadius: 6,
    padding: 24,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    color: 'var(--ink-soft, #5A5A5A)',
    textAlign: 'center',
  },
  title: { fontSize: 13, fontWeight: 600 },
  hint: { fontSize: 11 },
};
