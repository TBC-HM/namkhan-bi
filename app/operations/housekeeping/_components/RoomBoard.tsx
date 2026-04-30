// app/operations/housekeeping/_components/RoomBoard.tsx
// 24 selling rooms + 6 future tents — color-coded grid by status.
// Renders "Data needed" overlay when ops.room_status is empty (Gap-H1).

import DataNeededOverlay from '@/components/ops/DataNeededOverlay';
import type { RoomStatusRow, RoomStatusValue } from '../_data/roomStatus';

interface Props {
  rooms: RoomStatusRow[] | null;
}

const stateStyle: Record<
  RoomStatusValue,
  { bg: string; bd: string; color?: string }
> = {
  clean: { bg: '#e6f0ea', bd: '#bfddc5' },
  dirty: { bg: '#fee2e2', bd: '#fca5a5' },
  inspect: { bg: '#dbeafe', bd: '#93c5fd' },
  ooo: { bg: '#e5e7eb', bd: '#cbd5e1', color: '#64748b' },
  dnd: { bg: '#fdf6e7', bd: '#f3d57a' },
  inhouse: { bg: '#fff', bd: '#cdc0a0' },
};

const legendItems: { state: RoomStatusValue; label: string }[] = [
  { state: 'clean', label: 'Clean' },
  { state: 'dirty', label: 'Dirty' },
  { state: 'inspect', label: 'Inspected' },
  { state: 'inhouse', label: 'In-house' },
  { state: 'dnd', label: 'DND' },
  { state: 'ooo', label: 'OOO/OOS' },
];

export default function RoomBoard({ rooms }: Props) {
  return (
    <div
      style={{
        background: '#fff',
        border: '1px solid #e6dfc9',
        borderRadius: 8,
        padding: '14px 16px',
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
        Room <em style={{ color: '#a17a4f' }}>status board</em> · 24 selling
      </h3>

      {!rooms || rooms.length === 0 ? (
        <DataNeededOverlay
          gap="Gap-H1"
          table="ops.room_status"
          reason="Cloudbeds housekeeping.statuschanged + reservation.checkedout webhooks not yet wired. Polling fallback /housekeeping every 15 min available as backup."
        />
      ) : (
        <>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(6, 1fr)',
              gap: 6,
              marginTop: 6,
            }}
          >
            {rooms.map((r) => {
              const s = stateStyle[r.status] || stateStyle.dirty;
              return (
                <div
                  key={r.room_no}
                  style={{
                    padding: 8,
                    borderRadius: 6,
                    fontSize: 11,
                    fontFamily: 'ui-monospace, Menlo, monospace',
                    minHeight: 78,
                    background: s.bg,
                    border: `1px solid ${s.bd}`,
                    color: s.color || '#1c1c1a',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                  }}
                >
                  <div
                    style={{
                      fontWeight: 700,
                      fontSize: 12,
                      display: 'flex',
                      justifyContent: 'space-between',
                    }}
                  >
                    {r.room_no}
                    {r.is_vip && (
                      <span
                        style={{
                          background: '#1f3d2e',
                          color: '#fff8eb',
                          padding: '1px 5px',
                          borderRadius: 3,
                          fontFamily: 'sans-serif',
                          fontSize: 9,
                          letterSpacing: '0.04em',
                        }}
                      >
                        VIP
                      </span>
                    )}
                    {r.is_complaint && (
                      <span
                        style={{
                          background: '#a02d2d',
                          color: '#fff8eb',
                          padding: '1px 5px',
                          borderRadius: 3,
                          fontFamily: 'sans-serif',
                          fontSize: 9,
                          letterSpacing: '0.04em',
                        }}
                      >
                        CMP
                      </span>
                    )}
                  </div>
                  {r.guest_name && (
                    <div
                      style={{
                        fontFamily: 'sans-serif',
                        fontSize: 10,
                        color: '#4a4538',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}
                    >
                      {r.guest_name}
                    </div>
                  )}
                  <div
                    style={{
                      fontFamily: 'ui-monospace, Menlo, monospace',
                      fontSize: 9,
                      color: '#8a8170',
                    }}
                  >
                    {r.arrival_eta ? `ETA ${r.arrival_eta}` : ''}
                  </div>
                  {r.attendant_initial && (
                    <div
                      style={{
                        fontFamily: 'sans-serif',
                        fontSize: 9,
                        color: '#1f3d2e',
                        fontWeight: 700,
                        textTransform: 'uppercase',
                      }}
                    >
                      {r.attendant_initial}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          <div
            style={{
              display: 'flex',
              gap: 12,
              fontSize: 10,
              color: '#8a8170',
              marginTop: 8,
              flexWrap: 'wrap',
            }}
          >
            {legendItems.map((li) => {
              const s = stateStyle[li.state];
              return (
                <span
                  key={li.state}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 4,
                  }}
                >
                  <span
                    style={{
                      width: 10,
                      height: 10,
                      borderRadius: 2,
                      background: s.bg,
                      border: `1px solid ${s.bd}`,
                      display: 'inline-block',
                    }}
                  />
                  {li.label}
                </span>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
