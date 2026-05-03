// app/operations/housekeeping/_components/AmenityQueue.tsx
// Proposed amenity loadouts awaiting approval.

import DataNeededOverlay from '@/components/ops/DataNeededOverlay';
import type { AmenityQueueRow } from '../_data/amenityQueue';

interface Props {
  rows: AmenityQueueRow[] | null;
}

export default function AmenityQueue({ rows }: Props) {
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
          fontSize: 16,
          fontWeight: 500,
          margin: '0 0 8px',
        }}
      >
        Amenity <em style={{ color: '#a17a4f' }}>queue</em>
      </h3>

      {!rows || rows.length === 0 ? (
        <DataNeededOverlay
          gap="Gap-H6"
          table="governance.amenity_budget + ops.amenity_loadouts"
          reason="Budget caps + per-room loadouts not yet seeded. Amenity Composer agent ships idle until budget table populated."
        />
      ) : (
        rows.map((r) => (
          <div
            key={`${r.room_no}-${r.description}`}
            style={{
              display: 'grid',
              gridTemplateColumns: '50px 1fr 60px 80px',
              gap: 6,
              fontSize: 11.5,
              alignItems: 'center',
              padding: '7px 0',
              borderBottom: '1px dashed #e6dfc9',
            }}
          >
            <span
              style={{
                fontFamily: 'ui-monospace, Menlo, monospace',
                fontWeight: 700,
              }}
            >
              {r.room_no}
            </span>
            <span style={{ color: '#4a4538' }}>{r.description}</span>
            <span
              style={{
                fontFamily: 'ui-monospace, Menlo, monospace',
                textAlign: 'right',
                color: '#a87024',
                fontWeight: 600,
              }}
            >
              ${r.cost_estimate}
            </span>
            <span
              style={{
                fontSize: 10,
                color: '#8a8170',
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
                textAlign: 'right',
              }}
            >
              {r.agent_status}
            </span>
          </div>
        ))
      )}
    </div>
  );
}
