// app/operations/housekeeping/_components/LostFound.tsx
// Recent L&F intake list.

import DataNeededOverlay from '@/components/ops/DataNeededOverlay';
import type { LostFoundRow } from '../_data/lostFound';

interface Props {
  rows: LostFoundRow[] | null;
}

export default function LostFound({ rows }: Props) {
  return (
    <div
      style={{
        background: '#fff',
        border: '1px solid #e6dfc9',
        borderRadius: 8,
        padding: '14px 16px',
        marginTop: 12,
      }}
    >
      <h3
        style={{
          fontFamily: 'Georgia, serif',
          fontSize: 16,
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
                color: '#fff8eb',
                border: 0,
                padding: '6px 14px',
                borderRadius: 6,
                fontSize: 11.5,
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
              fontSize: 11.5,
              padding: '6px 0',
              borderBottom: '1px dashed #e6dfc9',
              alignItems: 'center',
            }}
          >
            <span style={{ fontWeight: 600 }}>{r.item}</span>
            <span
              style={{
                fontSize: 10,
                color: '#8a8170',
                fontFamily: 'ui-monospace, Menlo, monospace',
              }}
            >
              R{r.room_no}
            </span>
            <span
              style={{
                fontSize: 10,
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
