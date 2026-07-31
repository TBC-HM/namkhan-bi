// app/operations/spa/_shared/ScheduleView.tsx
// Spa module v1 — booking/schedule surface: day nav, daily analytics container,
// therapist × hour slot grid with room labels, full booking list.
// Server component; rendered by /operations/spa/schedule and the /h/[pid] wrapper.

import TenantLink from '@/components/nav/TenantLink';
import { DashboardPage, Container, KpiTile, type KpiTileProps, type DashboardTab } from '@/app/(cockpit)/_design';
import { OPERATIONS_SUBPAGES } from '@/app/operations/_subpages';
import { TOKENS, MONO } from '@/app/holding/it/cockpit/_components/tokens';
import SpaSubnav from './SpaSubnav';
import BridgeNotice from './BridgeNotice';
import BookingForm from './BookingForm';
import StatusActions from './StatusActions';
import NotifyActions from './NotifyActions';
import {
  getSpaBookingsForDay, getSpaTherapists, getSpaRooms, getSpaCatalogue,
  localTimeStr, localHour, todayIsoAtProperty,
  type SpaBookingRow,
} from './data';

const DAY_START = 8;   // 08:00 local
const DAY_END = 20;    // last slot row 19:00–20:00
const SHIFT_HOURS = DAY_END - DAY_START;

const STATUS_COLOR: Record<string, string> = {
  booked: TOKENS.sand,
  confirmed: TOKENS.forest,
  arrived: TOKENS.forest,
  in_treatment: TOKENS.forest,
  completed: TOKENS.inkSoft,
  cancelled: TOKENS.terracotta,
  no_show: TOKENS.terracotta,
};

const fmtMoney = (n: number | null, ccy: string | null) =>
  n == null ? '—' : `${ccy === 'EUR' ? '€' : ccy === 'LAK' ? '₭' : '$'}${Math.round(Number(n)).toLocaleString('en-US')}`;

function shiftDay(dayIso: string, delta: number): string {
  const d = new Date(`${dayIso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + delta);
  return d.toISOString().slice(0, 10);
}

export default async function ScheduleView({
  propertyId, searchParams,
}: { propertyId: number; searchParams: Record<string, string | string[] | undefined> }) {
  const todayIso = todayIsoAtProperty(propertyId);
  const dRaw = typeof searchParams.d === 'string' ? searchParams.d : todayIso;
  const dayIso = /^\d{4}-\d{2}-\d{2}$/.test(dRaw) ? dRaw : todayIso;

  const [bookingsB, therapistsB, roomsB, catalogue] = await Promise.all([
    getSpaBookingsForDay(propertyId, dayIso),
    getSpaTherapists(propertyId),
    getSpaRooms(propertyId),
    getSpaCatalogue(propertyId),
  ]);

  const bridgeMissing = bookingsB.bridgeMissing;
  const bookings = bookingsB.rows;
  const activeBookings = bookings.filter((b) => !['cancelled', 'no_show'].includes(b.status));

  // ── daily spa analytics container ────────────────────────────────────
  const expectedRev = activeBookings.reduce((s, b) => s + Number(b.price ?? 0), 0);
  const completed = bookings.filter((b) => b.status === 'completed').length;
  const bookedMin = activeBookings.reduce((s, b) => s + Number(b.duration_min ?? 60), 0);
  const therapistIds = new Set(activeBookings.map((b) => b.therapist_id).filter(Boolean));
  const therapistCount = therapistsB.rows.length > 0 ? therapistsB.rows.length : therapistIds.size;
  const capacityMin = therapistCount * SHIFT_HOURS * 60;
  const utilPct = capacityMin > 0 ? (bookedMin / capacityMin) * 100 : 0;
  const roomsUsed = new Set(activeBookings.map((b) => b.room_name).filter(Boolean)).size;

  const currency = activeBookings.find((b) => b.currency)?.currency ?? (propertyId === 1000001 ? 'EUR' : 'USD');
  const kpis: KpiTileProps[] = [
    { label: 'Bookings', value: String(activeBookings.length), footnote: `${bookings.length} incl. cancelled/no-show`, status: activeBookings.length > 0 ? 'green' : 'grey', size: 'sm' },
    { label: 'Expected revenue', value: fmtMoney(expectedRev, currency), footnote: 'sum of booked prices', status: expectedRev > 0 ? 'green' : 'grey', size: 'sm' },
    { label: 'Completed', value: String(completed), footnote: 'delivered today', status: 'grey', size: 'sm' },
    { label: 'Booked hours', value: (bookedMin / 60).toFixed(1), footnote: `across ${therapistIds.size} therapist(s)`, status: 'grey', size: 'sm' },
    { label: 'Utilisation', value: `${utilPct.toFixed(0)}%`, footnote: `${therapistCount} therapists × ${SHIFT_HOURS}h capacity`, status: utilPct >= 50 ? 'green' : 'grey', size: 'sm' },
    { label: 'Rooms in use', value: String(roomsUsed), footnote: roomsB.bridgeMissing ? 'rooms table proposed' : `${roomsB.rows.length} configured`, status: 'grey', size: 'sm' },
  ];

  // ── therapist × hour grid ────────────────────────────────────────────
  const columns: Array<{ id: string; name: string }> = therapistsB.rows.map((t) => ({ id: t.therapist_id, name: t.display_name }));
  for (const id of Array.from(therapistIds)) {
    if (id && !columns.some((c) => c.id === id)) {
      const b = activeBookings.find((x) => x.therapist_id === id);
      columns.push({ id: String(id), name: b?.therapist_name ?? 'Therapist' });
    }
  }
  const hasUnassigned = activeBookings.some((b) => !b.therapist_id);
  if (hasUnassigned || columns.length === 0) columns.push({ id: '__unassigned', name: 'Unassigned' });

  const cellFor = (colId: string, hour: number): SpaBookingRow[] =>
    activeBookings.filter((b) => {
      const bCol = b.therapist_id ?? '__unassigned';
      return bCol === colId && localHour(b.scheduled_at, propertyId) === hour;
    });

  const dayNav = (
    <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
      {([
        { label: '← Prev', d: shiftDay(dayIso, -1) },
        { label: 'Today', d: todayIso },
        { label: 'Next →', d: shiftDay(dayIso, 1) },
      ] as const).map((p) => (
        <TenantLink key={p.label} href={`/operations/spa/schedule?d=${p.d}`} style={{
          padding: '6px 12px', fontFamily: MONO, fontSize: 11, letterSpacing: '0.04em',
          textTransform: 'uppercase', textDecoration: 'none', borderRadius: 4,
          border: `1px solid ${TOKENS.border}`,
          color: p.d === dayIso && p.label !== 'Today' ? TOKENS.bgRaised : TOKENS.ink,
          background: p.label === 'Today' && dayIso === todayIso ? TOKENS.forest : TOKENS.bgRaised,
          ...(p.label === 'Today' && dayIso === todayIso ? { color: TOKENS.bgRaised } : {}),
        }}>
          {p.label}
        </TenantLink>
      ))}
      <span style={{ fontFamily: MONO, fontSize: 12, color: TOKENS.inkSoft, marginLeft: 8 }}>{dayIso}</span>
    </div>
  );

  const th: React.CSSProperties = { textAlign: 'left', padding: '6px 8px', borderBottom: `1px solid ${TOKENS.ink}`, fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.05em', color: TOKENS.inkSoft, fontFamily: MONO };
  const td: React.CSSProperties = { padding: '4px 6px', borderBottom: `1px solid ${TOKENS.border}`, fontSize: 12, verticalAlign: 'top' };

  const tabs: DashboardTab[] = OPERATIONS_SUBPAGES.map((s) => ({ key: s.href, label: s.label, href: s.href, active: s.href.endsWith('/spa') })) as DashboardTab[];

  return (
    <DashboardPage title="Spa schedule" subtitle={`Operations · Spa · therapist × room slots · ${dayIso}`} tabs={tabs}>
      <div style={{ gridColumn: '1 / -1', display: 'flex', flexDirection: 'column', gap: 14 }}>
        <SpaSubnav active="schedule" />

        {bridgeMissing && <BridgeNotice what="The schedule surface" />}

        {!bridgeMissing && (
          <BookingForm
            propertyId={propertyId}
            dayIso={dayIso}
            treatments={catalogue.filter((t) => t.is_active !== false).map((t) => ({
              treatment_id: t.treatment_id, name: t.name,
              duration_min: t.duration_min, price_usd: t.price_usd == null ? null : Number(t.price_usd),
            }))}
            therapists={therapistsB.rows.map((t) => ({ id: t.therapist_id, label: t.display_name }))}
            rooms={roomsB.rows.map((r) => ({ id: String(r.room_id), label: r.name + (r.couples_capable ? ' · couples' : '') }))}
          />
        )}

        <Container title="Daily spa analytics" subtitle={`bookings · revenue · capacity · ${dayIso}`} density="compact" action={dayNav}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 10 }}>
            {kpis.map((t, i) => <KpiTile key={i} {...t} />)}
          </div>
        </Container>

        <Container title="Slot grid" subtitle={`therapist columns × hour rows · ${DAY_START}:00–${DAY_END}:00 local`} density="compact">
          {activeBookings.length === 0 && !bridgeMissing ? (
            <div style={{ padding: 20, fontSize: 13, color: TOKENS.inkSoft }}>
              No bookings for {dayIso}. Use <strong>+ New booking</strong> above — creation is conflict-safe (rejects therapist/room overlap incl. cleanup buffer).
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ borderCollapse: 'collapse', width: '100%', background: TOKENS.bgRaised, minWidth: 200 + columns.length * 160 }}>
                <thead>
                  <tr>
                    <th style={{ ...th, width: 60 }}>Time</th>
                    {columns.map((c) => <th key={c.id} style={th}>{c.name}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {Array.from({ length: SHIFT_HOURS }, (_, i) => DAY_START + i).map((hour) => (
                    <tr key={hour}>
                      <td style={{ ...td, fontFamily: MONO, fontSize: 11, color: TOKENS.inkSoft }}>{String(hour).padStart(2, '0')}:00</td>
                      {columns.map((c) => {
                        const cell = cellFor(c.id, hour);
                        return (
                          <td key={c.id} style={td}>
                            {cell.map((b) => (
                              <div key={b.booking_id} style={{
                                borderLeft: `3px solid ${STATUS_COLOR[b.status] ?? TOKENS.sand}`,
                                background: `${STATUS_COLOR[b.status] ?? TOKENS.sand}18`,
                                borderRadius: 4, padding: '4px 6px', marginBottom: 4,
                              }}>
                                <div style={{ fontWeight: 600, fontSize: 12 }}>{localTimeStr(b.scheduled_at, propertyId)} · {b.treatment_name}</div>
                                <div style={{ fontSize: 11, color: TOKENS.inkSoft }}>
                                  {b.guest_name ?? '—'} · {b.duration_min}min{b.room_name ? ` · ${b.room_name}` : ''} · {b.status}
                                </div>
                              </div>
                            ))}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Container>

        <Container title="Booking list" subtitle={`all statuses · ${dayIso}`} density="compact">
          {bookings.length === 0 ? (
            <div style={{ padding: 20, fontSize: 13, color: TOKENS.inkSoft }}>Nothing booked.</div>
          ) : (
            <div style={{ overflowX: 'auto', border: `1px solid ${TOKENS.border}`, borderRadius: 6 }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', background: TOKENS.bgRaised }}>
                <thead>
                  <tr>
                    <th style={th}>Time</th><th style={th}>Guest</th><th style={th}>Treatment</th>
                    <th style={th}>Therapist</th><th style={th}>Room</th><th style={th}>Status</th>
                    <th style={{ ...th, textAlign: 'right' }}>Price</th><th style={th}>Folio</th><th style={th}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {bookings.map((b) => (
                    <tr key={b.booking_id}>
                      <td style={{ ...td, fontFamily: MONO }}>{localTimeStr(b.scheduled_at, propertyId)}</td>
                      <td style={td}>{b.guest_name ?? '—'}{b.reservation_id ? <span style={{ color: TOKENS.inkSoft, fontSize: 11 }}> · res {b.reservation_id}</span> : null}</td>
                      <td style={td}>{b.treatment_name}<span style={{ color: TOKENS.inkSoft, fontSize: 11 }}> · {b.duration_min}min</span></td>
                      <td style={td}>{b.therapist_name ?? '—'}</td>
                      <td style={td}>{b.room_name ?? '—'}</td>
                      <td style={{ ...td, color: STATUS_COLOR[b.status] ?? TOKENS.ink, fontFamily: MONO, fontSize: 11, textTransform: 'uppercase' }}>{b.status}</td>
                      <td style={{ ...td, textAlign: 'right', fontFamily: MONO }}>{fmtMoney(b.price, b.currency)}</td>
                      <td style={{ ...td, fontFamily: MONO, fontSize: 11 }}>{b.posted_to_folio ? (b.cloudbeds_charge_id ?? 'posted') : '—'}</td>
                      <td style={td}>
                        <span style={{ display: 'inline-flex', gap: 6, flexWrap: 'wrap' }}>
                          <StatusActions bookingId={b.booking_id} status={b.status} />
                          <NotifyActions bookingId={b.booking_id} status={b.status} confirmationSentAt={b.confirmation_sent_at} />
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Container>
      </div>
    </DashboardPage>
  );
}
