'use client';
// app/h/[property_id]/revenue/reservations/ReservationsTableClient.tsx
//
// PBS 2026-08-21 · Client-side sortable table + search filter for the
// Cloudbeds-style reservations grid. Server (page.tsx) fetches the window
// once (up to 5000 rows), client owns sort + search + pagination so column
// clicks and typing feel instant with no roundtrip.
//
// Columns mirror Cloudbeds: Reservation ID · First · Surname · Date Booked
// · Room#(s) · Room Type · Check In · Check Out · Nights · Total Price ·
// Status · Source.

import { useMemo, useState, type CSSProperties } from 'react';

export interface ReservationRow {
  reservation_id: string;
  guest_first_name: string | null;
  guest_last_name: string | null;
  guest_name: string | null;
  booking_date: string | null;
  room_numbers: string | null;
  room_type_name: string | null;
  check_in_date: string | null;
  check_out_date: string | null;
  nights: number | null;
  total_amount: number | string | null;
  currency: string | null;
  status: string | null;
  is_cancelled: boolean | null;
  source: string | null;
  source_name: string | null;
}

interface Props {
  rows: ReservationRow[];
  sym: string;
  tz: string;
}

type SortCol =
  | 'reservation_id'
  | 'first' | 'surname'
  | 'booking_date'
  | 'room_numbers' | 'room_type'
  | 'check_in' | 'check_out' | 'nights'
  | 'total' | 'status' | 'source'
  | null;

type SortDir = 'asc' | 'desc';

const PAGE_SIZE = 50;
const EMDASH = '—';

function fmtMoney(n: number | string | null, sym: string): string {
  if (n === null || n === undefined || n === '') return EMDASH;
  const num = typeof n === 'string' ? Number(n) : n;
  if (!Number.isFinite(num)) return EMDASH;
  return sym + num.toFixed(2);
}

function fmtDate(iso: string | null, tz: string): string {
  if (!iso) return EMDASH;
  if (/^\d{4}-\d{2}-\d{2}$/.test(iso)) {
    const [y, m, d] = iso.split('-').map(Number);
    return new Intl.DateTimeFormat('en-GB', {
      day: '2-digit', month: 'short', year: 'numeric',
    }).format(new Date(Date.UTC(y, m - 1, d)));
  }
  const dt = new Date(iso);
  if (Number.isNaN(dt.getTime())) return EMDASH;
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: tz,
    day: '2-digit', month: 'short', year: 'numeric',
  }).format(dt);
}

function statusPill(status: string | null, isCancelled: boolean | null): {
  label: string;
  color: string;
  bg: string;
} {
  if (isCancelled) {
    return { label: 'CANCELLED', color: '#8B0000', bg: 'rgba(200,60,60,0.10)' };
  }
  const s = (status ?? '').toLowerCase();
  if (s === 'checked_in' || s === 'checked-in' || s === 'in_house' || s === 'in-house') {
    return { label: 'Checked In', color: '#0A5A2A', bg: 'rgba(50,150,80,0.10)' };
  }
  if (s === 'checked_out' || s === 'checked-out' || s === 'departed') {
    return { label: 'Checked Out', color: '#3A3A3A', bg: 'rgba(120,120,120,0.10)' };
  }
  if (s === 'confirmed' || s === 'booked') {
    return { label: 'Confirmed', color: '#1B5E9B', bg: 'rgba(30,110,180,0.10)' };
  }
  if (s === 'no_show' || s === 'no-show') {
    return { label: 'No-show', color: '#8B4513', bg: 'rgba(200,120,60,0.10)' };
  }
  return { label: status ?? EMDASH, color: 'var(--ink, #1B1B1B)', bg: 'rgba(0,0,0,0.04)' };
}

function valueFor(r: ReservationRow, col: SortCol): string | number {
  switch (col) {
    case 'reservation_id': return r.reservation_id ?? '';
    case 'first':          return (r.guest_first_name ?? '').toLowerCase();
    case 'surname':        return (r.guest_last_name ?? '').toLowerCase();
    case 'booking_date':   return r.booking_date ? new Date(r.booking_date).getTime() : 0;
    case 'room_numbers':   return (r.room_numbers ?? '').toLowerCase();
    case 'room_type':      return (r.room_type_name ?? '').toLowerCase();
    case 'check_in':       return r.check_in_date ?? '';
    case 'check_out':      return r.check_out_date ?? '';
    case 'nights':         return Number(r.nights ?? 0);
    case 'total':          return Number(r.total_amount ?? 0);
    case 'status':         return r.is_cancelled ? 'zzz_cancelled' : (r.status ?? '').toLowerCase();
    case 'source':         return (r.source_name ?? r.source ?? '').toLowerCase();
    default:               return 0;
  }
}

const thStyle = (active: boolean): CSSProperties => ({
  padding: '8px 10px',
  fontSize: 11,
  fontWeight: 600,
  textAlign: 'left',
  color: 'var(--ink, #1B1B1B)',
  borderBottom: '1px solid var(--hairline, #E6DFCC)',
  cursor: 'pointer',
  userSelect: 'none',
  whiteSpace: 'nowrap',
  background: active ? 'rgba(0,0,0,0.02)' : 'transparent',
  position: 'sticky',
  top: 0,
  zIndex: 1,
});

const tdStyle: CSSProperties = {
  padding: '8px 10px',
  fontSize: 12,
  color: 'var(--ink, #1B1B1B)',
  borderBottom: '1px solid var(--hairline, #E6DFCC)',
  whiteSpace: 'nowrap',
};

function sortIndicator(active: boolean, dir: SortDir): string {
  if (!active) return '';
  return dir === 'asc' ? ' ▲' : ' ▼';
}

export default function ReservationsTableClient({ rows, sym, tz }: Props) {
  const [sortCol, setSortCol] = useState<SortCol>(null);
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(0);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) => {
      if (r.reservation_id?.toLowerCase().includes(q)) return true;
      if (r.guest_first_name?.toLowerCase().includes(q)) return true;
      if (r.guest_last_name?.toLowerCase().includes(q)) return true;
      if (r.guest_name?.toLowerCase().includes(q)) return true;
      return false;
    });
  }, [rows, query]);

  const sorted = useMemo(() => {
    if (!sortCol) return filtered;
    const copy = [...filtered];
    copy.sort((a, b) => {
      const va = valueFor(a, sortCol);
      const vb = valueFor(b, sortCol);
      if (va < vb) return sortDir === 'asc' ? -1 : 1;
      if (va > vb) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });
    return copy;
  }, [filtered, sortCol, sortDir]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages - 1);
  const pageRows = sorted.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE);

  const onSort = (col: SortCol) => {
    if (col === null) return;
    if (sortCol === col) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortCol(col);
      setSortDir('asc');
    }
    setPage(0);
  };

  const cols: { key: Exclude<SortCol, null>; label: string }[] = [
    { key: 'reservation_id', label: 'Reservation' },
    { key: 'first',          label: 'First name' },
    { key: 'surname',        label: 'Surname' },
    { key: 'booking_date',   label: 'Date Booked' },
    { key: 'room_numbers',   label: 'Room#(s)' },
    { key: 'room_type',      label: 'Room Type' },
    { key: 'check_in',       label: 'Check In' },
    { key: 'check_out',      label: 'Check Out' },
    { key: 'nights',         label: 'Nights' },
    { key: 'total',          label: 'Total Price' },
    { key: 'status',         label: 'Status' },
    { key: 'source',         label: 'Source' },
  ];

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        fontFamily: 'var(--sans, "Inter Tight", system-ui, sans-serif)',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
          flexWrap: 'wrap',
        }}
      >
        <input
          type="search"
          placeholder="Search reservation ID or guest name..."
          value={query}
          onChange={(e) => { setQuery(e.target.value); setPage(0); }}
          style={{
            flex: '0 1 320px',
            padding: '6px 10px',
            fontSize: 12,
            border: '1px solid var(--hairline, #E6DFCC)',
            borderRadius: 4,
            background: 'var(--paper, #FFFFFF)',
            color: 'var(--ink, #1B1B1B)',
            fontFamily: 'inherit',
          }}
        />
        <div style={{ fontSize: 11, color: 'var(--ink, #1B1B1B)', opacity: 0.7 }}>
          {sorted.length.toLocaleString('en-US')} shown {'·'} page {safePage + 1} / {totalPages}
        </div>
      </div>

      {sorted.length === 0 ? (
        <div
          style={{
            padding: '32px 12px',
            textAlign: 'center',
            fontSize: 13,
            color: 'var(--ink, #1B1B1B)',
            opacity: 0.7,
          }}
        >
          No reservations in this window.
        </div>
      ) : (
        <div style={{ overflow: 'auto', maxHeight: '70vh' }}>
          <table
            style={{
              width: '100%',
              borderCollapse: 'collapse',
              background: 'var(--paper, #FFFFFF)',
            }}
          >
            <thead>
              <tr>
                {cols.map((c) => (
                  <th
                    key={c.key}
                    onClick={() => onSort(c.key)}
                    style={thStyle(sortCol === c.key)}
                    title="Click to sort"
                  >
                    {c.label}
                    {sortIndicator(sortCol === c.key, sortDir)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {pageRows.map((r) => {
                const pill = statusPill(r.status, r.is_cancelled);
                return (
                  <tr key={r.reservation_id}>
                    <td style={{ ...tdStyle, fontFamily: 'var(--mono, ui-monospace, monospace)' }}>
                      {r.reservation_id}
                    </td>
                    <td style={tdStyle}>{r.guest_first_name ?? EMDASH}</td>
                    <td style={tdStyle}>{r.guest_last_name ?? EMDASH}</td>
                    <td style={tdStyle}>{fmtDate(r.booking_date, tz)}</td>
                    <td style={tdStyle}>{r.room_numbers ?? EMDASH}</td>
                    <td style={tdStyle}>{r.room_type_name ?? EMDASH}</td>
                    <td style={tdStyle}>{fmtDate(r.check_in_date, tz)}</td>
                    <td style={tdStyle}>{fmtDate(r.check_out_date, tz)}</td>
                    <td style={{ ...tdStyle, textAlign: 'right' }}>{r.nights ?? EMDASH}</td>
                    <td style={{ ...tdStyle, textAlign: 'right' }}>
                      {fmtMoney(r.total_amount, sym)}
                    </td>
                    <td style={tdStyle}>
                      <span
                        style={{
                          display: 'inline-block',
                          padding: '2px 8px',
                          borderRadius: 999,
                          fontSize: 10,
                          fontWeight: 600,
                          color: pill.color,
                          background: pill.bg,
                          textTransform: 'uppercase',
                          letterSpacing: 0.4,
                        }}
                      >
                        {pill.label}
                      </span>
                    </td>
                    <td style={tdStyle}>{r.source_name ?? r.source ?? EMDASH}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {totalPages > 1 && (
        <div
          style={{
            display: 'flex',
            justifyContent: 'flex-end',
            gap: 6,
            marginTop: 4,
          }}
        >
          <button
            type="button"
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            disabled={safePage === 0}
            style={{
              padding: '3px 10px',
              fontSize: 11,
              border: '1px solid var(--hairline, #E6DFCC)',
              borderRadius: 4,
              background: 'var(--paper, #FFFFFF)',
              color: 'var(--ink, #1B1B1B)',
              cursor: safePage === 0 ? 'not-allowed' : 'pointer',
              opacity: safePage === 0 ? 0.4 : 1,
            }}
          >
            Prev
          </button>
          <button
            type="button"
            onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
            disabled={safePage >= totalPages - 1}
            style={{
              padding: '3px 10px',
              fontSize: 11,
              border: '1px solid var(--hairline, #E6DFCC)',
              borderRadius: 4,
              background: 'var(--paper, #FFFFFF)',
              color: 'var(--ink, #1B1B1B)',
              cursor: safePage >= totalPages - 1 ? 'not-allowed' : 'pointer',
              opacity: safePage >= totalPages - 1 ? 0.4 : 1,
            }}
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}
