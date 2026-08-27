'use client';
// app/(cockpit)/_design/BookingFeedTable.tsx
//
// PBS 2026-07-15: client-side sortable + expandable table for the
// BookingActivity feed. Server fetches all rows once (up to 200), client
// owns the sort + collapse state so header clicks feel instant and don't
// round-trip to the server. Columns Booking ID · When · Event · Check-in ·
// Source · Room · Rate plan · LOS · ADR · Revenue all sortable — click
// header to cycle desc → asc → default.
// 2026-08-24: Added Booking ID as first column + row click → right-side
// detail drawer with full field list.

import { useState, useMemo, useEffect } from 'react';

interface Row {
  reservation_id: string;
  event_kind: 'booking' | 'cancel';
  event_at: string;
  source_name: string | null;
  room_type_name: string | null;
  rate_plan: string | null;
  check_in_date: string | null;
  nights: number | null;
  total_amount: number | null;
  currency: string | null;
}

type SortCol =
  | 'reservation_id' | 'event_at' | 'event_kind' | 'check_in_date'
  | 'source' | 'room' | 'rate_plan'
  | 'los' | 'adr' | 'revenue'
  | null;

type SortDir = 'asc' | 'desc';

interface Props {
  rows: Row[];
  sym: string;
  tz: string;
  propertyId: number;
  collapsedRows?: number;
}

const DEFAULT_COLLAPSED = 10;

function fmtMoney(n: number, sym: string): string {
  return `${sym}${Math.round(n).toLocaleString('en-US')}`;
}

function fmtEventTime(iso: string | null, tz: string): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: tz,
    day: '2-digit', month: 'short',
    hour: '2-digit', minute: '2-digit', hour12: false,
  }).format(d);
}

function valueFor(r: Row, col: SortCol): string | number {
  switch (col) {
    case 'reservation_id':return (r.reservation_id ?? '').toLowerCase();
    case 'event_at':      return r.event_at ? new Date(r.event_at).getTime() : 0;
    case 'event_kind':    return r.event_kind ?? '';
    case 'check_in_date': return r.check_in_date ?? '';
    case 'source':        return (r.source_name ?? '').toLowerCase();
    case 'room':          return (r.room_type_name ?? '').toLowerCase();
    case 'rate_plan':     return (r.rate_plan ?? '').toLowerCase();
    case 'los':           return Number(r.nights ?? 0);
    case 'adr': {
      const n = Number(r.nights ?? 0);
      return n > 0 ? Number(r.total_amount ?? 0) / n : 0;
    }
    case 'revenue':       return Number(r.total_amount ?? 0);
    default:              return 0;
  }
}

// ── Detail Drawer ──────────────────────────────────────────────────────────

interface GroupRoom {
  guestName: string | null;
  roomName: string | null;
  roomTypeName: string | null;
  checkIn: string | null;
  checkOut: string | null;
  adults: number | null;
  subReservationId: string | null;
}

interface DrawerProps {
  row: Row | null;
  sym: string;
  tz: string;
  propertyId: number;
  onClose: () => void;
}

function DetailDrawer({ row, sym, tz, propertyId, onClose }: DrawerProps) {
  const [rooms, setRooms] = useState<GroupRoom[]>([]);
  const [roomsLoading, setRoomsLoading] = useState(false);

  useEffect(() => {
    if (!row) { setRooms([]); return; }
    setRoomsLoading(true);
    fetch(
      `/api/reservation-rooms?property_id=${propertyId}&reservation_id=${encodeURIComponent(row.reservation_id)}`,
      { credentials: 'include' },
    )
      .then((r) => r.json())
      .then((d: { rooms?: GroupRoom[] }) => setRooms(d.rooms ?? []))
      .catch(() => setRooms([]))
      .finally(() => setRoomsLoading(false));
  }, [row?.reservation_id, propertyId]);

  if (!row) return null;

  const nights   = Number(row.nights ?? 0);
  const total    = Number(row.total_amount ?? 0);
  const adr      = nights > 0 ? total / nights : 0;
  const isCancel = row.event_kind === 'cancel';

  const fields: Array<{ label: string; value: string }> = [
    { label: 'Reservation ID',  value: row.reservation_id },
    { label: 'Event',           value: isCancel ? 'Cancellation' : 'Booking' },
    { label: 'When',            value: fmtEventTime(row.event_at, tz) },
    { label: 'Check-in',        value: row.check_in_date ? row.check_in_date.slice(0, 10) : '—' },
    { label: 'Source',          value: row.source_name ?? '—' },
    { label: 'Room type',       value: row.room_type_name ?? '—' },
    { label: 'Rate plan',       value: row.rate_plan ?? '—' },
    { label: 'LOS (nights)',    value: nights ? String(nights) : '—' },
    { label: 'ADR',             value: adr > 0 ? fmtMoney(adr, sym) : '—' },
    { label: 'Total revenue',   value: total > 0 ? fmtMoney(total, sym) : '—' },
  ];

  const kindPill: React.CSSProperties = {
    display: 'inline-block',
    padding: '2px 8px', fontSize: 11, fontWeight: 700,
    borderRadius: 3, textTransform: 'uppercase',
    letterSpacing: '0.06em',
    background: isCancel ? '#FBEAEA' : '#E8F2E4',
    color:      isCancel ? '#B04A2F' : '#1F5C2C',
  };

  return (
    <>
      {/* Overlay */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0,
          background: 'rgba(0,0,0,0.35)',
          zIndex: 999,
        }}
      />
      {/* Drawer */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Reservation detail"
        style={{
          position: 'fixed', top: 0, right: 0,
          height: '100vh', width: 380,
          background: 'var(--paper, #FFFFFF)',
          borderLeft: '1px solid var(--hairline, #E6DFCC)',
          boxShadow: '-4px 0 24px rgba(0,0,0,0.12)',
          zIndex: 1000,
          display: 'flex', flexDirection: 'column',
          overflowY: 'auto',
        }}
      >
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'flex-start',
          justifyContent: 'space-between',
          padding: '16px 16px 12px',
          borderBottom: '1px solid var(--hairline, #E6DFCC)',
          position: 'sticky', top: 0,
          background: 'var(--paper, #FFFFFF)',
          zIndex: 1,
        }}>
          <div>
            <div style={{ fontSize: 12, color: 'var(--ink-soft, #5A5A5A)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              Reservation
            </div>
            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink, #1B1B1B)', fontVariantNumeric: 'tabular-nums' }}>
              {row.reservation_id}
            </div>
            <div style={{ marginTop: 6 }}>
              <span style={kindPill}>{isCancel ? 'Cancellation' : 'Booking'}</span>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              fontSize: 18, color: 'var(--ink-soft, #5A5A5A)',
              padding: '4px 8px', lineHeight: 1,
            }}
          >
            ×
          </button>
        </div>

        {/* Field grid */}
        <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: 0 }}>
          {fields.map(({ label, value }) => (
            <div
              key={label}
              style={{
                display: 'grid',
                gridTemplateColumns: '130px 1fr',
                padding: '10px 0',
                borderBottom: '1px solid var(--hairline, #E6DFCC)',
                gap: 8,
                alignItems: 'baseline',
              }}
            >
              <span style={{
                fontSize: 10, fontWeight: 600, textTransform: 'uppercase',
                letterSpacing: '0.06em', color: 'var(--ink-soft, #5A5A5A)',
              }}>
                {label}
              </span>
              <span style={{
                fontSize: 13, color: 'var(--ink, #1B1B1B)',
                fontVariantNumeric: 'tabular-nums',
                wordBreak: 'break-word',
              }}>
                {value}
              </span>
            </div>
          ))}

          {/* Group accommodations sub-table — shown when the reservation has > 1 room */}
          {roomsLoading && (
            <div style={{ paddingTop: 16, fontSize: 11, color: 'var(--ink-soft, #5A5A5A)' }}>
              Loading accommodations…
            </div>
          )}
          {!roomsLoading && rooms.length > 1 && (
            <div style={{ paddingTop: 16 }}>
              <div style={{
                fontSize: 10, fontWeight: 600, textTransform: 'uppercase',
                letterSpacing: '0.06em', color: 'var(--ink-soft, #5A5A5A)',
                marginBottom: 8,
              }}>
                Group · {rooms.length} accommodations
              </div>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
                  <thead>
                    <tr>
                      {['Guest', 'Room', 'Type', 'Check-in', 'Check-out'].map((h) => (
                        <th key={h} style={{
                          textAlign: 'left', padding: '4px 6px',
                          borderBottom: '1px solid var(--hairline, #E6DFCC)',
                          fontSize: 10, fontWeight: 600, textTransform: 'uppercase',
                          letterSpacing: '0.05em', color: 'var(--ink-soft, #5A5A5A)',
                          whiteSpace: 'nowrap',
                        }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {rooms.map((room, i) => (
                      <tr key={room.subReservationId ?? i} style={{ borderBottom: '1px solid var(--hairline, #E6DFCC)' }}>
                        <td style={{ padding: '5px 6px', fontSize: 11, color: 'var(--ink, #1B1B1B)', whiteSpace: 'nowrap' }}>{room.guestName ?? '—'}</td>
                        <td style={{ padding: '5px 6px', fontSize: 11, color: 'var(--ink, #1B1B1B)', whiteSpace: 'nowrap' }}>{room.roomName ?? '—'}</td>
                        <td style={{ padding: '5px 6px', fontSize: 11, color: 'var(--ink, #1B1B1B)', whiteSpace: 'nowrap' }}>{room.roomTypeName ?? '—'}</td>
                        <td style={{ padding: '5px 6px', fontSize: 11, color: 'var(--ink, #1B1B1B)', whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>{room.checkIn ?? '—'}</td>
                        <td style={{ padding: '5px 6px', fontSize: 11, color: 'var(--ink, #1B1B1B)', whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>{room.checkOut ?? '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

// ── Main Table ─────────────────────────────────────────────────────────────

export default function BookingFeedTable({
  rows, sym, tz, propertyId, collapsedRows = DEFAULT_COLLAPSED,
}: Props) {
  const [expanded, setExpanded]       = useState(false);
  const [sortCol, setSortCol]         = useState<SortCol>(null);
  const [sortDir, setSortDir]         = useState<SortDir>('desc');
  const [selectedRow, setSelectedRow] = useState<Row | null>(null);

  const sorted = useMemo(() => {
    if (!sortCol) return rows;
    const copy = [...rows];
    copy.sort((a, b) => {
      const av = valueFor(a, sortCol);
      const bv = valueFor(b, sortCol);
      let cmp = 0;
      if (typeof av === 'number' && typeof bv === 'number') cmp = av - bv;
      else cmp = String(av).localeCompare(String(bv));
      return sortDir === 'asc' ? cmp : -cmp;
    });
    return copy;
  }, [rows, sortCol, sortDir]);

  const shown = expanded ? sorted : sorted.slice(0, collapsedRows);

  function onSort(col: Exclude<SortCol, null>) {
    if (sortCol !== col) {
      setSortCol(col);
      setSortDir('desc');
    } else if (sortDir === 'desc') {
      setSortDir('asc');
    } else {
      setSortCol(null);
      setSortDir('desc');
    }
  }

  function sortArrow(col: Exclude<SortCol, null>): string {
    if (sortCol !== col) return '';
    return sortDir === 'desc' ? ' ↓' : ' ↑';
  }

  return (
    <>
      <DetailDrawer
        row={selectedRow}
        sym={sym}
        tz={tz}
        propertyId={propertyId}
        onClose={() => setSelectedRow(null)}
      />

      <div style={{
        display: 'flex', justifyContent: 'space-between',
        alignItems: 'center', marginBottom: 8,
      }}>
        <div style={{ fontSize: 11, color: 'var(--ink-soft, #5A5A5A)' }}>
          Showing {shown.length} of {rows.length} · click column headers to sort · click row for details
        </div>
        {rows.length > collapsedRows && (
          <button
            type="button"
            onClick={() => setExpanded((e) => !e)}
            style={{
              padding: '4px 12px', borderRadius: 4,
              border: '1px solid var(--hairline, #E6DFCC)',
              background: 'var(--paper, #FFFFFF)',
              color: 'var(--ink, #1B1B1B)',
              fontSize: 12, fontWeight: 500, fontFamily: 'inherit',
              cursor: 'pointer',
            }}
          >
            {expanded ? 'Collapse (show latest 10)' : `Show all ${rows.length} events`}
          </button>
        )}
      </div>

      {shown.length === 0 ? (
        <div style={{
          padding: 12, fontSize: 12,
          color: 'var(--ink-soft, #5A5A5A)',
          fontStyle: 'italic',
        }}>No activity yet.</div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr style={{ background: '#FFFFFF', borderBottom: '1px solid #E6DFCC' }}>
                <Th label="Booking ID"     onClick={() => onSort('reservation_id')} arrow={sortArrow('reservation_id')} />
                <Th label={`When (${tz})`} onClick={() => onSort('event_at')}      arrow={sortArrow('event_at')} />
                <Th label="Event"          onClick={() => onSort('event_kind')}    arrow={sortArrow('event_kind')} />
                <Th label="Check-in"       onClick={() => onSort('check_in_date')} arrow={sortArrow('check_in_date')} />
                <Th label="Source"         onClick={() => onSort('source')}        arrow={sortArrow('source')} />
                <Th label="Room"           onClick={() => onSort('room')}          arrow={sortArrow('room')} />
                <Th label="Rate plan"      onClick={() => onSort('rate_plan')}     arrow={sortArrow('rate_plan')} />
                <Th label="LOS"     align="right" onClick={() => onSort('los')}     arrow={sortArrow('los')} />
                <Th label="ADR"     align="right" onClick={() => onSort('adr')}     arrow={sortArrow('adr')} />
                <Th label="Revenue" align="right" onClick={() => onSort('revenue')} arrow={sortArrow('revenue')} />
              </tr>
            </thead>
            <tbody>
              {shown.map((r, i) => {
                const nights = Number(r.nights ?? 0);
                const total  = Number(r.total_amount ?? 0);
                const adr    = nights > 0 ? total / nights : 0;
                const isCancel = r.event_kind === 'cancel';
                const kindPill: React.CSSProperties = {
                  display: 'inline-block',
                  padding: '2px 8px', fontSize: 10, fontWeight: 700,
                  borderRadius: 3, textTransform: 'uppercase',
                  letterSpacing: '0.06em',
                  background: isCancel ? '#FBEAEA' : '#E8F2E4',
                  color:      isCancel ? '#B04A2F' : '#1F5C2C',
                };
                const key = `${r.reservation_id}-${r.event_kind}-${i}`;
                return (
                  <tr
                    key={key}
                    onClick={() => setSelectedRow(r)}
                    style={{
                      borderTop: '1px solid var(--hairline, #E6DFCC)',
                      cursor: 'pointer',
                    }}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLTableRowElement).style.background = 'rgba(0,0,0,0.025)'; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLTableRowElement).style.background = ''; }}
                  >
                    <td style={{ ...tdLeft, fontVariantNumeric: 'tabular-nums', color: 'var(--ink-soft, #5A5A5A)' }}>{r.reservation_id}</td>
                    <td style={tdLeft} title={r.event_at ?? ''}>{fmtEventTime(r.event_at, tz)}</td>
                    <td style={tdLeft}><span style={kindPill}>{isCancel ? 'Cancel' : 'Booking'}</span></td>
                    <td style={tdLeft} title={r.check_in_date ?? ''}>{r.check_in_date ? r.check_in_date.slice(0, 10) : '—'}</td>
                    <td style={tdLeft}>{r.source_name ?? '—'}</td>
                    <td style={tdLeft}>{r.room_type_name ?? '—'}</td>
                    <td style={tdLeft}>{r.rate_plan ?? '—'}</td>
                    <td style={tdRight}>{nights || '—'}</td>
                    <td style={tdRight}>{adr > 0 ? fmtMoney(adr, sym) : '—'}</td>
                    <td style={tdRight}>{total > 0 ? fmtMoney(total, sym) : '—'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

function Th({
  label, onClick, arrow, align = 'left',
}: { label: string; onClick: () => void; arrow: string; align?: 'left' | 'right' }) {
  return (
    <th
      onClick={onClick}
      style={{
        padding: '7px 12px', fontSize: 10, fontWeight: 600,
        letterSpacing: '0.06em', textTransform: 'uppercase',
        color: '#000', textAlign: align, cursor: 'pointer',
        userSelect: 'none',
      }}
      title="Click to sort"
    >
      {label}{arrow}
    </th>
  );
}

const tdLeft: React.CSSProperties = {
  padding: '6px 12px', fontSize: 12,
  color: 'var(--ink, #1B1B1B)',
  whiteSpace: 'nowrap', overflow: 'hidden',
  textOverflow: 'ellipsis', maxWidth: 220,
};
const tdRight: React.CSSProperties = {
  padding: '6px 12px', fontSize: 12, textAlign: 'right',
  fontVariantNumeric: 'tabular-nums',
  color: 'var(--ink, #1B1B1B)',
};
