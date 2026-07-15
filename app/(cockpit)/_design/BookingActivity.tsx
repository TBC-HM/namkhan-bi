// app/(cockpit)/_design/BookingActivity.tsx
//
// PBS 2026-07-15: ongoing "Bookings & cancellations" activity feed.
// Was: Today / Last-N-days table with two sub-sections (bookings, cancels).
// Now: single merged feed of the last N events sorted by timestamp DESC,
// collapsed to 10 rows by default with an expand toggle. Day-scoped totals
// (Today / Yesterday, in Asia/Vientiane time) live in the Revenue HoD
// headline strip instead — this container is the rolling audit trail.
//
// Data source: public.fn_pulse_recent_activity(p_property_id, p_limit) —
// unions bookings + cancellations from v_reservations_unified, sorted
// event_at DESC.

import Container from './layout/Container';
import BookingActivityExpand from './BookingActivityExpand';
import { supabase } from '@/lib/supabase';

interface Props {
  propertyId: number;
  searchParams?: Record<string, string | string[] | undefined>;
  paramKey?: string;
}

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

const COLLAPSED_ROWS = 10;
const MAX_ROWS = 200;

function tzForProperty(pid: number): string {
  if (pid === 260955) return 'Asia/Vientiane';
  if (pid === 1000001) return 'Europe/Madrid';
  return 'UTC';
}

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

export default async function BookingActivity({
  propertyId, searchParams, paramKey = 'activityExpanded',
}: Props) {
  const expanded = String(searchParams?.[paramKey] ?? '') === '1';
  const tz = tzForProperty(propertyId);

  const { data: prop } = await supabase
    .from('v_property_display')
    .select('display_symbol')
    .eq('property_id', propertyId)
    .maybeSingle();
  const sym = String((prop as { display_symbol?: string } | null)?.display_symbol ?? '$');

  const { data } = await supabase.rpc('fn_pulse_recent_activity', {
    p_property_id: propertyId,
    p_limit: MAX_ROWS,
  });
  const rows = (data ?? []) as Row[];
  const shown = expanded ? rows : rows.slice(0, COLLAPSED_ROWS);

  const bookingCount = rows.filter((r) => r.event_kind === 'booking').length;
  const cancelCount  = rows.filter((r) => r.event_kind === 'cancel').length;
  const subtitle = `${bookingCount} new booking${bookingCount === 1 ? '' : 's'} · ${cancelCount} cancellation${cancelCount === 1 ? '' : 's'} · showing ${shown.length} of ${rows.length} (${tz})`;

  return (
    <Container
      title="Bookings & cancellations · feed"
      subtitle={subtitle}
      density="compact"
      action={
        <BookingActivityExpand
          paramKey={paramKey}
          expanded={expanded}
          totalRows={rows.length}
          shownRows={shown.length}
        />
      }
    >
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
                <th style={th}>When ({tz})</th>
                <th style={th}>Event</th>
                <th style={th}>Check-in</th>
                <th style={th}>Source</th>
                <th style={th}>Room</th>
                <th style={th}>Rate plan</th>
                <th style={{ ...th, textAlign: 'right' }}>LOS</th>
                <th style={{ ...th, textAlign: 'right' }}>ADR</th>
                <th style={{ ...th, textAlign: 'right' }}>Revenue</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((r, i) => {
                const nights = Number(r.nights ?? 0);
                const total = Number(r.total_amount ?? 0);
                const adr = nights > 0 ? total / nights : 0;
                const isCancel = r.event_kind === 'cancel';
                const kindPill: React.CSSProperties = {
                  display: 'inline-block',
                  padding: '2px 8px', fontSize: 10, fontWeight: 700,
                  borderRadius: 3, textTransform: 'uppercase',
                  letterSpacing: '0.06em',
                  background: isCancel ? '#FBEAEA' : '#E8F2E4',
                  color: isCancel ? '#B04A2F' : '#1F5C2C',
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
    </Container>
  );
}

const th: React.CSSProperties = {
  padding: '7px 12px', fontSize: 10, fontWeight: 600,
  letterSpacing: '0.06em', textTransform: 'uppercase',
  color: '#000', textAlign: 'left',
};
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
