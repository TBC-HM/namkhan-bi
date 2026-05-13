// app/operations/maintenance/_components/SpareParts.tsx

import DataNeededOverlay from '@/components/ops/DataNeededOverlay';
import type { SparePartRow } from '../_data/parts';

interface Props {
  rows: SparePartRow[] | null;
}

export default function SpareParts({ rows }: Props) {
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
        Spare <em style={{ color: '#a17a4f' }}>parts</em>
      </h3>

      {!rows || rows.length === 0 ? (
        <DataNeededOverlay
          gap="Gap-M6"
          table="ops.spare_parts"
          reason="Reorder thresholds + lead-time data not yet captured."
        />
      ) : (
        rows.map((r) => {
          const low = r.on_hand <= r.reorder_at;
          return (
            <div
              key={r.sku}
              style={{
                display: 'grid',
                gridTemplateColumns: '60px 1fr 50px 50px 60px',
                gap: 6,
                fontSize: "var(--t-sm)",
                padding: '6px 0',
                borderBottom: '1px dashed #e6dfc9',
                alignItems: 'center',
              }}
            >
              <span
                style={{
                  fontFamily: 'ui-monospace, Menlo, monospace',
                  fontSize: "var(--t-xs)",
                  color: '#8a8170',
                }}
              >
                {r.sku}
              </span>
              <span style={{ fontWeight: 600 }}>{r.name}</span>
              <span
                style={{
                  fontFamily: 'ui-monospace, Menlo, monospace',
                  textAlign: 'right',
                  color: low ? 'var(--oxblood)' : '#1c1c1a',
                  fontWeight: low ? 700 : 400,
                }}
              >
                {r.on_hand}
              </span>
              <span
                style={{
                  fontFamily: 'ui-monospace, Menlo, monospace',
                  textAlign: 'right',
                  fontSize: "var(--t-xs)",
                  color: '#8a8170',
                }}
              >
                /{r.reorder_at}
              </span>
              <span
                style={{
                  fontFamily: 'ui-monospace, Menlo, monospace',
                  textAlign: 'right',
                  fontSize: "var(--t-xs)",
                  color: '#8a8170',
                }}
              >
                {r.lead_time_days}d
              </span>
            </div>
          );
        })
      )}
    </div>
  );
}
