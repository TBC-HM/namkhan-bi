// components/ops/DataNeededOverlay.tsx
// Yellow "Data needed" overlay — rendered on any panel whose backing table is not yet populated.
// Per /revenue IA standard: structurally render the panel, never fabricate placeholder data.

import { ReactNode } from 'react';

interface Props {
  gap: string;          // e.g. "Gap-H1" or "Gap-M2"
  table?: string;       // e.g. "ops.room_status"
  reason?: string;      // free-text explanation
  cta?: ReactNode;      // optional action button (e.g. "Add intake")
}

export default function DataNeededOverlay({ gap, table, reason, cta }: Props) {
  return (
    <div
      style={{
        position: 'relative',
        padding: '14px 16px',
        background: '#fef3c7',
        border: '1px solid #f3d57a',
        borderRadius: 8,
        color: '#5e4818',
        fontSize: 12.5,
        lineHeight: 1.5,
        margin: '8px 0',
      }}
    >
      <div
        style={{
          display: 'inline-block',
          fontSize: 9.5,
          background: 'var(--paper-warm)',
          border: '1px solid #f3d57a',
          color: '#5e4818',
          padding: '1px 6px',
          borderRadius: 3,
          textTransform: 'uppercase',
          letterSpacing: '0.06em',
          fontWeight: 700,
          marginRight: 8,
        }}
      >
        Data needed · {gap}
      </div>
      {table && (
        <code style={{ fontSize: 11, color: '#7a5a1a' }}>{table}</code>
      )}
      {reason && <div style={{ marginTop: 6 }}>{reason}</div>}
      {cta && <div style={{ marginTop: 8 }}>{cta}</div>}
    </div>
  );
}
