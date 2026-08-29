'use client';
// app/h/[property_id]/revenue/reservations/BookingsTableCB.tsx
//
// Cloudbeds-style reservations table for the Bookings tab.
// Fetches from /api/reservations/bookings on mount and whenever filters change.
// All state is local — no URL params — to keep the Bookings tab self-contained.
//
// Columns: Reservation # · Name · Surname · Date Booked · Room#(s) · Room Type
// Sortable: Surname and Date Booked (default: Date Booked desc).
// Filter chips: Search · Booking Date · Check In · Check Out · Room Types · Status · Source
//
// Token usage: --tbl-bg, --tbl-fg, --tbl-fg-mute, --tbl-border,
//   --tbl-border-strong, --tbl-bg-elev, --brass per frontend.md rule for
//   app/h/[property_id]/** pages.

import { useState, useEffect, useRef, useMemo, useCallback, type CSSProperties } from 'react';

// ─── Types ────────────────────────────────────────────────────────────────────

interface BookingRow {
  reservation_id: string;
  guest_first_name: string | null;
  guest_last_name: string | null;
  booking_date: string | null;
  room_numbers: string | null;
  room_type_name: string | null;
  status: string | null;
  source_name: string | null;
  is_cancelled: boolean | null;
}

interface ApiResponse {
  rows: BookingRow[];
  availableSources: string[];
  availableRoomTypes: string[];
  availableStatuses: string[];
  total: number;
  error?: string;
}

export interface Props {
  propertyId: number;
  sym: string; // reserved for price column (future)
}

type SortCol = 'surname' | 'booking_date';
type SortDir = 'asc' | 'desc';

const PAGE_LIMIT = 50;
const EMDASH = '—';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtDate(iso: string | null): string {
  if (!iso) return EMDASH;
  const s = iso.slice(0, 10); // handle timestamps
  const [y, m, d] = s.split('-');
  return `${d}/${m}/${y}`;
}

// ─── Shared styles ────────────────────────────────────────────────────────────

const chipBtn = (active: boolean): CSSProperties => ({
  display: 'inline-flex',
  alignItems: 'center',
  gap: 4,
  padding: '5px 10px',
  fontSize: 12,
  fontWeight: active ? 600 : 500,
  border: `1px solid ${active ? 'var(--brass, #9A7B3B)' : 'var(--tbl-border, #E6DFCC)'}`,
  borderRadius: 4,
  background: active ? 'rgba(154,123,59,0.08)' : 'var(--tbl-bg, #FFFFFF)',
  color: active ? 'var(--brass, #9A7B3B)' : 'var(--tbl-fg, #1B1B1B)',
  cursor: 'pointer',
  whiteSpace: 'nowrap',
  fontFamily: 'inherit',
  lineHeight: 1.2,
});

const dropPanel: CSSProperties = {
  position: 'absolute',
  top: 'calc(100% + 4px)',
  left: 0,
  background: 'var(--tbl-bg-elev, #FFFFFF)',
  border: '1px solid var(--tbl-border, #E6DFCC)',
  borderRadius: 6,
  boxShadow: '0 4px 12px rgba(0,0,0,0.10)',
  padding: '10px 12px',
  zIndex: 200,
  minWidth: 180,
  maxHeight: 260,
  overflowY: 'auto',
  fontFamily: 'inherit',
};

const thSt = (sortable: boolean, active: boolean): CSSProperties => ({
  padding: '8px 10px',
  fontSize: 11,
  fontWeight: 600,
  textAlign: 'left',
  color: 'var(--tbl-fg, #1B1B1B)',
  borderBottom: '1px solid var(--tbl-border-strong, #C8BFA2)',
  cursor: sortable ? 'pointer' : 'default',
  userSelect: 'none',
  whiteSpace: 'nowrap',
  background: active ? 'rgba(0,0,0,0.02)' : 'var(--tbl-bg, #FFFFFF)',
  position: 'sticky',
  top: 0,
  zIndex: 1,
});

const tdSt: CSSProperties = {
  padding: '7px 10px',
  fontSize: 12,
  color: 'var(--tbl-fg, #1B1B1B)',
  borderBottom: '1px solid var(--tbl-border, #E6DFCC)',
  whiteSpace: 'nowrap',
};

// ─── Sub-components (module scope — no RSC crash risk) ───────────────────────

interface MultiSelectFilterProps {
  label: string;
  options: string[];
  selected: string[];
  onToggle: (val: string) => void;
  isOpen: boolean;
  onOpen: () => void;
}

function MultiSelectFilter({ label, options, selected, onToggle, isOpen, onOpen }: MultiSelectFilterProps) {
  const active = selected.length > 0;
  return (
    <div style={{ position: 'relative' }}>
      <button type="button" onClick={onOpen} style={chipBtn(active)}>
        {label}
        {active ? ` (${selected.length})` : ''}
        <span style={{ opacity: 0.5, fontSize: 10 }}>▾</span>
      </button>
      {isOpen && (
        <div style={dropPanel}>
          {options.length === 0 ? (
            <div style={{ fontSize: 12, color: 'var(--tbl-fg-mute, #888)' }}>No options</div>
          ) : (
            options.map(opt => (
              <label
                key={opt}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '3px 0',
                  cursor: 'pointer',
                  fontSize: 12,
                  color: 'var(--tbl-fg, #1B1B1B)',
                  whiteSpace: 'nowrap',
                }}
              >
                <input
                  type="checkbox"
                  checked={selected.includes(opt)}
                  onChange={() => onToggle(opt)}
                  style={{ cursor: 'pointer', accentColor: 'var(--brass, #9A7B3B)' }}
                />
                {opt}
              </label>
            ))
          )}
        </div>
      )}
    </div>
  );
}

interface DateRangeFilterProps {
  label: string;
  from: string;
  to: string;
  onFromChange: (v: string) => void;
  onToChange: (v: string) => void;
  isOpen: boolean;
  onOpen: () => void;
}

function DateRangeFilter({ label, from, to, onFromChange, onToChange, isOpen, onOpen }: DateRangeFilterProps) {
  const active = !!from || !!to;
  const dateInput: CSSProperties = {
    width: '100%',
    padding: '4px 6px',
    fontSize: 12,
    border: '1px solid var(--tbl-border, #E6DFCC)',
    borderRadius: 4,
    background: 'var(--tbl-bg, #FFFFFF)',
    color: 'var(--tbl-fg, #1B1B1B)',
    fontFamily: 'inherit',
    boxSizing: 'border-box',
  };
  return (
    <div style={{ position: 'relative' }}>
      <button type="button" onClick={onOpen} style={chipBtn(active)}>
        {label}
        {active && <span style={{ fontSize: 10 }}>✓</span>}
        <span style={{ opacity: 0.5, fontSize: 10 }}>▾</span>
      </button>
      {isOpen && (
        <div style={{ ...dropPanel, minWidth: 200 }}>
          <div style={{ marginBottom: 8 }}>
            <div style={{ fontSize: 11, color: 'var(--tbl-fg-mute, #888)', marginBottom: 3 }}>From (YYYY-MM-DD)</div>
            <input type="date" value={from} onChange={e => onFromChange(e.target.value)} style={dateInput} />
          </div>
          <div>
            <div style={{ fontSize: 11, color: 'var(--tbl-fg-mute, #888)', marginBottom: 3 }}>To (YYYY-MM-DD)</div>
            <input type="date" value={to} onChange={e => onToChange(e.target.value)} style={dateInput} />
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function BookingsTableCB({ propertyId }: Props) {
  // Filter state
  const [statusFilter, setStatusFilter] = useState<string[]>([]);
  const [sourceFilter, setSourceFilter] = useState<string[]>([]);
  const [roomTypeFilter, setRoomTypeFilter] = useState<string[]>([]);
  const [fromBooking, setFromBooking] = useState('');
  const [toBooking, setToBooking] = useState('');
  const [fromCheckin, setFromCheckin] = useState('');
  const [toCheckin, setToCheckin] = useState('');
  const [fromCheckout, setFromCheckout] = useState('');
  const [toCheckout, setToCheckout] = useState('');
  const [search, setSearch] = useState('');

  // Debounced date filters to avoid fetching on every keystroke
  const [debouncedDates, setDebouncedDates] = useState({
    fromBooking, toBooking, fromCheckin, toCheckin, fromCheckout, toCheckout,
  });
  useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedDates({ fromBooking, toBooking, fromCheckin, toCheckin, fromCheckout, toCheckout });
    }, 400);
    return () => clearTimeout(t);
  }, [fromBooking, toBooking, fromCheckin, toCheckin, fromCheckout, toCheckout]);

  // UI state
  const [openFilter, setOpenFilter] = useState<string | null>(null);
  const [sortCol, setSortCol] = useState<SortCol>('booking_date');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [showAll, setShowAll] = useState(false);

  // API state
  const [data, setData] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  // Click-outside handler for dropdowns
  const filterBarRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    function onMouseDown(e: MouseEvent) {
      if (filterBarRef.current && !filterBarRef.current.contains(e.target as Node)) {
        setOpenFilter(null);
      }
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpenFilter(null);
    }
    document.addEventListener('mousedown', onMouseDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onMouseDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, []);

  // Fetch data whenever filters change
  const fetch_ = useCallback(() => {
    const params = new URLSearchParams({ pid: String(propertyId) });
    if (statusFilter.length) params.set('status', statusFilter.join(','));
    if (sourceFilter.length) params.set('source', sourceFilter.join(','));
    if (roomTypeFilter.length) params.set('room_types', roomTypeFilter.join(','));
    if (debouncedDates.fromBooking) params.set('from_booking', debouncedDates.fromBooking);
    if (debouncedDates.toBooking) params.set('to_booking', debouncedDates.toBooking);
    if (debouncedDates.fromCheckin) params.set('from_checkin', debouncedDates.fromCheckin);
    if (debouncedDates.toCheckin) params.set('to_checkin', debouncedDates.toCheckin);
    if (debouncedDates.fromCheckout) params.set('from_checkout', debouncedDates.fromCheckout);
    if (debouncedDates.toCheckout) params.set('to_checkout', debouncedDates.toCheckout);
    return params;
  }, [propertyId, statusFilter, sourceFilter, roomTypeFilter, debouncedDates]);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setFetchError(null);

    globalThis.fetch(`/api/reservations/bookings?${fetch_()}`, { signal: controller.signal })
      .then(r => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json() as Promise<ApiResponse>;
      })
      .then(d => {
        setData(d);
        setLoading(false);
      })
      .catch((e: Error) => {
        if (e.name === 'AbortError') return;
        setFetchError(e.message);
        setLoading(false);
      });

    return () => controller.abort();
  }, [fetch_]);

  // Sort + client-side search
  const sorted = useMemo(() => {
    const copy = [...(data?.rows ?? [])];
    copy.sort((a, b) => {
      const va = sortCol === 'surname'
        ? (a.guest_last_name ?? '').toLowerCase()
        : (a.booking_date ?? '');
      const vb = sortCol === 'surname'
        ? (b.guest_last_name ?? '').toLowerCase()
        : (b.booking_date ?? '');
      if (va < vb) return sortDir === 'asc' ? -1 : 1;
      if (va > vb) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });
    return copy;
  }, [data?.rows, sortCol, sortDir]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return sorted;
    return sorted.filter(r =>
      r.guest_first_name?.toLowerCase().includes(q) ||
      r.guest_last_name?.toLowerCase().includes(q) ||
      r.reservation_id?.toLowerCase().includes(q)
    );
  }, [sorted, search]);

  const displayed = showAll ? filtered : filtered.slice(0, PAGE_LIMIT);

  // Sort toggle
  function onSort(col: SortCol) {
    if (sortCol === col) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortCol(col);
      setSortDir('desc');
    }
  }

  // Multi-select toggle helper
  function toggle(setter: React.Dispatch<React.SetStateAction<string[]>>, val: string) {
    setter(prev => prev.includes(val) ? prev.filter(v => v !== val) : [...prev, val]);
  }

  // Chip open toggle (close if already open)
  function openChip(id: string) {
    setOpenFilter(prev => prev === id ? null : id);
  }

  const hasAnyFilter =
    statusFilter.length > 0 || sourceFilter.length > 0 || roomTypeFilter.length > 0 ||
    !!fromBooking || !!toBooking || !!fromCheckin || !!toCheckin || !!fromCheckout || !!toCheckout;

  function resetFilters() {
    setStatusFilter([]);
    setSourceFilter([]);
    setRoomTypeFilter([]);
    setFromBooking(''); setToBooking('');
    setFromCheckin(''); setToCheckin('');
    setFromCheckout(''); setToCheckout('');
    setSearch('');
    setShowAll(false);
  }

  const sortIndicator = (col: SortCol) =>
    sortCol === col ? (sortDir === 'asc' ? ' ▲' : ' ▼') : '';

  return (
    <div
      style={{
        fontFamily: 'var(--sans, "Inter Tight", system-ui, sans-serif)',
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
      }}
    >
      {/* Filter bar */}
      <div
        ref={filterBarRef}
        style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 6 }}
      >
        {/* Search */}
        <input
          type="search"
          placeholder="Search by Guest name or Reservation #"
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{
            padding: '5px 10px',
            fontSize: 12,
            border: '1px solid var(--tbl-border, #E6DFCC)',
            borderRadius: 4,
            background: 'var(--tbl-bg, #FFFFFF)',
            color: 'var(--tbl-fg, #1B1B1B)',
            fontFamily: 'inherit',
            flex: '0 1 260px',
            minWidth: 180,
          }}
        />

        {/* Booking Date */}
        <DateRangeFilter
          label="Booking Date"
          from={fromBooking}
          to={toBooking}
          onFromChange={setFromBooking}
          onToChange={setToBooking}
          isOpen={openFilter === 'booking_date'}
          onOpen={() => openChip('booking_date')}
        />

        {/* Check In */}
        <DateRangeFilter
          label="Check In Date"
          from={fromCheckin}
          to={toCheckin}
          onFromChange={setFromCheckin}
          onToChange={setToCheckin}
          isOpen={openFilter === 'checkin'}
          onOpen={() => openChip('checkin')}
        />

        {/* Check Out */}
        <DateRangeFilter
          label="Check Out Date"
          from={fromCheckout}
          to={toCheckout}
          onFromChange={setFromCheckout}
          onToChange={setToCheckout}
          isOpen={openFilter === 'checkout'}
          onOpen={() => openChip('checkout')}
        />

        {/* Room Types */}
        <MultiSelectFilter
          label="Room Types"
          options={data?.availableRoomTypes ?? []}
          selected={roomTypeFilter}
          onToggle={v => toggle(setRoomTypeFilter, v)}
          isOpen={openFilter === 'room_types'}
          onOpen={() => openChip('room_types')}
        />

        {/* Status */}
        <MultiSelectFilter
          label="Status"
          options={data?.availableStatuses ?? []}
          selected={statusFilter}
          onToggle={v => toggle(setStatusFilter, v)}
          isOpen={openFilter === 'status'}
          onOpen={() => openChip('status')}
        />

        {/* Source */}
        <MultiSelectFilter
          label="Source"
          options={data?.availableSources ?? []}
          selected={sourceFilter}
          onToggle={v => toggle(setSourceFilter, v)}
          isOpen={openFilter === 'source'}
          onOpen={() => openChip('source')}
        />

        {/* Reset */}
        {hasAnyFilter && (
          <button
            type="button"
            onClick={resetFilters}
            style={{
              padding: '5px 10px',
              fontSize: 12,
              fontWeight: 500,
              border: 'none',
              background: 'transparent',
              color: 'var(--brass, #9A7B3B)',
              cursor: 'pointer',
              textDecoration: 'underline',
              fontFamily: 'inherit',
            }}
          >
            Reset Filters
          </button>
        )}
      </div>

      {/* Summary + show-all toggle */}
      <div style={{ fontSize: 12, color: 'var(--tbl-fg-mute, #888)', display: 'flex', alignItems: 'center', gap: 8 }}>
        {loading ? (
          <span>Loading…</span>
        ) : fetchError ? (
          <span style={{ color: '#c00' }}>Error: {fetchError}</span>
        ) : (
          <>
            <span>{filtered.length.toLocaleString('en-US')} reservations</span>
            {!showAll && filtered.length > PAGE_LIMIT && (
              <>
                <span style={{ opacity: 0.5 }}>·</span>
                <span>Showing {PAGE_LIMIT} of {filtered.length}</span>
                <button
                  type="button"
                  onClick={() => setShowAll(true)}
                  style={{
                    fontSize: 12,
                    color: 'var(--brass, #9A7B3B)',
                    background: 'transparent',
                    border: 'none',
                    cursor: 'pointer',
                    textDecoration: 'underline',
                    fontFamily: 'inherit',
                    padding: 0,
                  }}
                >
                  Show all
                </button>
              </>
            )}
            {showAll && filtered.length > PAGE_LIMIT && (
              <>
                <span style={{ opacity: 0.5 }}>·</span>
                <button
                  type="button"
                  onClick={() => setShowAll(false)}
                  style={{
                    fontSize: 12,
                    color: 'var(--brass, #9A7B3B)',
                    background: 'transparent',
                    border: 'none',
                    cursor: 'pointer',
                    textDecoration: 'underline',
                    fontFamily: 'inherit',
                    padding: 0,
                  }}
                >
                  Collapse to {PAGE_LIMIT}
                </button>
              </>
            )}
          </>
        )}
      </div>

      {/* Table */}
      {!loading && !fetchError && (
        filtered.length === 0 ? (
          <div
            style={{
              padding: '32px 12px',
              textAlign: 'center',
              fontSize: 13,
              color: 'var(--tbl-fg-mute, #888)',
            }}
          >
            No bookings match the current filters.
          </div>
        ) : (
          <div style={{ overflowX: 'auto', maxHeight: '72vh' }}>
            <table
              style={{
                width: '100%',
                borderCollapse: 'collapse',
                background: 'var(--tbl-bg, #FFFFFF)',
              }}
            >
              <thead>
                <tr>
                  <th style={thSt(false, false)}>Reservation #</th>
                  <th style={thSt(false, false)}>Name</th>
                  <th
                    style={thSt(true, sortCol === 'surname')}
                    onClick={() => onSort('surname')}
                    title="Sort by surname"
                  >
                    Surname{sortIndicator('surname')}
                  </th>
                  <th
                    style={thSt(true, sortCol === 'booking_date')}
                    onClick={() => onSort('booking_date')}
                    title="Sort by date booked"
                  >
                    Date Booked{sortIndicator('booking_date')}
                  </th>
                  <th style={thSt(false, false)}>Room#(s)</th>
                  <th style={thSt(false, false)}>Room Type</th>
                </tr>
              </thead>
              <tbody>
                {displayed.map(r => (
                  <tr key={r.reservation_id}>
                    <td style={{ ...tdSt, fontFamily: 'var(--mono, ui-monospace, monospace)', fontSize: 11 }}>
                      {r.reservation_id}
                    </td>
                    <td style={tdSt}>{r.guest_first_name ?? EMDASH}</td>
                    <td style={tdSt}>{r.guest_last_name ?? EMDASH}</td>
                    <td style={tdSt}>{fmtDate(r.booking_date)}</td>
                    <td style={tdSt}>{r.room_numbers ?? EMDASH}</td>
                    <td style={tdSt}>{r.room_type_name ?? EMDASH}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      )}
    </div>
  );
}
