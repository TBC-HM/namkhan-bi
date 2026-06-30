'use client';

// app/revenue/channels/[source]/_components/SourceBookingsTable.tsx
//
// PBS 2026-06-30: full-width booking list under every source landing.
// Wired to public.v_source_bookings (gold). Newest booking first.
// Columns: Booked · Check-in · Room type · LOS · ADR · Total · Reservation #
//
// Cancelled rows render greyed + struck-through so the user sees them but
// they don't blend with active business.
// PBS 2026-06-30 (2): default to 10 rows visible. "Show all" / "Show 10"
// toggle reveals the full list (still newest-first under the user's sort).

import { useState } from 'react';
import DataTable, { type Column } from '@/components/ui/DataTable';
import { fmtTableUsd } from '@/lib/format';

const INITIAL_LIMIT = 10;

export interface SourceBookingRow {
  reservation_id: string;
  booking_id: string | null;
  booking_date: string | null;
  check_in_date: string | null;
  check_out_date: string | null;
  room_type_name: string | null;
  guest_name: string | null;
  los: number | null;
  adr: number | null;
  total_amount: number | null;
  currency: string | null;
  status: string | null;
  is_cancelled: boolean;
}

function fmtDate(s: string | null): string {
  if (!s) return '—';
  return s.length >= 10 ? s.slice(0, 10) : s;
}

export default function SourceBookingsTable({ rows }: { rows: SourceBookingRow[] }) {
  const [expanded, setExpanded] = useState(false);
  const visible = expanded ? rows : rows.slice(0, INITIAL_LIMIT);
  const hidden = rows.length - visible.length;

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
        No bookings from this source on file.
      </div>
    );
  }

  const columns: Column<SourceBookingRow>[] = [
    {
      key: 'booking_date',
      header: 'Booked',
      sortValue: (r) => r.booking_date ?? '',
      render: (r) => <span style={{ fontFamily: 'var(--mono, monospace)' }}>{fmtDate(r.booking_date)}</span>,
    },
    {
      key: 'check_in_date',
      header: 'Check-in',
      sortValue: (r) => r.check_in_date ?? '',
      render: (r) => <span style={{ fontFamily: 'var(--mono, monospace)' }}>{fmtDate(r.check_in_date)}</span>,
    },
    {
      key: 'room_type_name',
      header: 'Room type',
      sortValue: (r) => r.room_type_name ?? '',
      render: (r) => <strong>{r.room_type_name ?? '—'}</strong>,
    },
    {
      key: 'guest_name',
      header: 'Guest',
      sortValue: (r) => r.guest_name ?? '',
      render: (r) => r.guest_name ?? '—',
    },
    {
      key: 'los',
      header: 'LOS',
      numeric: true,
      sortValue: (r) => r.los ?? 0,
      render: (r) => (r.los != null ? `${r.los} nt` : '—'),
    },
    {
      key: 'adr',
      header: 'ADR',
      numeric: true,
      sortValue: (r) => r.adr ?? 0,
      render: (r) => (r.adr != null ? fmtTableUsd(r.adr) : '—'),
    },
    {
      key: 'total_amount',
      header: 'Invoice total',
      numeric: true,
      sortValue: (r) => r.total_amount ?? 0,
      render: (r) => (r.total_amount != null ? fmtTableUsd(r.total_amount) : '—'),
    },
    {
      key: 'reservation_id',
      header: 'Reservation #',
      sortValue: (r) => r.reservation_id,
      render: (r) => (
        <code style={{ fontFamily: 'var(--mono, monospace)', fontSize: 12 }}>
          {r.reservation_id}
        </code>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      align: 'center',
      sortValue: (r) => (r.is_cancelled ? 'z' : r.status ?? ''),
      render: (r) =>
        r.is_cancelled
          ? <span style={{ padding: '2px 8px', background: 'var(--st-bad-bg, #FBE9E7)', border: '1px solid var(--st-bad-bd, #E8B9B0)', borderRadius: 10, fontSize: 11, color: 'var(--st-bad, #B03826)' }}>cancelled</span>
          : <span style={{ padding: '2px 8px', background: 'var(--st-good-bg, #EEF5EE)', border: '1px solid var(--st-good-bd, #C8DFC8)', borderRadius: 10, fontSize: 11, color: 'var(--moss, #2C5F4F)' }}>{r.status ?? 'booked'}</span>,
    },
  ];

  return (
    <div>
      <DataTable<SourceBookingRow>
        columns={columns}
        rows={visible}
        rowKey={(r) => r.reservation_id}
        rowClassName={(r) => r.is_cancelled ? 'row-warn' : undefined}
        defaultSort={{ key: 'booking_date', dir: 'desc' }}
      />
      {rows.length > INITIAL_LIMIT && (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '10px 0 0' }}>
          <button
            type="button"
            onClick={() => setExpanded((e) => !e)}
            style={{
              padding: '6px 14px',
              fontSize: 12,
              fontWeight: 600,
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
              background: '#FFFFFF',
              color: '#1B1B1B',
              border: '1px solid #E6DFCC',
              borderRadius: 4,
              cursor: 'pointer',
            }}
          >
            {expanded
              ? `Show first ${INITIAL_LIMIT}`
              : `Show all ${rows.length} (+${hidden} hidden)`}
          </button>
        </div>
      )}
    </div>
  );
}
