'use client';

// app/operations/housekeeping/_components/LostFound.tsx
// Recent L&F intake list. Client component because the empty-state CTA
// has an onClick handler.

import DataNeededOverlay from '@/components/ops/DataNeededOverlay';
import type { LostFoundRow } from '../_data/lostFound';

interface Props {
  rows: LostFoundRow[] | null;
}

export default function LostFound({ rows }: Props) {
  return (
    <div
      style={{
        background: 'var(--paper-warm)',
        border: '1px solid #e6dfc9',
        borderRadius: 8,
        padding: '14px 16px',
        marginTop: 12,
      }}
    >
      <h3
        style={{
          fontFamily: 'var(--serif)',
          fontSize: "var(--t-xl)",
          fontWeight: 500,
          margin: '0 0 8px',
        }}
      >
        Lost &amp; <em style={{ color: '#a17a4f' }}>found</em>
      </h3>

      {!rows || rows.length === 0 ? (
        <DataNeededOverlay
          gap="Gap-H4"
          table="ops.lost_and_found"
          reason="No intake records yet."
          cta={
            <button
              type="button"
              style={{
                background: '#a17a4f',
                color: 'var(--paper-warm)',
                border: 0,
                padding: '6px 14px',
                borderRadius: 6,
                fontSize: "var(--t-sm)",
                fontWeight: 600,
                cursor: 'pointer',
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
              }}
              onClick={() =>
                alert('Add intake — to be wired once ops.lost_and_found ships.')
              }
            >
              + Add intake
            </button>
          }
        />
      ) : (
        rows.map((r) => (
          <div
            key={r.id}
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 80px 60px',
              gap: 6,
              fontSize: "var(--t-sm)",
              padding: '6px 0',
              borderBottom: '1px dashed #e6dfc9',
              alignItems: 'center',
            }}
          >
            <span style={{ fontWeight: 600 }}>{r.item}</span>
            <span
              style={{
                fontSize: "var(--t-xs)",
                color: '#8a8170',
                fontFamily: 'ui-monospace, Menlo, monospace',
              }}
            >
              R{r.room_no}
            </span>
            <span
              style={{
                fontSize: "var(--t-xs)",
                color: '#8a8170',
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
              }}
            >
              {r.status}
            </span>
          </div>
        ))
      )}
    </div>
  );
}
