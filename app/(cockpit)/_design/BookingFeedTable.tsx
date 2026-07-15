'use client';
// app/(cockpit)/_design/BookingFeedTable.tsx
//
// PBS 2026-07-15: client-side sortable + expandable table for the
// BookingActivity feed. Server fetches all rows once (up to 200), client
// owns the sort + collapse state so header clicks feel instant and don't
// round-trip to the server. Columns Source · Room · Rate plan · LOS · ADR
// · Revenue · When · Event · Check-in all sortable — click header to
// cycle desc → asc → default.

import { useState, useMemo } from 'react';

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
  | 'event_at' | 'event_kind' | 'check_in_date'
  | 'source' | 'room' | 'rate_plan'
  | 'los' | 'adr' | 'revenue'
  | null;

type SortDir = 'asc' | 'desc';

interface Props {
  rows: Row[];
  sym: string;
  tz: string;
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

export default function BookingFeedTable({
  rows, sym, tz, collapsedRows = DEFAULT_COLLAPSED,
}: Props) {
  const [expanded, setExpanded] = useState(false);
  const [sortCol, setSortCol]   = useState<SortCol>(null);
  const [sortDir, setSortDir]   = useState<SortDir>('desc');

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
      <div style={{
        display: 'flex', justifyContent: 'space-between',
        alignItems: 'center', marginBottom: 8,
      }}>
        <div style={{ fontSize: 11, color: 'var(--ink-soft, #5A5A5A)' }}>
          Showing {shown.length} of {rows.length} · click column headers to sort
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
                  <tr key={key} style={{ borderTop: '1px solid var(--hairline, #E6DFCC)' }}>
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
