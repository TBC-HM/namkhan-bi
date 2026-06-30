'use client';

// Client-only renderer for the per-source room-type mix table.
// PBS 2026-06-30: extracted because server components cannot pass `render`
// or `sortValue` function props into the 'use client' DataTable primitive
// (Next.js RSC rule). Server passes `rows` only; this file owns columns.

import DataTable, { type Column } from '@/components/ui/DataTable';
import { fmtTableUsd } from '@/lib/format';

export interface RoomMixRow {
  room_type_name: string;
  bookings: number;
  room_nights: number;
  gross_revenue: number;
  share_pct: number;
}

export default function RoomTypeMixTable({ rows }: { rows: RoomMixRow[] }) {
  // PBS 2026-06-30: render a paper-white empty state inline. The default
  // DataTable empty wrapper uses var(--paper-warm) which is #15110c under
  // the Namkhan token ladder — would render as a black box.
  if (rows.length === 0) {
    return (
      <div style={{
        padding: '24px 20px',
        background: '#FFFFFF',
        border: '1px solid #E6DFCC',
        borderRadius: 6,
        textAlign: 'center',
        color: '#5A5A5A',
        fontSize: 13,
      }}>
        No room-type mix to report — this source has 0 bookings in the active window.
      </div>
    );
  }

  const columns: Column<RoomMixRow>[] = [
    {
      key: 'room_type_name',
      header: 'Room type',
      sortValue: (r) => r.room_type_name,
      render: (r) => <strong>{r.room_type_name}</strong>,
    },
    {
      key: 'bookings',
      header: 'Bookings',
      numeric: true,
      sortValue: (r) => r.bookings,
      render: (r) => r.bookings.toLocaleString('en-US'),
    },
    {
      key: 'rn',
      header: 'Room nights',
      numeric: true,
      sortValue: (r) => r.room_nights,
      render: (r) => r.room_nights.toLocaleString('en-US'),
    },
    {
      key: 'rev',
      header: 'Revenue',
      numeric: true,
      sortValue: (r) => r.gross_revenue,
      render: (r) => fmtTableUsd(r.gross_revenue),
    },
    {
      key: 'share',
      header: 'Share',
      numeric: true,
      sortValue: (r) => r.share_pct,
      render: (r) => `${r.share_pct.toFixed(1)}%`,
    },
    {
      key: 'bar',
      header: 'Bar',
      render: (r) => (
        <div style={{ height: 8, background: 'var(--brass)', opacity: 0.6, width: `${r.share_pct}%`, maxWidth: 200, borderRadius: 2 }} />
      ),
    },
  ];

  return (
    <DataTable<RoomMixRow>
      columns={columns}
      rows={rows}
      rowKey={(r) => r.room_type_name}
      emptyState="No room-type mix to report."
    />
  );
}
