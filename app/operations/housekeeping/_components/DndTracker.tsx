// app/operations/housekeeping/_components/DndTracker.tsx
// DND streak tracker — full-width strip per IA mockup.

import DataNeededOverlay from '@/components/ops/DataNeededOverlay';
import type { DndStreakRow } from '../_data/dndStreaks';

interface Props {
  rows: DndStreakRow[] | null;
}

export default function DndTracker({ rows }: Props) {
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
        DND <em style={{ color: '#a17a4f' }}>tracker</em>
      </h3>

      {!rows || rows.length === 0 ? (
        <DataNeededOverlay
          gap="Gap-H5"
          table="ops.v_dnd_streaks (view)"
          reason="View derives from Gap-H1 ops.room_status. Ship H1 first; this is free thereafter."
        />
      ) : (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(4, 1fr)',
            gap: 8,
            marginTop: 8,
          }}
        >
          {rows.map((r) => (
            <div
              key={r.room_no}
              style={{
                background: r.flagged_for_welfare ? 'var(--st-bad-bg)' : 'var(--paper-warm)',
                border: `1px solid ${r.flagged_for_welfare ? 'var(--oxblood)' : 'var(--line-soft)'}`,
                borderRadius: 6,
                padding: 10,
                fontSize: "var(--t-sm)",
              }}
            >
              <div
                style={{
                  fontFamily: 'ui-monospace, Menlo, monospace',
                  fontWeight: 700,
                  fontSize: "var(--t-md)",
                }}
              >
                R{r.room_no}
              </div>
              <div
                style={{
                  fontFamily: 'ui-monospace, Menlo, monospace',
                  fontSize: "var(--t-sm)",
                  color: 'var(--oxblood)',
                  fontWeight: 600,
                }}
              >
                Day {r.consecutive_days}
              </div>
              <div
                style={{
                  fontSize: "var(--t-xs)",
                  color: '#8a8170',
                  textTransform: 'uppercase',
                  letterSpacing: '0.04em',
                  marginTop: 2,
                }}
              >
                {r.guest_segment || 'unknown'}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
