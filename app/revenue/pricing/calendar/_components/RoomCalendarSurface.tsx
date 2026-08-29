'use client';

// app/revenue/pricing/calendar/_components/RoomCalendarSurface.tsx
// Cloudbeds-style room-level booking calendar. Sticky left column (room labels)
// + sticky top row (date headers) inside a single scroll container, so both
// axes scroll independently without JS sync.

import { useEffect, useState, useMemo, useCallback } from 'react';

// ─── layout constants ──────────────────────────────────────────────────────
const DAY_W  = 46;   // px per day column
const ROW_H  = 40;   // px per room row
const TYPE_H = 32;   // px per room-type header row
const LEFT_W = 210;  // px for the sticky left label column
const HDR_H  = 52;   // px for the date header row
const DAYS   = 28;   // visible window length

// ─── types ─────────────────────────────────────────────────────────────────
interface RoomType { id: number; name: string; rooms: string[] }
interface Booking {
  reservation_id: string;
  room_id: string;
  room_type_id: number;
  guest_name: string;
  check_in_date: string;   // YYYY-MM-DD
  check_out_date: string;
  status: string;
  source_name: string | null;
}
interface CalendarData { roomTypes: RoomType[]; bookings: Booking[]; from: string; to: string }
interface BlockGeo { left: number; width: number; clippedLeft: boolean }

// ─── helpers ───────────────────────────────────────────────────────────────
function addDays(d: Date, n: number): Date {
  const r = new Date(d); r.setUTCDate(r.getUTCDate() + n); return r;
}
function toISO(d: Date): string { return d.toISOString().slice(0, 10); }

function statusStyle(status: string): { bg: string; text: string } {
  if (status === 'checked_in')  return { bg: 'rgba(107, 147, 121, 0.3)', text: 'var(--st-good)' };
  if (status === 'confirmed')   return { bg: 'rgba(90, 131, 168, 0.3)',  text: 'var(--st-info)' };
  if (status === 'checked_out') return { bg: 'var(--tbl-bg-elev)',        text: 'var(--tbl-fg-mute)' };
  return { bg: 'rgba(168, 133, 74, 0.3)', text: 'var(--brass)' };
}

function sourceTag(src: string | null): string {
  if (!src) return '';
  const s = src.toLowerCase();
  if (s.includes('booking')) return ' · BDC';
  if (s.includes('expedia')) return ' · Exp';
  if (s.includes('direct'))  return ' · Dir';
  return '';
}

function roomLabel(roomId: string, typeId: number): string {
  const suffix = roomId.replace(`${typeId}-`, '');
  const n = parseInt(suffix, 10);
  return isNaN(n) ? roomId.slice(-5) : `Room ${n + 1}`;
}

// ─── button styles (module-scope to avoid RSC-nested-component crash) ───────
const NAV_BTN: React.CSSProperties = {
  padding: '5px 10px', background: 'transparent', color: 'var(--tbl-fg-mute)',
  border: '1px solid var(--tbl-border)', borderRadius: 4,
  fontFamily: 'ui-monospace, monospace', fontSize: 11,
  cursor: 'pointer', lineHeight: 1,
};

const TODAY_BTN: React.CSSProperties = {
  padding: '5px 12px', background: 'var(--st-warn)', color: 'var(--tbl-bg)',
  border: 'none', borderRadius: 4, fontFamily: 'ui-monospace, monospace',
  fontSize: 11, fontWeight: 700, letterSpacing: '0.08em',
  textTransform: 'uppercase', cursor: 'pointer',
};

// ─── component ─────────────────────────────────────────────────────────────
export default function RoomCalendarSurface({ propertyId }: { propertyId: number }) {
  const [winStart, setWinStart] = useState<Date>(() => {
    const d = new Date();
    d.setUTCHours(0, 0, 0, 0);
    d.setUTCDate(d.getUTCDate() - 3);
    return d;
  });
  const [data,    setData]    = useState<CalendarData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);

  const winFrom = useMemo(() => toISO(winStart), [winStart]);
  const winTo   = useMemo(() => toISO(addDays(winStart, DAYS - 1)), [winStart]);

  useEffect(() => {
    if (!propertyId) return;
    setLoading(true); setError(null);
    fetch(`/api/rooms/calendar?pid=${propertyId}&from=${winFrom}&to=${winTo}`)
      .then((r) => r.ok ? r.json() : Promise.reject(r.statusText))
      .then((d: CalendarData) => { setData(d); setLoading(false); })
      .catch((e) => { setError(String(e)); setLoading(false); });
  }, [propertyId, winFrom, winTo]);

  const goToToday = useCallback(() => {
    const d = new Date(); d.setUTCHours(0, 0, 0, 0); d.setUTCDate(d.getUTCDate() - 3);
    setWinStart(d);
  }, []);

  const goPrevMonth = useCallback(() => {
    setWinStart(prev => {
      const d = new Date(Date.UTC(prev.getUTCFullYear(), prev.getUTCMonth() - 1, 1));
      return d;
    });
  }, []);

  const goNextMonth = useCallback(() => {
    setWinStart(prev => {
      const d = new Date(Date.UTC(prev.getUTCFullYear(), prev.getUTCMonth() + 1, 1));
      return d;
    });
  }, []);

  const dates = useMemo(() => Array.from({ length: DAYS }, (_, i) => addDays(winStart, i)), [winStart]);
  const todayISO = useMemo(() => toISO(new Date()), []);

  const bookingsByRoom = useMemo(() => {
    const m = new Map<string, Booking[]>();
    for (const b of data?.bookings ?? []) {
      if (!m.has(b.room_id)) m.set(b.room_id, []);
      m.get(b.room_id)!.push(b);
    }
    return m;
  }, [data]);

  function blockGeo(b: Booking): BlockGeo | null {
    const winMs   = winStart.getTime();
    const checkIn = new Date(b.check_in_date  + 'T00:00:00Z').getTime();
    const checkOut= new Date(b.check_out_date + 'T00:00:00Z').getTime();
    const leftDay  = (checkIn  - winMs) / 86400000;
    const rightDay = (checkOut - winMs) / 86400000;
    const cLeft    = Math.max(0, leftDay);
    const cRight   = Math.min(DAYS, rightDay);
    if (cRight <= 0 || cLeft >= DAYS || cRight <= cLeft) return null;
    return {
      left:        cLeft  * DAY_W + 1,
      width:       (cRight - cLeft) * DAY_W - 3,
      clippedLeft: leftDay < 0,
    };
  }

  const totalWidth = LEFT_W + DAYS * DAY_W;
  const totalRooms = data?.roomTypes.reduce((s, t) => s + t.rooms.length, 0) ?? 0;

  // ── month label for nav bar ───────────────────────────────────────────────
  const navMonthLabel = useMemo(
    () => winStart.toLocaleString('en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' }),
    [winStart],
  );

  if (!propertyId) {
    return (
      <div style={{ padding: 32, color: 'var(--tbl-fg-mute)', fontStyle: 'italic', textAlign: 'center' }}>
        Navigate via /h/[property_id]/revenue/pricing/calendar to load the room calendar.
      </div>
    );
  }

  return (
    <div>
      {/* ── toolbar ── */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '10px 0 12px', borderBottom: '1px solid var(--tbl-border)',
        flexWrap: 'wrap',
      }}>
        <button onClick={goToToday} style={TODAY_BTN}>Today</button>
        <button onClick={goPrevMonth} style={NAV_BTN}>←</button>
        <span style={{
          fontFamily: 'ui-monospace, monospace', fontSize: 13,
          color: 'var(--brass)', fontWeight: 700,
        }}>
          {navMonthLabel}
        </span>
        <button onClick={goNextMonth} style={NAV_BTN}>→</button>
        <span style={{ flex: 1 }} />
        {loading && (
          <span style={{ color: 'var(--tbl-fg-mute)', fontSize: 11 }}>Loading…</span>
        )}
        {error && (
          <span style={{ color: 'var(--st-warn)', fontSize: 11 }}>{error}</span>
        )}
        <span style={{ fontFamily: 'ui-monospace, monospace', fontSize: 10, color: 'var(--tbl-fg-mute)' }}>
          {totalRooms} rooms · {data?.bookings.length ?? 0} bookings
        </span>
      </div>

      {/* ── grid ── */}
      <div style={{
        overflowX: 'auto', overflowY: 'auto',
        maxHeight: 'calc(100vh - 280px)',
        border: '1px solid var(--tbl-border)', borderRadius: 4,
        marginTop: 10,
        position: 'relative',
      }}>
        <div style={{ minWidth: totalWidth }}>

          {/* date header — sticky top */}
          <div style={{
            display: 'flex', position: 'sticky', top: 0, zIndex: 20,
            background: 'var(--tbl-bg)', borderBottom: '2px solid var(--tbl-border)',
          }}>
            {/* corner cell — sticky left AND top */}
            <div style={{
              width: LEFT_W, flexShrink: 0, height: HDR_H,
              position: 'sticky', left: 0, zIndex: 30,
              background: 'var(--tbl-bg)', borderRight: '1px solid var(--tbl-border)',
              display: 'flex', alignItems: 'flex-end', paddingLeft: 14, paddingBottom: 8,
            }}>
              <span style={{
                fontFamily: 'ui-monospace, monospace', fontSize: 10,
                color: 'var(--tbl-fg-mute)', letterSpacing: '0.12em', textTransform: 'uppercase',
              }}>
                Room
              </span>
            </div>

            {/* date columns */}
            {dates.map((d) => {
              const iso            = toISO(d);
              const isToday        = iso === todayISO;
              const dow            = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'][d.getUTCDay()];
              const dayNum         = d.getUTCDate();
              const isFirstOfMonth = dayNum === 1;
              const isWeekend      = d.getUTCDay() === 0 || d.getUTCDay() === 6;
              return (
                <div key={iso} style={{
                  width: DAY_W, flexShrink: 0, height: HDR_H,
                  borderRight: '1px solid var(--tbl-border)',
                  background: isToday
                    ? 'rgba(212, 168, 102, 0.10)'
                    : isWeekend ? 'rgba(0, 0, 0, 0.06)' : 'transparent',
                  display: 'flex', flexDirection: 'column',
                  alignItems: 'center', justifyContent: 'center', gap: 3,
                }}>
                  <span style={{
                    fontFamily: 'ui-monospace, monospace', fontSize: 9,
                    color: isToday ? 'var(--brass)' : 'var(--tbl-fg-mute)',
                    textTransform: 'uppercase', letterSpacing: '0.10em',
                  }}>{dow}</span>
                  <span style={{
                    fontFamily: 'ui-monospace, monospace',
                    fontSize: isFirstOfMonth ? 10 : 13,
                    fontWeight: isToday ? 800 : 500,
                    color: isToday ? 'var(--brass)' : 'var(--tbl-fg-mute)',
                    lineHeight: 1,
                  }}>
                    {isFirstOfMonth
                      ? d.toLocaleString('en-GB', { month: 'short', timeZone: 'UTC' })
                      : dayNum}
                  </span>
                  {isFirstOfMonth && (
                    <span style={{
                      fontFamily: 'ui-monospace, monospace', fontSize: 13,
                      fontWeight: 500, color: 'var(--tbl-fg-mute)', lineHeight: 1,
                    }}>
                      {dayNum}
                    </span>
                  )}
                </div>
              );
            })}
          </div>

          {/* ── room type groups ── */}
          {(data?.roomTypes ?? []).map((type) => (
            <div key={type.id}>

              {/* type header */}
              <div style={{ display: 'flex', borderBottom: '1px solid var(--tbl-border)' }}>
                <div style={{
                  width: LEFT_W, flexShrink: 0, height: TYPE_H,
                  position: 'sticky', left: 0, zIndex: 10,
                  background: 'var(--tbl-bg)', borderRight: '1px solid var(--tbl-border)',
                  display: 'flex', alignItems: 'center', paddingLeft: 14, gap: 8,
                }}>
                  <span style={{
                    fontFamily: 'ui-monospace, monospace', fontSize: 11,
                    fontWeight: 700, color: 'var(--brass)', letterSpacing: '0.05em',
                  }}>
                    {type.name}
                  </span>
                  <span style={{
                    fontFamily: 'ui-monospace, monospace', fontSize: 10,
                    color: 'var(--tbl-fg-mute)', background: 'var(--tbl-bg-elev)',
                    borderRadius: 3, padding: '1px 5px',
                  }}>
                    {type.rooms.length}
                  </span>
                </div>
                <div style={{ flex: 1, height: TYPE_H, background: 'var(--tbl-bg)' }} />
              </div>

              {/* individual room rows */}
              {type.rooms.map((roomId) => {
                const roomBookings = bookingsByRoom.get(roomId) ?? [];
                return (
                  <div key={roomId} style={{ display: 'flex', borderBottom: '1px solid var(--tbl-border)' }}>

                    {/* room label — sticky left */}
                    <div style={{
                      width: LEFT_W, flexShrink: 0, height: ROW_H,
                      position: 'sticky', left: 0, zIndex: 5,
                      background: 'var(--tbl-bg)', borderRight: '1px solid var(--tbl-border)',
                      display: 'flex', alignItems: 'center', paddingLeft: 22, gap: 7,
                    }}>
                      <span style={{
                        width: 5, height: 5, borderRadius: '50%',
                        background: 'var(--tbl-border-strong)', flexShrink: 0,
                      }} />
                      <span style={{
                        fontFamily: 'ui-monospace, monospace', fontSize: 11, color: 'var(--tbl-fg-mute)',
                      }}>
                        {roomLabel(roomId, type.id)}
                      </span>
                    </div>

                    {/* booking grid area */}
                    <div style={{ position: 'relative', flex: 1, height: ROW_H, overflow: 'hidden' }}>

                      {/* day column dividers + today tint */}
                      {dates.map((d, i) => {
                        const iso = toISO(d);
                        return (
                          <div key={iso} style={{
                            position: 'absolute', left: i * DAY_W, top: 0,
                            width: DAY_W, height: ROW_H,
                            borderRight: '1px solid var(--tbl-border)',
                            background: iso === todayISO ? 'rgba(168,133,74,0.05)' : 'transparent',
                            pointerEvents: 'none',
                          }} />
                        );
                      })}

                      {/* booking blocks */}
                      {roomBookings.map((b) => {
                        const geo = blockGeo(b);
                        if (!geo || geo.width < 4) return null;
                        const { bg, text } = statusStyle(b.status);
                        return (
                          <div
                            key={`${b.reservation_id}`}
                            title={`${b.guest_name} · ${b.check_in_date} → ${b.check_out_date} · ${b.status}${b.source_name ? ` · ${b.source_name}` : ''}`}
                            style={{
                              position: 'absolute',
                              left: geo.left, top: 5,
                              width: geo.width, height: ROW_H - 10,
                              background: bg, borderRadius: 3,
                              borderLeft: geo.clippedLeft ? `3px solid ${text}` : 'none',
                              display: 'flex', alignItems: 'center',
                              paddingLeft: geo.clippedLeft ? 4 : 7,
                              overflow: 'hidden', zIndex: 2,
                            }}
                          >
                            <span style={{
                              fontFamily: 'ui-monospace, monospace',
                              fontSize: 10, color: text, fontWeight: 600,
                              whiteSpace: 'nowrap', overflow: 'hidden',
                              textOverflow: 'ellipsis',
                            }}>
                              {b.guest_name}{sourceTag(b.source_name)}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          ))}

          {/* empty state */}
          {!loading && (!data || data.roomTypes.length === 0) && (
            <div style={{
              padding: 40, color: 'var(--tbl-fg-mute)', textAlign: 'center',
              fontFamily: 'ui-monospace, monospace', fontSize: 12, fontStyle: 'italic',
            }}>
              No room data found for this window.
            </div>
          )}

        </div>
      </div>

      {/* ── legend ── */}
      <div style={{ display: 'flex', gap: 18, marginTop: 10, flexWrap: 'wrap', alignItems: 'center' }}>
        {(
          [
            { status: 'confirmed',   label: 'Confirmed' },
            { status: 'checked_in',  label: 'In-house' },
            { status: 'checked_out', label: 'Checked out' },
          ] as const
        ).map(({ status, label }) => {
          const { bg, text } = statusStyle(status);
          return (
            <span key={status} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{
                width: 18, height: 10, borderRadius: 2, background: bg,
                display: 'inline-block', flexShrink: 0,
              }} />
              <span style={{ fontFamily: 'ui-monospace, monospace', fontSize: 10, color: 'var(--tbl-fg-mute)' }}>
                {label}
              </span>
            </span>
          );
        })}
        <span style={{
          fontFamily: 'ui-monospace, monospace', fontSize: 10,
          color: 'var(--tbl-fg-mute)', marginLeft: 'auto',
        }}>
          Source: pms.reservation_rooms_cb + pms.reservations_cb
        </span>
      </div>
    </div>
  );
}
