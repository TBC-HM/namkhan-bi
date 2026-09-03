'use client';
// app/h/[property_id]/revenue/reservations/BookingsTableCB.tsx
//
// Cloudbeds-style reservations table: pill filter chips, calendar date pickers,
// searchable multi-select dropdowns, sortable columns.
// Tokens: --tbl-* and --brass only (frontend.md rule for app/h/[property_id]/**).

import {
  useState, useEffect, useRef, useMemo, useCallback,
  type CSSProperties, type Dispatch, type SetStateAction,
} from 'react';

// ─── Types ────────────────────────────────────────────────────────────────────

interface BookingRow {
  reservation_id:  string;
  guest_first_name: string | null;
  guest_last_name:  string | null;
  booking_date:     string | null;
  check_in_date:    string | null;
  check_out_date:   string | null;
  room_numbers:     string | null;
  room_type_name:   string | null;
  status:           string | null;
  source_name:      string | null;
  is_cancelled:     boolean | null;
}

interface ApiResponse {
  rows:                 BookingRow[];
  availableSources:     string[];
  availableRoomTypes:   string[];
  availableStatuses:    string[];
  total:                number;
  error?:               string;
}

export interface Props { propertyId: number; sym: string }

type SortCol = 'surname' | 'booking_date';
type SortDir = 'asc' | 'desc';

const PAGE = 50;
const EM   = '—';

// ─── Formatting ───────────────────────────────────────────────────────────────

function fmtDate(iso: string | null): string {
  if (!iso) return EM;
  const [y, m, d] = iso.slice(0, 10).split('-');
  return `${d}/${m}/${y}`;
}

function isoFromYMD(y: number, m: number, d: number): string {
  return `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

function fmtIsoShort(iso: string): string {
  const dt = new Date(iso + 'T00:00:00Z');
  return dt.toLocaleString('en-GB', { month: 'short', day: 'numeric', timeZone: 'UTC' });
}

function daysInMonth(y: number, m: number): number {
  return new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
}

// ─── Status badge ─────────────────────────────────────────────────────────────

function statusBadge(status: string | null, isCancelled: boolean | null): { label: string; style: CSSProperties } {
  if (isCancelled) return {
    label: 'CANCELLED',
    style: { background: '#FEE2E2', color: '#991B1B', padding: '3px 8px', borderRadius: 4, fontSize: 11, fontWeight: 700, letterSpacing: '0.04em' },
  };
  const s = (status ?? '').toLowerCase();
  if (s === 'checked in') return {
    label: 'CHECKED IN',
    style: { background: '#D1FAE5', color: '#065F46', padding: '3px 8px', borderRadius: 4, fontSize: 11, fontWeight: 700, letterSpacing: '0.04em' },
  };
  if (s === 'checked out') return {
    label: 'CHECKED OUT',
    style: { background: '#F3F4F6', color: '#374151', padding: '3px 8px', borderRadius: 4, fontSize: 11, fontWeight: 700, letterSpacing: '0.04em' },
  };
  if (s === 'confirmed') return {
    label: 'CONFIRMED',
    style: { background: '#DCFCE7', color: '#166534', padding: '3px 8px', borderRadius: 4, fontSize: 11, fontWeight: 700, letterSpacing: '0.04em' },
  };
  return {
    label: (status ?? '—').toUpperCase(),
    style: { background: '#F3F4F6', color: '#374151', padding: '3px 8px', borderRadius: 4, fontSize: 11, fontWeight: 700, letterSpacing: '0.04em' },
  };
}

// ─── Token-based style constants (module scope) ───────────────────────────────

const chipBase: CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: 5,
  padding: '5px 12px', fontSize: 12, borderRadius: 20,
  border: '1px solid var(--tbl-border)', background: '#fff',
  color: '#1B1B1B', cursor: 'pointer', whiteSpace: 'nowrap',
  fontFamily: 'inherit', lineHeight: 1.4, userSelect: 'none',
  transition: 'border-color 0.15s',
};

const chipActive: CSSProperties = {
  ...chipBase,
  border: '1px solid var(--brass)',
  color: 'var(--brass)',
  background: 'rgba(154,123,59,0.06)',
  fontWeight: 600,
};

const panel: CSSProperties = {
  position: 'absolute', top: 'calc(100% + 6px)', left: 0,
  background: 'var(--tbl-bg-elev)',
  border: '1px solid var(--tbl-border)',
  borderRadius: 8, boxShadow: '0 4px 20px rgba(0,0,0,0.14)',
  zIndex: 400, minWidth: 220,
};

const thBase: CSSProperties = {
  padding: '8px 14px', fontSize: 11, fontWeight: 700,
  textAlign: 'left', color: 'var(--tbl-fg-mute)',
  borderBottom: '1px solid var(--tbl-border-strong)',
  whiteSpace: 'nowrap', background: 'var(--tbl-bg)',
  position: 'sticky', top: 0, zIndex: 1,
  textTransform: 'uppercase', letterSpacing: '0.06em',
};

const thSort: CSSProperties = { ...thBase, cursor: 'pointer', userSelect: 'none' };

const td: CSSProperties = {
  padding: '9px 14px', fontSize: 13,
  color: 'var(--tbl-fg)',
  borderBottom: '1px solid var(--tbl-border)',
  whiteSpace: 'nowrap',
};

// ─── CalendarPicker (module scope) ────────────────────────────────────────────

const MONTHS = ['January','February','March','April','May','June',
                'July','August','September','October','November','December'];
const DOW    = ['Su','Mo','Tu','We','Th','Fr','Sa'];

interface CalPickerProps {
  from: string; to: string;
  onApply(from: string, to: string): void;
  onClose(): void;
}

function CalendarPicker({ from, to, onApply, onClose }: CalPickerProps) {
  const now = new Date();
  const initY = from ? +from.slice(0, 4) : now.getFullYear();
  const initM = from ? +from.slice(5, 7) - 1 : now.getMonth();
  const [vy, setVy] = useState(initY);
  const [vm, setVm] = useState(initM);
  const [selFrom, setSelFrom] = useState(from);
  const [selTo,   setSelTo]   = useState(to);
  const [step, setStep] = useState<'from' | 'to'>('from');

  const first = new Date(Date.UTC(vy, vm, 1)).getUTCDay();
  const total = daysInMonth(vy, vm);
  const cells: (number | null)[] = [];
  for (let i = 0; i < first; i++) cells.push(null);
  for (let d = 1; d <= total; d++) cells.push(d);

  function clickDay(d: number) {
    const iso = isoFromYMD(vy, vm, d);
    if (step === 'from') {
      setSelFrom(iso); setSelTo(''); setStep('to');
    } else {
      if (iso < selFrom) { setSelFrom(iso); setSelTo(selFrom); }
      else                { setSelTo(iso); }
      setStep('from');
    }
  }

  function dayState(d: number): 'start' | 'end' | 'range' | 'none' {
    const iso = isoFromYMD(vy, vm, d);
    if (iso === selFrom) return 'start';
    if (iso === selTo)   return 'end';
    if (selFrom && selTo && iso > selFrom && iso < selTo) return 'range';
    return 'none';
  }

  function navPrev() {
    if (vm === 0) { setVm(11); setVy(y => y - 1); }
    else setVm(m => m - 1);
  }
  function navNext() {
    if (vm === 11) { setVm(0); setVy(y => y + 1); }
    else setVm(m => m + 1);
  }

  const yearOptions = Array.from({ length: 6 }, (_, i) => now.getFullYear() - 3 + i);

  const btnBase: CSSProperties = {
    background: 'none', border: 'none', cursor: 'pointer',
    fontSize: 16, color: 'var(--tbl-fg)', padding: '2px 8px', lineHeight: 1,
  };

  return (
    <div style={{ ...panel, padding: 14, minWidth: 290 }}>
      {/* Month / year nav */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <button style={btnBase} onClick={navPrev}>‹</button>
        <div style={{ display: 'flex', gap: 4 }}>
          <select value={vm} onChange={e => setVm(+e.target.value)} style={{
            border: '1px solid var(--tbl-border)', borderRadius: 4,
            padding: '2px 4px', fontSize: 12,
            background: 'var(--tbl-bg)', color: 'var(--tbl-fg)', fontFamily: 'inherit',
          }}>
            {MONTHS.map((mn, i) => <option key={mn} value={i}>{mn}</option>)}
          </select>
          <select value={vy} onChange={e => setVy(+e.target.value)} style={{
            border: '1px solid var(--tbl-border)', borderRadius: 4,
            padding: '2px 4px', fontSize: 12,
            background: 'var(--tbl-bg)', color: 'var(--tbl-fg)', fontFamily: 'inherit',
          }}>
            {yearOptions.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
        <button style={btnBase} onClick={navNext}>›</button>
      </div>

      {/* Day-of-week header */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', marginBottom: 4 }}>
        {DOW.map(d => (
          <div key={d} style={{
            fontSize: 10, textAlign: 'center',
            color: 'var(--tbl-fg-mute)', fontWeight: 700, padding: '2px 0',
          }}>{d}</div>
        ))}
      </div>

      {/* Day cells */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2 }}>
        {cells.map((d, i) => {
          if (d === null) return <div key={`_${i}`} />;
          const st = dayState(d);
          return (
            <button key={d} onClick={() => clickDay(d)} style={{
              fontSize: 12, textAlign: 'center', padding: '5px 2px',
              border: 'none', cursor: 'pointer', borderRadius: 4, fontFamily: 'inherit',
              background: st === 'start' || st === 'end'
                ? 'var(--brass)'
                : st === 'range' ? 'rgba(154,123,59,0.18)' : 'transparent',
              color: st === 'start' || st === 'end' ? 'var(--tbl-bg)' : 'var(--tbl-fg)',
              fontWeight: st === 'start' || st === 'end' ? 700 : 400,
            }}>{d}</button>
          );
        })}
      </div>

      {/* Hint */}
      <div style={{ fontSize: 10, color: 'var(--tbl-fg-mute)', textAlign: 'center', marginTop: 8 }}>
        {!selFrom
          ? 'Click to select start date'
          : !selTo
            ? 'Now select end date'
            : `${fmtIsoShort(selFrom)} – ${fmtIsoShort(selTo)}`}
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 10 }}>
        <button onClick={() => { setSelFrom(''); setSelTo(''); setStep('from'); }} style={{
          padding: '5px 14px', fontSize: 12, fontFamily: 'inherit', cursor: 'pointer',
          border: '1px solid var(--tbl-border)', borderRadius: 6,
          background: 'var(--tbl-bg)', color: 'var(--tbl-fg)',
        }}>Clear</button>
        <button onClick={() => { onApply(selFrom, selTo); onClose(); }} style={{
          padding: '5px 14px', fontSize: 12, fontFamily: 'inherit', cursor: 'pointer',
          border: 'none', borderRadius: 6,
          background: 'var(--brass)', color: 'var(--tbl-bg)', fontWeight: 700,
        }}>Apply</button>
      </div>
    </div>
  );
}

// ─── DateRangeChip (module scope) ─────────────────────────────────────────────

interface DateRangeChipProps {
  id: string; label: string;
  from: string; to: string;
  onApply(from: string, to: string): void;
  isOpen: boolean; onOpen(): void;
}

function DateRangeChip({ id, label, from, to, onApply, isOpen, onOpen }: DateRangeChipProps) {
  const active = !!from || !!to;
  let chipText = `${label}: All`;
  if (active) {
    if (from && to) chipText = `${label}: ${fmtIsoShort(from)} – ${fmtIsoShort(to)}`;
    else if (from)  chipText = `${label}: from ${fmtIsoShort(from)}`;
    else             chipText = `${label}: to ${fmtIsoShort(to)}`;
  }
  return (
    <div style={{ position: 'relative' }}>
      <button type="button" onClick={onOpen} style={active ? chipActive : chipBase}>
        {chipText}
        {active
          ? <span style={{ opacity: 0.65, fontSize: 13, lineHeight: 1 }}>×</span>
          : <span style={{ opacity: 0.4, fontSize: 10 }}>▾</span>}
      </button>
      {isOpen && (
        <CalendarPicker
          from={from} to={to}
          onApply={onApply}
          onClose={onOpen}
        />
      )}
    </div>
  );
}

// ─── MultiSelectChip (module scope) ───────────────────────────────────────────

interface MultiSelectChipProps {
  label: string; options: string[]; selected: string[];
  onToggle(val: string): void;
  onClear(): void;
  isOpen: boolean; onOpen(): void;
}

function MultiSelectChip({ label, options, selected, onToggle, onClear, isOpen, onOpen }: MultiSelectChipProps) {
  const [q, setQ] = useState('');
  const active = selected.length > 0;
  const chipText = active ? `${label}: ${selected.length}` : `${label}: All`;
  const allSel = options.length > 0 && selected.length === options.length;
  const shown = q ? options.filter(o => o.toLowerCase().includes(q.toLowerCase())) : options;

  function toggleAll() {
    if (allSel) onClear();
    else options.forEach(o => { if (!selected.includes(o)) onToggle(o); });
  }

  return (
    <div style={{ position: 'relative' }}>
      <button type="button" onClick={onOpen} style={active ? chipActive : chipBase}>
        {chipText}
        {active
          ? <span
              onClick={e => { e.stopPropagation(); onClear(); }}
              style={{ opacity: 0.65, fontSize: 13, lineHeight: 1 }}
            >×</span>
          : <span style={{ opacity: 0.4, fontSize: 10 }}>▾</span>}
      </button>
      {isOpen && (
        <div style={{ ...panel, maxHeight: 340, display: 'flex', flexDirection: 'column' }}>
          {/* Search */}
          <div style={{ padding: '8px 10px', borderBottom: '1px solid var(--tbl-border)', flexShrink: 0 }}>
            <input
              autoFocus
              type="text"
              placeholder="Search"
              value={q}
              onChange={e => setQ(e.target.value)}
              style={{
                width: '100%', padding: '4px 8px', fontSize: 12,
                border: '1px solid var(--tbl-border)', borderRadius: 4,
                background: 'var(--tbl-bg)', color: 'var(--tbl-fg)',
                fontFamily: 'inherit', boxSizing: 'border-box',
              }}
            />
          </div>
          {/* Select all */}
          <label style={{
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '6px 10px', cursor: 'pointer', flexShrink: 0,
            borderBottom: '1px solid var(--tbl-border)',
            fontSize: 12, fontWeight: 600, color: 'var(--tbl-fg)',
          }}>
            <input
              type="checkbox"
              checked={allSel}
              onChange={toggleAll}
              style={{ accentColor: 'var(--brass)', cursor: 'pointer' }}
            />
            Select all
          </label>
          {/* Options */}
          <div style={{ overflowY: 'auto', flexGrow: 1, padding: '4px 0' }}>
            {shown.length === 0
              ? <div style={{ padding: '8px 10px', fontSize: 12, color: 'var(--tbl-fg-mute)' }}>No results</div>
              : shown.map(opt => (
                <label key={opt} style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  padding: '5px 10px', cursor: 'pointer',
                  fontSize: 12, color: 'var(--tbl-fg)',
                }}>
                  <input
                    type="checkbox"
                    checked={selected.includes(opt)}
                    onChange={() => onToggle(opt)}
                    style={{ accentColor: 'var(--brass)', cursor: 'pointer' }}
                  />
                  {opt}
                </label>
              ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function BookingsTableCB({ propertyId }: Props) {
  // Date range filters
  const [stayFrom,    setStayFrom]    = useState('');
  const [stayTo,      setStayTo]      = useState('');
  const [bookFrom,    setBookFrom]    = useState('');
  const [bookTo,      setBookTo]      = useState('');
  const [ciFrom,      setCiFrom]      = useState('');
  const [ciTo,        setCiTo]        = useState('');
  const [coFrom,      setCoFrom]      = useState('');
  const [coTo,        setCoTo]        = useState('');

  // Multi-select filters
  const [statusFilter,   setStatusFilter]   = useState<string[]>([]);
  const [sourceFilter,   setSourceFilter]   = useState<string[]>([]);
  const [roomTypeFilter, setRoomTypeFilter] = useState<string[]>([]);

  // Search + UI
  const [search,    setSearch]    = useState('');
  const [openChip,  setOpenChip]  = useState<string | null>(null);
  const [sortCol,   setSortCol]   = useState<SortCol>('booking_date');
  const [sortDir,   setSortDir]   = useState<SortDir>('desc');
  const [showAll,   setShowAll]   = useState(false);

  // API
  const [data,    setData]    = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [apiErr,  setApiErr]  = useState<string | null>(null);

  // Click-outside closes any open chip dropdown
  const barRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    function onDown(e: MouseEvent) {
      if (barRef.current && !barRef.current.contains(e.target as Node))
        setOpenChip(null);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpenChip(null);
    }
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey); };
  }, []);

  // Build fetch params (memoised so useEffect dep-array is stable)
  const fetchParams = useCallback(() => {
    const p = new URLSearchParams({ pid: String(propertyId) });
    if (statusFilter.length)   p.set('status',      statusFilter.join(','));
    if (sourceFilter.length)   p.set('source',      sourceFilter.join(','));
    if (roomTypeFilter.length) p.set('room_types',  roomTypeFilter.join(','));
    if (stayFrom)  p.set('from_stay',     stayFrom);
    if (stayTo)    p.set('to_stay',       stayTo);
    if (bookFrom)  p.set('from_booking',  bookFrom);
    if (bookTo)    p.set('to_booking',    bookTo);
    if (ciFrom)    p.set('from_checkin',  ciFrom);
    if (ciTo)      p.set('to_checkin',    ciTo);
    if (coFrom)    p.set('from_checkout', coFrom);
    if (coTo)      p.set('to_checkout',   coTo);
    return p.toString();
  }, [propertyId, statusFilter, sourceFilter, roomTypeFilter,
      stayFrom, stayTo, bookFrom, bookTo, ciFrom, ciTo, coFrom, coTo]);

  useEffect(() => {
    const ctrl = new AbortController();
    setLoading(true); setApiErr(null);
    globalThis.fetch(`/api/reservations/bookings?${fetchParams()}`, { signal: ctrl.signal })
      .then(r => r.ok ? r.json() as Promise<ApiResponse> : Promise.reject(`HTTP ${r.status}`))
      .then(d => { setData(d); setLoading(false); })
      .catch((e: Error | string) => {
        if (typeof e !== 'string' && e.name === 'AbortError') return;
        setApiErr(String(e)); setLoading(false);
      });
    return () => ctrl.abort();
  }, [fetchParams]);

  // Client-side search + sort
  const sorted = useMemo(() => {
    const rows = [...(data?.rows ?? [])];
    rows.sort((a, b) => {
      const va = sortCol === 'surname' ? (a.guest_last_name ?? '').toLowerCase() : (a.booking_date ?? '');
      const vb = sortCol === 'surname' ? (b.guest_last_name ?? '').toLowerCase() : (b.booking_date ?? '');
      if (va < vb) return sortDir === 'asc' ? -1 : 1;
      if (va > vb) return sortDir === 'asc' ?  1 : -1;
      return 0;
    });
    return rows;
  }, [data?.rows, sortCol, sortDir]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return sorted;
    return sorted.filter(r =>
      r.guest_first_name?.toLowerCase().includes(q) ||
      r.guest_last_name?.toLowerCase().includes(q)  ||
      r.reservation_id?.toLowerCase().includes(q)
    );
  }, [sorted, search]);

  const displayed = showAll ? filtered : filtered.slice(0, PAGE);

  // Toggle helpers
  function toggleSort(col: SortCol) {
    if (sortCol === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortCol(col); setSortDir('desc'); }
  }

  function toggleMulti(setter: Dispatch<SetStateAction<string[]>>, val: string) {
    setter(prev => prev.includes(val) ? prev.filter(v => v !== val) : [...prev, val]);
  }

  function openOnly(id: string) {
    setOpenChip(prev => prev === id ? null : id);
  }

  const hasFilter =
    !!stayFrom || !!stayTo || !!bookFrom || !!bookTo ||
    !!ciFrom   || !!ciTo   || !!coFrom   || !!coTo   ||
    statusFilter.length > 0 || sourceFilter.length > 0 || roomTypeFilter.length > 0;

  function resetAll() {
    setStayFrom('');  setStayTo('');
    setBookFrom('');  setBookTo('');
    setCiFrom('');    setCiTo('');
    setCoFrom('');    setCoTo('');
    setStatusFilter([]); setSourceFilter([]); setRoomTypeFilter([]);
    setSearch(''); setShowAll(false);
  }

  function sortArrow(col: SortCol) {
    if (sortCol !== col) return ' ↕';
    return sortDir === 'asc' ? ' ↑' : ' ↓';
  }

  // ─── Render ─────────────────────────────────────────────────────────────────

  return (
    <div style={{ fontFamily: 'inherit', display: 'flex', flexDirection: 'column', gap: 14 }}>

      {/* Search bar */}
      <div style={{ position: 'relative', maxWidth: 380 }}>
        <span style={{
          position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)',
          fontSize: 14, color: 'var(--tbl-fg-mute)', pointerEvents: 'none',
        }}>🔍</span>
        <input
          type="search"
          placeholder="Search by Guest name, email, or phone"
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{
            width: '100%', padding: '8px 12px 8px 34px',
            fontSize: 13, border: '1px solid var(--tbl-border)',
            borderRadius: 6, background: '#fff',
            color: '#1B1B1B', fontFamily: 'inherit',
            boxSizing: 'border-box',
          }}
        />
      </div>

      {/* Filter chip row */}
      <div ref={barRef} style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 6 }}>

        {/* Stay Date */}
        <DateRangeChip
          id="stay" label="Stay Date"
          from={stayFrom} to={stayTo}
          onApply={(f, t) => { setStayFrom(f); setStayTo(t); }}
          isOpen={openChip === 'stay'} onOpen={() => openOnly('stay')}
        />

        {/* Booking Date */}
        <DateRangeChip
          id="book" label="Booking Date"
          from={bookFrom} to={bookTo}
          onApply={(f, t) => { setBookFrom(f); setBookTo(t); }}
          isOpen={openChip === 'book'} onOpen={() => openOnly('book')}
        />

        {/* Check In Date */}
        <DateRangeChip
          id="ci" label="Check In Date"
          from={ciFrom} to={ciTo}
          onApply={(f, t) => { setCiFrom(f); setCiTo(t); }}
          isOpen={openChip === 'ci'} onOpen={() => openOnly('ci')}
        />

        {/* Check Out Date */}
        <DateRangeChip
          id="co" label="Check Out Date"
          from={coFrom} to={coTo}
          onApply={(f, t) => { setCoFrom(f); setCoTo(t); }}
          isOpen={openChip === 'co'} onOpen={() => openOnly('co')}
        />

        {/* Room Types */}
        <MultiSelectChip
          label="Room Types"
          options={data?.availableRoomTypes ?? []}
          selected={roomTypeFilter}
          onToggle={v => toggleMulti(setRoomTypeFilter, v)}
          onClear={() => setRoomTypeFilter([])}
          isOpen={openChip === 'rt'} onOpen={() => openOnly('rt')}
        />

        {/* Status */}
        <MultiSelectChip
          label="Status"
          options={data?.availableStatuses ?? []}
          selected={statusFilter}
          onToggle={v => toggleMulti(setStatusFilter, v)}
          onClear={() => setStatusFilter([])}
          isOpen={openChip === 'st'} onOpen={() => openOnly('st')}
        />

        {/* Source */}
        <MultiSelectChip
          label="Source"
          options={data?.availableSources ?? []}
          selected={sourceFilter}
          onToggle={v => toggleMulti(setSourceFilter, v)}
          onClear={() => setSourceFilter([])}
          isOpen={openChip === 'src'} onOpen={() => openOnly('src')}
        />

        {/* Meal plan — static placeholder (not in data source) */}
        <button type="button" style={{ ...chipBase, opacity: 0.6, cursor: 'default' }}>
          Meal plan: All <span style={{ opacity: 0.4, fontSize: 10 }}>▾</span>
        </button>

        {/* Reset */}
        {hasFilter && (
          <button type="button" onClick={resetAll} style={{
            padding: '5px 10px', fontSize: 12, fontFamily: 'inherit',
            border: 'none', background: 'transparent',
            color: 'var(--brass)', cursor: 'pointer',
            textDecoration: 'underline',
          }}>
            Reset Filters
          </button>
        )}
      </div>

      {/* Count + show-all */}
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
        {loading ? (
          <span style={{ fontSize: 13, color: 'var(--tbl-fg-mute)' }}>Loading…</span>
        ) : apiErr ? (
          <span style={{ fontSize: 13, color: 'var(--st-warn, #a8854a)' }}>Error: {apiErr}</span>
        ) : (
          <>
            <span style={{ fontSize: 18, fontWeight: 700, color: 'var(--tbl-fg)' }}>
              {filtered.length.toLocaleString()} reservations
            </span>
            {!showAll && filtered.length > PAGE && (
              <button type="button" onClick={() => setShowAll(true)} style={{
                fontSize: 12, color: 'var(--brass)', background: 'none', border: 'none',
                cursor: 'pointer', fontFamily: 'inherit', textDecoration: 'underline', padding: 0,
              }}>
                Show all {filtered.length.toLocaleString()}
              </button>
            )}
            {showAll && filtered.length > PAGE && (
              <button type="button" onClick={() => setShowAll(false)} style={{
                fontSize: 12, color: 'var(--brass)', background: 'none', border: 'none',
                cursor: 'pointer', fontFamily: 'inherit', textDecoration: 'underline', padding: 0,
              }}>
                Collapse to {PAGE}
              </button>
            )}
          </>
        )}
      </div>

      {/* Table */}
      {!loading && !apiErr && (
        filtered.length === 0 ? (
          <div style={{
            padding: '40px 16px', textAlign: 'center',
            fontSize: 14, color: 'var(--tbl-fg-mute)',
            border: '1px solid var(--tbl-border)', borderRadius: 6,
          }}>
            No reservations match the current filters.
          </div>
        ) : (
          <div style={{ overflowX: 'auto', maxHeight: '68vh', border: '1px solid var(--tbl-border)', borderRadius: 6 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', background: 'var(--tbl-bg)' }}>
              <thead>
                <tr>
                  <th style={thBase}>Reservation</th>
                  <th style={thBase}>Name</th>
                  <th style={thSort} onClick={() => toggleSort('surname')}>
                    Surname{sortArrow('surname')}
                  </th>
                  <th style={thSort} onClick={() => toggleSort('booking_date')}>
                    Date Booked{sortArrow('booking_date')}
                  </th>
                  <th style={thBase}>Room#(S)</th>
                  <th style={thBase}>Room Type</th>
                  <th style={thBase}>Check In</th>
                  <th style={thBase}>Check Out</th>
                  <th style={thBase}>Status</th>
                  <th style={thBase}>Source</th>
                </tr>
              </thead>
              <tbody>
                {displayed.map((r, idx) => (
                  <tr key={r.reservation_id} style={{
                    background: idx % 2 === 1 ? 'rgba(0,0,0,0.015)' : 'transparent',
                  }}>
                    <td style={{ ...td, fontFamily: 'ui-monospace, monospace', fontSize: 11, color: 'var(--tbl-fg-mute)' }}>
                      {r.reservation_id}
                    </td>
                    <td style={td}>{r.guest_first_name ?? EM}</td>
                    <td style={{ ...td, fontWeight: 500 }}>{r.guest_last_name ?? EM}</td>
                    <td style={td}>{fmtDate(r.booking_date)}</td>
                    <td style={td}>{r.room_numbers ?? EM}</td>
                    <td style={{ ...td, color: 'var(--tbl-fg-mute)', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {r.room_type_name ?? EM}
                    </td>
                    <td style={td}>{fmtDate(r.check_in_date)}</td>
                    <td style={td}>{fmtDate(r.check_out_date)}</td>
                    <td style={{ ...td, padding: '6px 14px' }}>
                      {(() => { const b = statusBadge(r.status, r.is_cancelled); return <span style={b.style}>{b.label}</span>; })()}
                    </td>
                    <td style={{ ...td, color: 'var(--tbl-fg-mute)', maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {r.source_name ?? EM}
                    </td>
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
