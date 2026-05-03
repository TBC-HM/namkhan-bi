'use client';
// Drawer that lists rooms available for the proposal's date range.
// Reads /api/sales/proposals/rooms (Cloudbeds bridge via rate_inventory).
//
// Design: paper-warm panel with brass-mono headers, status pill, fmtTableUsd.

import { useEffect, useState } from 'react';
import StatusPill from '@/components/ui/StatusPill';
import DataTable, { type Column } from '@/components/ui/DataTable';
import { fmtTableUsd, fmtIsoDate, FX_LAK_PER_USD, EMPTY } from '@/lib/format';
import type { RoomAvail } from '@/lib/sales';

interface Props {
  open: boolean;
  onClose: () => void;
  fromDate: string;
  toDate: string;
  onPick: (room: RoomAvail) => void;
}

export default function RoomPickerDrawer({ open, onClose, fromDate, toDate, onPick }: Props) {
  const [rooms, setRooms] = useState<RoomAvail[]>([]);
  const [staleMin, setStaleMin] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    fetch(`/api/sales/proposals/rooms?from=${fromDate}&to=${toDate}`)
      .then(r => r.json())
      .then(d => { setRooms(d.rooms ?? []); setStaleMin(d.staleMinutes ?? null); })
      .catch(() => setRooms([]))
      .finally(() => setLoading(false));
  }, [open, fromDate, toDate]);

  if (!open) return null;

  const columns: Column<RoomAvail>[] = [
    {
      key: 'name', header: 'ROOM TYPE',
      sortValue: (r) => r.room_type_name.toLowerCase(),
      render: (r) => <span style={{ fontWeight: 500 }}>{r.room_type_name}</span>,
    },
    {
      key: 'avail', header: 'AVAIL', align: 'center',
      sortValue: (r) => Number(r.min_avail_in_range),
      render: (r) => (
        <StatusPill tone={r.min_avail_in_range > 2 ? 'active' : 'pending'}>
          {r.min_avail_in_range} left
        </StatusPill>
      ),
    },
    {
      key: 'nights', header: 'NIGHTS', align: 'center',
      render: (r) => `${r.nights_available}/${r.nights_requested}`,
    },
    {
      key: 'rate', header: 'AVG / NIGHT', numeric: true,
      sortValue: (r) => Number(r.avg_nightly_lak),
      render: (r) => fmtTableUsd(Number(r.avg_nightly_lak) / FX_LAK_PER_USD),
    },
    {
      key: 'pick', header: '', align: 'right',
      render: (r) => (
        <button className="btn btn-primary" onClick={() => onPick(r)}>Add →</button>
      ),
    },
  ];

  return (
    <div onClick={onClose} className="proposal-drawer-mask">
      <aside onClick={e => e.stopPropagation()} className="proposal-drawer">
        <header className="proposal-drawer-head">
          <div>
            <div className="t-eyebrow">Rooms · {fmtIsoDate(fromDate)} → {fmtIsoDate(toDate)}</div>
            <h3 className="proposal-drawer-title">
              Pick your <em style={{ color: 'var(--brass)', fontStyle: 'italic' }}>room</em>
            </h3>
          </div>
          <button className="btn" onClick={onClose}>Close ✕</button>
        </header>

        {staleMin != null && staleMin > 60 && (
          <div className="proposal-drawer-warn">
            <strong>Rates stale</strong> — last sync {staleMin} min ago. Refresh from Cloudbeds before sending.
          </div>
        )}

        <div className="proposal-drawer-body">
          {loading && <p style={{ color: 'var(--ink-mute)' }}>Loading availability…</p>}
          {!loading && rooms.length === 0 && (
            <div className="panel dashed" style={{ padding: 24, color: 'var(--ink-mute)' }}>
              No rooms available for the full date range. Try different dates, or check Cloudbeds for stop-sell flags.
            </div>
          )}
          {!loading && rooms.length > 0 && (
            <DataTable<RoomAvail>
              columns={columns}
              rows={rooms}
              rowKey={(r) => String(r.room_type_id)}
              defaultSort={{ key: 'rate', dir: 'asc' }}
              emptyState={EMPTY}
            />
          )}
        </div>
      </aside>
    </div>
  );
}
