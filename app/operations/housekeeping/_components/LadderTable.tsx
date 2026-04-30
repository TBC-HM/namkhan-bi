// app/operations/housekeeping/_components/LadderTable.tsx
// HK productivity ladder — attendant × rooms × min/clean × variance.

import DataNeededOverlay from '@/components/ops/DataNeededOverlay';
import type { HkAssignmentRow } from '../_data/hkAssignments';

interface Props {
  rows: HkAssignmentRow[] | null;
}

export default function LadderTable({ rows }: Props) {
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
        HK <em style={{ color: '#a17a4f' }}>productivity ladder</em>
      </h3>

      {!rows || rows.length === 0 ? (
        <DataNeededOverlay
          gap="Gap-H2"
          table="ops.hk_assignments"
          reason="Roster + per-room timing not yet captured. Without it, productivity variance cannot be computed."
        />
      ) : (
        <>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 60px 70px 70px',
              gap: 8,
              fontSize: 10,
              color: '#8a8170',
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
              fontWeight: 600,
              borderBottom: '1px solid #e6dfc9',
              paddingBottom: 6,
            }}
          >
            <span>Attendant</span>
            <span style={{ textAlign: 'right' }}>Rooms</span>
            <span style={{ textAlign: 'right' }}>Min/clean</span>
            <span style={{ textAlign: 'right' }}>Var</span>
          </div>
          {rows.map((r) => (
            <div
              key={r.attendant}
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 60px 70px 70px',
                gap: 8,
                fontSize: 12,
                padding: '7px 0',
                borderBottom: '1px dashed #e6dfc9',
                alignItems: 'center',
              }}
            >
              <span style={{ fontWeight: 600 }}>{r.attendant}</span>
              <span
                style={{
                  fontFamily: 'ui-monospace, Menlo, monospace',
                  textAlign: 'right',
                }}
              >
                {r.rooms_today}
              </span>
              <span
                style={{
                  fontFamily: 'ui-monospace, Menlo, monospace',
                  textAlign: 'right',
                }}
              >
                {r.avg_min_per_clean}
              </span>
              <span
                style={{
                  fontFamily: 'ui-monospace, Menlo, monospace',
                  textAlign: 'right',
                  color:
                    r.variance_vs_target > 4
                      ? '#a02d2d'
                      : r.variance_vs_target > 0
                      ? '#a87024'
                      : '#2f6f4a',
                }}
              >
                {r.variance_vs_target > 0 ? `+${r.variance_vs_target}` : r.variance_vs_target}
              </span>
            </div>
          ))}
        </>
      )}
    </div>
  );
}
