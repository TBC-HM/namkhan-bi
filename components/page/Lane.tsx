// components/page/Lane.tsx — one column of the 3-state kanban. Renders
// proposals (in compact lane mode) under a labeled header.

import type { ReactNode } from 'react';

interface Props {
  label: string;
  /** Brass / amber / moss accent for the column eyebrow. */
  accent: string;
  count: number;
  emptyLabel?: string;
  children: ReactNode;
}

export default function Lane({ label, accent, count, emptyLabel = 'nothing here', children }: Props) {
  return (
    <div style={S.col}>
      <div style={S.head}>
        <span style={{ ...S.label, color: accent }}>{label}</span>
        <span style={S.count}>{count}</span>
      </div>
      <div style={S.body}>
        {count === 0 ? <div style={S.empty}>{emptyLabel}</div> : children}
      </div>
    </div>
  );
}

const S: Record<string, React.CSSProperties> = {
  col: {
    background: '#0f0d0a', border: '1px solid #1f1c15', borderRadius: 12,
    padding: '12px 14px', display: 'flex', flexDirection: 'column', minHeight: 220,
  },
  head: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    marginBottom: 10, paddingBottom: 6, borderBottom: '1px solid #1f1c15',
  },
  label: {
    fontFamily: "'JetBrains Mono', ui-monospace, monospace",
    fontSize: 10, letterSpacing: '0.22em', textTransform: 'uppercase',
  },
  count: {
    fontFamily: "'JetBrains Mono', ui-monospace, monospace",
    fontSize: 10, color: '#5a5448',
  },
  body: { display: 'flex', flexDirection: 'column', gap: 8 },
  empty: { fontSize: 12, color: '#5a5040', fontStyle: 'italic', padding: '8px 4px' },
};
