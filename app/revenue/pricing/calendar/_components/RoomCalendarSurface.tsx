// app/revenue/pricing/calendar/_components/RoomCalendarSurface.tsx
// Server component — data injected by PricingPage (SSR avoids client-auth +
// PostgREST 1 000-row truncation bugs). Navigation uses ?otb_from= URL param.
// Design: warm dark palette matching the rest of the OTB Density page.

import type { RoomType, RoomBooking, DailyKpi } from '../_lib/roomCalendarData';

// ─── layout constants ──────────────────────────────────────────────────────
const DAY_W  = 46;
const ROW_H  = 40;
const TYPE_H = 30;
const LEFT_W = 200;
const HDR_H  = 72;
const DAYS   = 28;

// ─── palette — explicit light values so the calendar renders white everywhere.
// Never inherit --tbl-* here: those tokens resolve dark on Namkhan's property
// shell theme and this surface is also used under the bare /revenue page.
const C = {
  bg:           '#FAFAF7',
  bgElev:       '#F3F0EC',
  bgToday:      'rgba(8, 72, 56, 0.07)',
  bgWeekend:    'rgba(0,0,0,0.015)',
  border:       '#E6DFCC',
  borderStrong: '#C0B8A0',
  txt:          '#1B1B1B',
  mute:         '#6B6152',
  accent:       '#084838',
};

// ─── helpers ───────────────────────────────────────────────────────────────
function addDays(isoBase: string, n: number): string {
  const d = new Date(isoBase + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

function blockGeo(
  b: RoomBooking, from: string,
): { left: number; width: number; clippedLeft: boolean } | null {
  const winMs    = new Date(from + 'T00:00:00Z').getTime();
  const checkIn  = new Date(b.check_in_date  + 'T00:00:00Z').getTime();
  const checkOut = new Date(b.check_out_date + 'T00:00:00Z').getTime();
  const leftDay  = (checkIn  - winMs) / 86400000;
  const rightDay = (checkOut - winMs) / 86400000;
  const cLeft    = Math.max(0, leftDay);
  const cRight   = Math.min(DAYS, rightDay);
  if (cRight <= 0 || cLeft >= DAYS || cRight <= cLeft) return null;
  return { left: cLeft * DAY_W + 1, width: (cRight - cLeft) * DAY_W - 3, clippedLeft: leftDay < 0 };
}

function statusColor(status: string): { bg: string; text: string } {
  if (status === 'checked_in')  return { bg: 'rgba(31,122,91,0.16)',  text: '#1A6B4A' };
  if (status === 'confirmed')   return { bg: 'rgba(59,107,162,0.16)', text: '#2B5F99' };
  if (status === 'checked_out') return { bg: 'rgba(0,0,0,0.07)',      text: '#6B5A44' };
  return { bg: 'rgba(8,72,56,0.12)', text: '#084838' };
}

function sourceTag(src: string | null): string {
  if (!src) return '';
  const s = src.toLowerCase();
  if (s.includes('booking')) return ' · BDC';
  if (s.includes('expedia')) return ' · Exp';
  if (s.includes('direct'))  return ' · Dir';
  return '';
}

// ─── component ─────────────────────────────────────────────────────────────
interface Props {
  roomTypes: RoomType[];
  bookings:  RoomBooking[];
  from:      string;
  prevHref:  string;
  nextHref:  string;
  todayHref: string;
  dailyKpi:  Record<string, DailyKpi>;
}

export default function RoomCalendarSurface({ roomTypes, bookings, from, prevHref, nextHref, todayHref, dailyKpi }: Props) {
  const today     = new Date().toISOString().slice(0, 10);
  const dates     = Array.from({ length: DAYS }, (_, i) => addDays(from, i));
  const totalW    = LEFT_W + DAYS * DAY_W;
  const totalRooms = roomTypes.reduce((s, t) => s + t.rooms.length, 0);
  const navLabel  = new Date(from + 'T00:00:00Z')
    .toLocaleString('en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' });

  const bookingsByRoom = new Map<string, RoomBooking[]>();
  for (const b of bookings) {
    const key = b.room_id;
    if (!bookingsByRoom.has(key)) bookingsByRoom.set(key, []);
    bookingsByRoom.get(key)!.push(b);
  }

  return (
    <div>
      {/* ── toolbar ── */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '10px 0 12px', borderBottom: `1px solid ${C.border}`,
        flexWrap: 'wrap',
      }}>
        <a href={todayHref} style={{
          padding: '5px 12px', background: C.accent, color: 'var(--tbl-fg, #e9e1ce)',
          borderRadius: 4, fontFamily: 'ui-monospace, monospace',
          fontSize: 11, fontWeight: 700, letterSpacing: '0.08em',
          textTransform: 'uppercase', textDecoration: 'none', display: 'inline-block',
        }}>Today</a>
        <a href={prevHref} style={{
          padding: '5px 10px', background: 'transparent', color: C.mute,
          border: `1px solid ${C.border}`, borderRadius: 4,
          fontFamily: 'ui-monospace, monospace', fontSize: 11,
          textDecoration: 'none', display: 'inline-block',
        }}>←</a>
        <span style={{ fontFamily: 'ui-monospace, monospace', fontSize: 13, color: C.accent, fontWeight: 700 }}>
          {navLabel}
        </span>
        <a href={nextHref} style={{
          padding: '5px 10px', background: 'transparent', color: C.mute,
          border: `1px solid ${C.border}`, borderRadius: 4,
          fontFamily: 'ui-monospace, monospace', fontSize: 11,
          textDecoration: 'none', display: 'inline-block',
        }}>→</a>
        <span style={{ flex: 1 }} />
        <span style={{ fontFamily: 'ui-monospace, monospace', fontSize: 10, color: C.mute }}>
          {totalRooms} rooms · {bookings.length} bookings
        </span>
      </div>

      {/* ── scrollable calendar grid ── */}
      <div style={{
        overflowX: 'auto', overflowY: 'auto',
        maxHeight: 'calc(100vh - 300px)',
        border: `1px solid ${C.border}`, borderRadius: 4,
        marginTop: 10, background: C.bg, position: 'relative',
      }}>
        <div style={{ minWidth: totalW }}>

          {/* date header — sticky top */}
          <div style={{
            display: 'flex', position: 'sticky', top: 0, zIndex: 20,
            background: C.bg, borderBottom: `2px solid ${C.borderStrong}`,
          }}>
            {/* corner cell — sticky left AND top */}
            <div style={{
              width: LEFT_W, flexShrink: 0, height: HDR_H,
              position: 'sticky', left: 0, zIndex: 30,
              background: C.bg, borderRight: `1px solid ${C.border}`,
              display: 'flex', alignItems: 'flex-end', paddingLeft: 14, paddingBottom: 8,
            }}>
              <span style={{
                fontFamily: 'ui-monospace, monospace', fontSize: 10,
                color: C.mute, letterSpacing: '0.12em', textTransform: 'uppercase',
              }}>Room</span>
            </div>

            {/* date columns */}
            {dates.map((iso) => {
              const d         = new Date(iso + 'T00:00:00Z');
              const isToday   = iso === today;
              const dow       = ['Su','Mo','Tu','We','Th','Fr','Sa'][d.getUTCDay()];
              const dayNum    = d.getUTCDate();
              const isFirst   = dayNum === 1;
              const isWeekend = d.getUTCDay() === 0 || d.getUTCDay() === 6;
              const kpi       = dailyKpi[iso];
              return (
                <div key={iso} style={{
                  width: DAY_W, flexShrink: 0, height: HDR_H,
                  borderRight: `1px solid ${C.border}`,
                  background: isToday ? C.bgToday : isWeekend ? C.bgWeekend : 'transparent',
                  display: 'flex', flexDirection: 'column',
                  alignItems: 'center', justifyContent: 'center', gap: 2,
                }}>
                  <span style={{
                    fontFamily: 'ui-monospace, monospace', fontSize: 9,
                    color: isToday ? C.accent : C.mute,
                    textTransform: 'uppercase', letterSpacing: '0.10em',
                  }}>{dow}</span>
                  <span style={{
                    fontFamily: 'ui-monospace, monospace',
                    fontSize: isFirst ? 9 : 13,
                    fontWeight: isToday ? 800 : 500,
                    color: isToday ? C.accent : C.txt,
                    lineHeight: 1,
                  }}>
                    {isFirst
                      ? d.toLocaleString('en-GB', { month: 'short', timeZone: 'UTC' })
                      : dayNum}
                  </span>
                  {isFirst && (
                    <span style={{
                      fontFamily: 'ui-monospace, monospace', fontSize: 13,
                      fontWeight: 500, color: C.txt, lineHeight: 1,
                    }}>{dayNum}</span>
                  )}
                  <span style={{
                    fontFamily: 'ui-monospace, monospace', fontSize: 8,
                    color: isToday ? C.accent : C.mute,
                    letterSpacing: '0.03em', lineHeight: 1, minHeight: 10,
                  }}>
                    {kpi?.occ_pct != null ? `${Math.round(kpi.occ_pct)}%` : ''}
                  </span>
                  <span style={{
                    fontFamily: 'ui-monospace, monospace', fontSize: 8,
                    color: C.mute, letterSpacing: '0.03em', lineHeight: 1, minHeight: 10,
                  }}>
                    {kpi?.adr != null ? `$${Math.round(kpi.adr)}` : ''}
                  </span>
                </div>
              );
            })}
          </div>

          {/* ── room type groups ── */}
          {roomTypes.map((type) => (
            <div key={type.id}>
              {/* type header */}
              <div style={{ display: 'flex', borderBottom: `1px solid ${C.border}` }}>
                <div style={{
                  width: LEFT_W, flexShrink: 0, height: TYPE_H,
                  position: 'sticky', left: 0, zIndex: 10,
                  background: C.bgElev, borderRight: `1px solid ${C.border}`,
                  display: 'flex', alignItems: 'center', paddingLeft: 14, gap: 8,
                }}>
                  <span style={{
                    fontFamily: 'ui-monospace, monospace', fontSize: 10,
                    fontWeight: 700, color: C.accent, letterSpacing: '0.06em',
                    textTransform: 'uppercase',
                  }}>{type.name}</span>
                  <span style={{
                    fontFamily: 'ui-monospace, monospace', fontSize: 9,
                    color: C.mute, background: C.bg, borderRadius: 3, padding: '1px 5px',
                  }}>{type.rooms.length}</span>
                </div>
                <div style={{ flex: 1, height: TYPE_H, background: C.bgElev }} />
              </div>

              {/* individual room rows */}
              {type.rooms.map(({ id: roomId, name: roomName }) => {
                const roomBookings = bookingsByRoom.get(roomId) ?? [];
                return (
                  <div key={roomId} style={{ display: 'flex', borderBottom: `1px solid ${C.border}` }}>
                    {/* room label — sticky left */}
                    <div style={{
                      width: LEFT_W, flexShrink: 0, height: ROW_H,
                      position: 'sticky', left: 0, zIndex: 5,
                      background: C.bg, borderRight: `1px solid ${C.border}`,
                      display: 'flex', alignItems: 'center', paddingLeft: 22, gap: 7,
                    }}>
                      <span style={{ width: 5, height: 5, borderRadius: '50%', background: C.border, flexShrink: 0 }} />
                      <span style={{ fontFamily: 'ui-monospace, monospace', fontSize: 11, color: C.mute }}>
                        {roomName}
                      </span>
                    </div>

                    {/* booking grid area */}
                    <div style={{ position: 'relative', flex: 1, height: ROW_H, overflow: 'hidden' }}>
                      {/* day column dividers + today tint */}
                      {dates.map((iso, i) => (
                        <div key={iso} style={{
                          position: 'absolute', left: i * DAY_W, top: 0,
                          width: DAY_W, height: ROW_H,
                          borderRight: `1px solid ${C.border}`,
                          background: iso === today ? 'rgba(8,72,56,0.10)' : 'transparent',
                          pointerEvents: 'none',
                        }} />
                      ))}

                      {/* booking blocks */}
                      {roomBookings.map((b) => {
                        const geo = blockGeo(b, from);
                        if (!geo || geo.width < 4) return null;
                        const { bg, text } = statusColor(b.status);
                        return (
                          <div
                            key={`${b.reservation_id}:${b.room_id}`}
                            title={`${b.guest_name} · ${b.check_in_date} → ${b.check_out_date} · ${b.status}${b.source_name ? ` · ${b.source_name}` : ''}`}
                            style={{
                              position: 'absolute', left: geo.left, top: 5,
                              width: geo.width, height: ROW_H - 10,
                              background: bg, borderRadius: 3,
                              borderLeft: geo.clippedLeft
                                ? `3px solid ${text}`
                                : `1px solid ${text}33`,
                              display: 'flex', alignItems: 'center',
                              paddingLeft: geo.clippedLeft ? 5 : 7,
                              overflow: 'hidden', zIndex: 2,
                            }}
                          >
                            <span style={{
                              fontFamily: 'ui-monospace, monospace',
                              fontSize: 10, color: text, fontWeight: 600,
                              whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
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
          {roomTypes.length === 0 && (
            <div style={{
              padding: 48, color: C.mute, textAlign: 'center',
              fontFamily: 'ui-monospace, monospace', fontSize: 12, fontStyle: 'italic',
            }}>
              No room data found for this property and window.
            </div>
          )}
        </div>
      </div>

      {/* ── legend ── */}
      <div style={{ display: 'flex', gap: 18, marginTop: 10, flexWrap: 'wrap', alignItems: 'center' }}>
        {([
          { status: 'confirmed',   label: 'Confirmed' },
          { status: 'checked_in',  label: 'In-house' },
          { status: 'checked_out', label: 'Checked out' },
        ] as const).map(({ status, label }) => {
          const { bg, text } = statusColor(status);
          return (
            <span key={status} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{
                width: 18, height: 10, borderRadius: 2,
                background: bg, border: `1px solid ${text}44`,
                display: 'inline-block', flexShrink: 0,
              }} />
              <span style={{ fontFamily: 'ui-monospace, monospace', fontSize: 10, color: C.mute }}>
                {label}
              </span>
            </span>
          );
        })}
        <span style={{
          fontFamily: 'ui-monospace, monospace', fontSize: 10,
          color: C.mute, marginLeft: 'auto',
        }}>
          Source: reservation_rooms + reservations (public views)
        </span>
      </div>
    </div>
  );
}
