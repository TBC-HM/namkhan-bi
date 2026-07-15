// app/(cockpit)/_design/BookingActivity.tsx
//
// PBS 2026-07-15: server component that fetches the recent activity feed
// (up to 200 events) once, then hands off to <BookingFeedTable/> (client)
// which owns the sort + expand state so column-header clicks feel instant.
// Day-scoped totals (Today / Yesterday, Vientiane calendar day) live in
// the Revenue HoD headline stripe — this container is the audit trail.
//
// Data source: public.fn_pulse_recent_activity(p_property_id, p_limit) —
// unions bookings + cancellations from v_reservations_unified, sorted
// event_at DESC by default.

import Container from './layout/Container';
import BookingFeedTable from './BookingFeedTable';
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

const MAX_ROWS = 200;

function tzForProperty(pid: number): string {
  if (pid === 260955) return 'Asia/Vientiane';
  if (pid === 1000001) return 'Europe/Madrid';
  return 'UTC';
}

export default async function BookingActivity({ propertyId }: Props) {
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

  const bookingCount = rows.filter((r) => r.event_kind === 'booking').length;
  const cancelCount  = rows.filter((r) => r.event_kind === 'cancel').length;
  const subtitle = `${bookingCount} new booking${bookingCount === 1 ? '' : 's'} · ${cancelCount} cancellation${cancelCount === 1 ? '' : 's'} in the latest ${rows.length} events · sortable columns`;

  return (
    <Container
      title="Bookings & cancellations · feed"
      subtitle={subtitle}
      density="compact"
    >
      <BookingFeedTable rows={rows} sym={sym} tz={tz} />
    </Container>
  );
}
