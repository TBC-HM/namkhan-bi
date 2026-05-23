// app/(cockpit)/_design/BookingActivity.tsx
//
// Today's bookings + cancellations table for a property, with a 1-7 day
// dropdown. Reads from public.v_reservations_unified (cross-property
// bridge view). Property-aware. Columns: Booked at · Source · Room · Rate
// plan · LOS · ADR · Revenue. Cancellations rendered in a second sub-table
// below the bookings. Task #82 · 2026-05-22.

import Container from './layout/Container';
import BookingActivityDays from './BookingActivityDays';
import { supabase } from '@/lib/supabase';

interface Props {
  propertyId: number;
  searchParams?: Record<string, string | string[] | undefined>;
  /** URL search-param key for the day picker. Defaults to "activityDays".
   *  Override when stacking multiple BookingActivity blocks on one page. */
  paramKey?: string;
}

interface Row {
  reservation_id: string;
  source_name: string | null;
  room_type_name: string | null;
  rate_plan: string | null;
  nights: number | null;
  total_amount: number | null;
  booking_date: string | null;
  cancellation_date: string | null;
  is_cancelled: boolean | null;
  currency: string | null;
}

function fmtMoney(n: number, sym: string): string {
  return `${sym}${Math.round(n).toLocaleString('en-US')}`;
}

function relTime(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  const diff = Date.now() - d.getTime();
  const m = Math.floor(diff / 60_000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const days = Math.floor(h / 24);
  return `${days}d ago`;
}

export default async function BookingActivity({
  propertyId, searchParams, paramKey = 'activityDays',
}: Props) {
  const rawDays = Number(searchParams?.[paramKey]);
  const days = Number.isFinite(rawDays) && rawDays >= 1 && rawDays <= 7 ? rawDays : 1;
  const cutoffIso = new Date(Date.now() - days * 86_400_000).toISOString();
  const cutoffDate = cutoffIso.slice(0, 10);

  // Currency symbol from property display (defaults USD)
  const { data: prop } = await supabase
    .from('v_property_display')
    .select('display_symbol')
    .eq('property_id', propertyId)
    .maybeSingle();
  const sym = String((prop as { display_symbol?: string } | null)?.display_symbol ?? '$');

  // Two parallel queries: new bookings + cancellations in the window
  const [bookingsRes, cancelsRes] = await Promise.all([
    supabase.from('v_reservations_unified')
      .select('reservation_id, source_name, room_type_name, rate_plan, nights, total_amount, booking_date, cancellation_date, is_cancelled, currency')
      .eq('property_id', propertyId)
      .eq('is_cancelled', false)
      .gte('booking_date', cutoffIso)
      .order('booking_date', { ascending: false })
      .limit(100),
    supabase.from('v_reservations_unified')
      .select('reservation_id, source_name, room_type_name, rate_plan, nights, total_amount, booking_date, cancellation_date, is_cancelled, currency')
      .eq('property_id', propertyId)
      .eq('is_cancelled', true)
      .gte('cancellation_date', cutoffDate)
      .order('cancellation_date', { ascending: false })
      .limit(100),
  ]);

  const bookings = (bookingsRes.data ?? []) as Row[];
  const cancels  = (cancelsRes.data  ?? []) as Row[];

  const subtitle = `${bookings.length} new booking${bookings.length === 1 ? '' : 's'} · ${cancels.length} cancellation${cancels.length === 1 ? '' : 's'} · last ${days === 1 ? '24 hours' : `${days} days`}`;

  return (
    <Container
      title="Bookings & cancellations"
      subtitle={subtitle}
      density="compact"
      action={<BookingActivityDays paramKey={paramKey} current={days} />}
    >
      <Section title={`New bookings (${bookings.length})`} rows={bookings} sym={sym} kind="booking" />
      <div style={{ height: 12 }} />
      <Section title={`Cancellations (${cancels.length})`} rows={cancels} sym={sym} kind="cancel" />
    </Container>
  );
}

interface SectionProps {
  title: string;
  rows: Row[];
  sym: string;
  kind: 'booking' | 'cancel';
}

function Section({ title, rows, sym, kind }: SectionProps) {
  return (
    <div>
      <div style={{
        fontSize: 11, fontWeight: 600, letterSpacing: '0.06em',
        textTransform: 'uppercase', color: 'var(--ink-soft, #5A5A5A)',
        marginBottom: 6,
      }}>
        {title}
      </div>
      {rows.length === 0 ? (
        <div style={{
          padding: 12, fontSize: 12, color: 'var(--ink-soft, #5A5A5A)',
          fontStyle: 'italic',
        }}>
          {kind === 'booking' ? 'No new bookings in the window.' : 'No cancellations in the window.'}
        </div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr style={{ background: '#FAFAF7' }}>
                <th style={th}>{kind === 'booking' ? 'Booked' : 'Cancelled'}</th>
                <th style={th}>Source</th>
                <th style={th}>Room</th>
                <th style={th}>Rate plan</th>
                <th style={{ ...th, textAlign: 'right' }}>LOS</th>
                <th style={{ ...th, textAlign: 'right' }}>ADR</th>
                <th style={{ ...th, textAlign: 'right' }}>Revenue</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const nights = Number(r.nights ?? 0);
                const total = Number(r.total_amount ?? 0);
                const adr = nights > 0 ? total / nights : 0;
                const ts = kind === 'booking' ? r.booking_date : r.cancellation_date;
                return (
                  <tr key={r.reservation_id} style={{ borderTop: '1px solid var(--hairline, #E6DFCC)' }}>
                    <td style={tdLeft} title={ts ?? ''}>{relTime(ts)}</td>
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
    </div>
  );
}

const th: React.CSSProperties = {
  padding: '7px 12px', fontSize: 10, fontWeight: 600, letterSpacing: '0.06em',
  textTransform: 'uppercase', color: 'var(--ink-soft, #5A5A5A)', textAlign: 'left',
  borderBottom: '1px solid var(--hairline, #E6DFCC)',
};
const tdLeft: React.CSSProperties = {
  padding: '6px 12px', fontSize: 12, color: 'var(--ink, #1B1B1B)',
  whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 220,
};
const tdRight: React.CSSProperties = {
  padding: '6px 12px', fontSize: 12, textAlign: 'right',
  fontVariantNumeric: 'tabular-nums', color: 'var(--ink, #1B1B1B)',
};
