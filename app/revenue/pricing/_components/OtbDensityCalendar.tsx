'use client';
// app/revenue/pricing/_components/OtbDensityCalendar.tsx
// 2026-08-24: Client-side wrapper for the OTB Density month calendar.
// Accepts serialized day data from the RSC, renders the calendar grid
// with click-to-detail: clicking a day fetches booked reservations from
// v_reservations_full and shows them in a right-side drawer.
//
// Colour tokens: --status-green-tint / --status-amber-tint / --status-grey-tint
// (matching the server-rendered OtbDensityMonth palette).

import { useState, useCallback } from 'react';
import { createClient } from '@supabase/supabase-js';

// ── Types ──────────────────────────────────────────────────────────────────

export interface OtbDayData {
  iso: string;
  dayNum: number;
  rooms_sold: number | null;
  rooms_available: number | null;
  occupancy_pct: number | null;
  rooms_revenue: number | null;
  adr: number | null;
  /** 'green' | 'amber' | 'grey' | 'empty' */
  bucket: 'green' | 'amber' | 'grey' | 'empty';
  isToday: boolean;
  tooltip: string;
}

interface ResRow {
  reservation_id: string;
  guest_name: string | null;
  room_numbers: string | null;
  room_type_name: string | null;
  check_in_date: string;
  check_out_date: string;
  nights: number | null;
  status: string | null;
}

interface Props {
  year: number;
  month: number;
  days: OtbDayData[];
  currencySym: '€' | '$';
  propertyId: number;
  /** First day-of-week offset (Mon=0) for the month */
  firstDow: number;
  /** Number of calendar cells (pad + day cells, rounded up to full weeks) */
  totalCells: number;
}

// ── Colour helpers (mirrored from server OtbDensityMonth) ──────────────────

function bg(bucket: OtbDayData['bucket']): string {
  switch (bucket) {
    case 'green': return 'var(--status-green-tint, rgba(31, 122, 91, 0.16))';
    case 'amber': return 'var(--status-amber-tint, rgba(196, 160, 107, 0.18))';
    case 'grey':  return 'var(--status-grey-tint, rgba(90, 90, 90, 0.10))';
    default:      return 'var(--paper, #FFFFFF)';
  }
}
function borderColor(bucket: OtbDayData['bucket']): string {
  switch (bucket) {
    case 'green': return 'var(--status-green, #1F7A5B)';
    case 'amber': return 'var(--status-amber, #C4A06B)';
    case 'grey':  return 'var(--hairline, #E6DFCC)';
    default:      return 'var(--hairline, #E6DFCC)';
  }
}
function accentColor(bucket: OtbDayData['bucket']): string {
  switch (bucket) {
    case 'green': return 'var(--status-green, #1F7A5B)';
    case 'amber': return 'var(--status-amber, #C4A06B)';
    default:      return 'var(--ink-soft, #5A5A5A)';
  }
}

// ── Day-detail drawer ──────────────────────────────────────────────────────

function fmtMoney(n: number, sym: string): string {
  return `${sym}${Math.round(n).toLocaleString('en-US')}`;
}

function DrawerHeader({ date, onClose }: { date: string; onClose: () => void }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '14px 16px', borderBottom: '1px solid var(--hairline, #E6DFCC)',
      position: 'sticky', top: 0, background: 'var(--paper, #FFFFFF)', zIndex: 1,
    }}>
      <div>
        <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--ink-soft, #5A5A5A)', marginBottom: 3 }}>
          Reservations on
        </div>
        <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--ink, #1B1B1B)', fontVariantNumeric: 'tabular-nums' }}>
          {date}
        </div>
      </div>
      <button
        type="button"
        onClick={onClose}
        aria-label="Close"
        style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 20, color: 'var(--ink-soft, #5A5A5A)', padding: '4px 8px', lineHeight: 1 }}
      >
        ×
      </button>
    </div>
  );
}

function statusPill(status: string | null): React.CSSProperties {
  const s = (status ?? '').toLowerCase();
  const isCancel = s === 'cancelled' || s === 'no_show';
  const isActive = s === 'checked_in' || s === 'in_house';
  return {
    display: 'inline-block', padding: '2px 7px', fontSize: 10, fontWeight: 700,
    borderRadius: 3, textTransform: 'uppercase', letterSpacing: '0.06em',
    background: isCancel ? '#FBEAEA' : isActive ? '#E8F2E4' : 'rgba(0,0,0,0.06)',
    color: isCancel ? '#B04A2F' : isActive ? '#1F5C2C' : 'var(--ink, #1B1B1B)',
  };
}

function ReservationCard({ r }: { r: ResRow }) {
  const nights = r.nights ?? '—';
  return (
    <div style={{
      padding: '12px 14px', borderBottom: '1px solid var(--hairline, #E6DFCC)',
      display: 'flex', flexDirection: 'column', gap: 5,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink, #1B1B1B)' }}>
            {r.guest_name ?? '—'}
          </div>
          <div style={{ fontSize: 11, color: 'var(--ink-soft, #5A5A5A)', marginTop: 2, fontVariantNumeric: 'tabular-nums' }}>
            #{r.reservation_id}
          </div>
        </div>
        <span style={statusPill(r.status)}>{r.status ?? '—'}</span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 12px', fontSize: 11, color: 'var(--ink-soft, #5A5A5A)', marginTop: 2 }}>
        <span><strong style={{ color: 'var(--ink, #1B1B1B)' }}>Room:</strong> {r.room_numbers ?? '—'}</span>
        <span><strong style={{ color: 'var(--ink, #1B1B1B)' }}>Type:</strong> {r.room_type_name ?? '—'}</span>
        <span><strong style={{ color: 'var(--ink, #1B1B1B)' }}>Check-in:</strong> {r.check_in_date}</span>
        <span><strong style={{ color: 'var(--ink, #1B1B1B)' }}>Check-out:</strong> {r.check_out_date}</span>
        <span><strong style={{ color: 'var(--ink, #1B1B1B)' }}>Nights:</strong> {nights}</span>
      </div>
    </div>
  );
}

// ── Supabase client (uses public anon key — read-only public views) ─────────
// Keys are from env (injected at build time by Next.js NEXT_PUBLIC_* vars).
function getClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';
  return createClient(url, key);
}

// ── Main export ───────────────────────────────────────────────────────────

const WD_HEADERS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export default function OtbDensityCalendar({
  year, month, days, currencySym, propertyId, firstDow, totalCells,
}: Props) {
  const [selectedDate, setSelectedDate]     = useState<string | null>(null);
  const [sliderOpen, setSliderOpen]         = useState(false);
  const [reservations, setReservations]     = useState<ResRow[]>([]);
  const [loading, setLoading]               = useState(false);
  const [fetchError, setFetchError]         = useState<string | null>(null);

  const dayByIso = new Map(days.map((d) => [d.iso, d]));
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();

  const fetchReservations = useCallback(async (iso: string) => {
    setSelectedDate(iso);
    setSliderOpen(true);
    setReservations([]);
    setFetchError(null);
    setLoading(true);
    try {
      const sb = getClient();
      const { data, error } = await sb
        .from('v_reservations_full')
        .select('reservation_id, guest_name, room_numbers, room_type_name, check_in_date, check_out_date, nights, status')
        .eq('property_id', propertyId)
        .lte('check_in_date', iso)
        .gt('check_out_date', iso)
        .order('check_in_date');
      if (error) {
        setFetchError(error.message ?? 'Failed to load reservations');
      } else {
        setReservations((data ?? []) as ResRow[]);
      }
    } catch (err: unknown) {
      setFetchError(err instanceof Error ? err.message : 'Network error');
    } finally {
      setLoading(false);
    }
  }, [propertyId]);

  const closeSlider = () => {
    setSliderOpen(false);
    setSelectedDate(null);
  };

  // Build calendar cells
  const cells: React.ReactNode[] = [];

  // Weekday headers
  for (const wd of WD_HEADERS) {
    cells.push(
      <div key={`wd-${wd}`} style={{
        fontSize: 9, color: 'var(--ink-soft, #5A5A5A)', letterSpacing: '0.08em',
        textTransform: 'uppercase', textAlign: 'center', padding: '4px 0',
        fontWeight: 600,
      }}>{wd}</div>
    );
  }

  // Render totalCells (pad + day cells)
  for (let i = 0; i < totalCells - WD_HEADERS.length; i++) {
    const dayNum = i - firstDow + 1;
    const inMonth = dayNum >= 1 && dayNum <= daysInMonth;

    if (!inMonth) {
      cells.push(
        <div key={`pad-${i}`} style={{
          minHeight: 96, border: '1px solid var(--hairline, #E6DFCC)',
          borderRadius: 4, background: 'transparent', opacity: 0.35,
        }} />
      );
      continue;
    }

    const iso = `${year}-${String(month).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
    const d = dayByIso.get(iso);
    const bucket = d?.bucket ?? 'empty';
    const rs = d?.rooms_sold ?? null;
    const occ = d?.occupancy_pct ?? null;
    const rv = d?.rooms_revenue ?? null;
    const isToday = d?.isToday ?? false;
    const isSelected = selectedDate === iso;

    cells.push(
      <div
        key={iso}
        title={d?.tooltip ?? iso}
        onClick={() => fetchReservations(iso)}
        style={{
          position: 'relative',
          minHeight: 96,
          border: `1px solid ${isSelected ? 'var(--primary, #1F3A2E)' : borderColor(bucket)}`,
          borderLeft: isToday
            ? `3px solid var(--primary, #1F3A2E)`
            : isSelected
              ? `3px solid var(--primary, #1F3A2E)`
              : `1px solid ${borderColor(bucket)}`,
          borderRadius: 4,
          background: isSelected ? 'rgba(31, 58, 46, 0.06)' : bg(bucket),
          padding: '6px 8px',
          display: 'flex',
          flexDirection: 'column',
          gap: 2,
          fontVariantNumeric: 'tabular-nums',
          cursor: 'pointer',
          transition: 'box-shadow 0.12s',
        }}
        onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.boxShadow = '0 2px 8px rgba(0,0,0,0.10)'; }}
        onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.boxShadow = ''; }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
          <span style={{
            fontSize: 11, fontWeight: isToday ? 700 : 500,
            color: isToday ? 'var(--primary, #1F3A2E)' : 'var(--ink-soft, #5A5A5A)',
            letterSpacing: '0.02em',
          }}>{dayNum}</span>
          {occ != null && (
            <span style={{
              fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.06em',
              color: accentColor(bucket), fontWeight: 600,
            }}>{Math.round(occ)}%</span>
          )}
        </div>
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          justifyContent: 'center', flexGrow: 1, gap: 2,
        }}>
          <span style={{ fontSize: 22, fontWeight: 700, lineHeight: 1, color: 'var(--ink, #1B1B1B)' }}>
            {rs != null ? rs : '—'}
          </span>
          {rv != null && rv > 0 ? (
            <span style={{ fontSize: 10, color: 'var(--ink-soft, #5A5A5A)', letterSpacing: '0.02em' }}>
              {currencySym}{Math.round(rv).toLocaleString('en-US')}
            </span>
          ) : (
            <span style={{ fontSize: 10, color: 'var(--ink-soft, #5A5A5A)', opacity: 0.4 }}>·</span>
          )}
        </div>
      </div>
    );
  }

  return (
    <>
      {/* Drawer + overlay */}
      {sliderOpen && (
        <>
          <div
            onClick={closeSlider}
            style={{
              position: 'fixed', inset: 0,
              background: 'rgba(0,0,0,0.32)',
              zIndex: 999,
            }}
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-label={`Reservations on ${selectedDate}`}
            style={{
              position: 'fixed', top: 0, right: 0,
              height: '100vh', width: 400,
              background: 'var(--paper, #FFFFFF)',
              borderLeft: '1px solid var(--hairline, #E6DFCC)',
              boxShadow: '-4px 0 24px rgba(0,0,0,0.12)',
              zIndex: 1000,
              display: 'flex', flexDirection: 'column',
              overflowY: 'auto',
            }}
          >
            {selectedDate && (
              <DrawerHeader date={selectedDate} onClose={closeSlider} />
            )}
            <div style={{ flex: 1 }}>
              {loading && (
                <div style={{ padding: 24, fontSize: 13, color: 'var(--ink-soft, #5A5A5A)', textAlign: 'center' }}>
                  Loading…
                </div>
              )}
              {fetchError && (
                <div style={{ padding: 24, fontSize: 12, color: '#B04A2F' }}>
                  Error: {fetchError}
                </div>
              )}
              {!loading && !fetchError && reservations.length === 0 && (
                <div style={{ padding: 24, fontSize: 13, color: 'var(--ink-soft, #5A5A5A)', fontStyle: 'italic', textAlign: 'center' }}>
                  No reservations in-house on this date.
                </div>
              )}
              {!loading && reservations.length > 0 && (
                <>
                  <div style={{ padding: '10px 16px 6px', fontSize: 11, color: 'var(--ink-soft, #5A5A5A)' }}>
                    {reservations.length} reservation{reservations.length !== 1 ? 's' : ''} in-house
                  </div>
                  {reservations.map((r) => (
                    <ReservationCard key={r.reservation_id} r={r} />
                  ))}
                </>
              )}
            </div>
          </div>
        </>
      )}

      {/* Calendar grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(7, minmax(0, 1fr))',
        gap: 6,
        background: 'var(--paper, #FFFFFF)',
      }}>
        {cells}
      </div>
    </>
  );
}
