// app/api/reservations/bookings/route.ts
// GET /api/reservations/bookings?pid=&status=&source=&room_types=
//   &from_booking=&to_booking=&from_checkin=&to_checkin=&from_checkout=&to_checkout=
//
// Returns rows from v_reservations_full filtered by the given params, plus
// distinct filter-option lists (availableStatuses, availableSources, availableRoomTypes).
// Used by BookingsTableCB (the Bookings tab on the reservations page).
//
// "Canceled" is a synthetic status value: it maps to is_cancelled = true
// rather than the status column.

import { NextRequest } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { requirePropertyAccess } from '@/lib/tenancy';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export interface BookingRow {
  reservation_id: string;
  guest_first_name: string | null;
  guest_last_name: string | null;
  booking_date: string | null;
  room_numbers: string | null;
  room_type_name: string | null;
  check_in_date: string | null;
  check_out_date: string | null;
  status: string | null;
  source_name: string | null;
  is_cancelled: boolean | null;
}

function splitParam(v: string | null): string[] {
  return v ? v.split(',').map(s => s.trim()).filter(Boolean) : [];
}

function uniq(arr: string[]): string[] {
  return [...new Set(arr)];
}

export async function GET(req: NextRequest) {
  const url = req.nextUrl;
  const rawPid = url.searchParams.get('pid');

  let propertyId: number;
  try {
    propertyId = await requirePropertyAccess(req, rawPid);
  } catch (e) {
    if (e instanceof Response) return e;
    return Response.json({ error: 'internal_error' }, { status: 500 });
  }

  const sb = getSupabaseAdmin();

  const statusList = splitParam(url.searchParams.get('status'));
  const sourceList = splitParam(url.searchParams.get('source'));
  const roomTypeList = splitParam(url.searchParams.get('room_types'));
  const fromBooking = url.searchParams.get('from_booking');
  const toBooking = url.searchParams.get('to_booking');
  const fromCheckin = url.searchParams.get('from_checkin');
  const toCheckin = url.searchParams.get('to_checkin');
  const fromCheckout = url.searchParams.get('from_checkout');
  const toCheckout = url.searchParams.get('to_checkout');

  const hasCanceled = statusList.includes('Canceled');
  const otherStatuses = statusList.filter(s => s !== 'Canceled');

  // Build the query dynamically. We use `any` for the builder variable so that
  // chaining .or() and .in() across branches satisfies TypeScript without
  // complex generic juggling.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let q: any = sb
    .from('v_reservations_full')
    .select(
      'reservation_id,guest_first_name,guest_last_name,booking_date,' +
      'room_numbers,room_type_name,check_in_date,check_out_date,status,source_name,is_cancelled'
    )
    .eq('property_id', propertyId)
    .order('booking_date', { ascending: false })
    .limit(500);

  // Status filter — handles synthetic "Canceled" (→ is_cancelled = true)
  if (statusList.length > 0) {
    if (hasCanceled && otherStatuses.length > 0) {
      q = q.or(`is_cancelled.eq.true,status.in.(${otherStatuses.join(',')})`);
    } else if (hasCanceled) {
      q = q.eq('is_cancelled', true);
    } else {
      q = q.in('status', otherStatuses);
    }
  }

  if (sourceList.length > 0) q = q.in('source_name', sourceList);
  if (roomTypeList.length > 0) q = q.in('room_type_name', roomTypeList);
  if (fromBooking) q = q.gte('booking_date', fromBooking);
  if (toBooking) q = q.lte('booking_date', toBooking);
  if (fromCheckin) q = q.gte('check_in_date', fromCheckin);
  if (toCheckin) q = q.lte('check_in_date', toCheckin);
  if (fromCheckout) q = q.gte('check_out_date', fromCheckout);
  if (toCheckout) q = q.lte('check_out_date', toCheckout);

  const { data: rows, error } = (await q) as {
    data: BookingRow[] | null;
    error: { message: string } | null;
  };

  if (error) return Response.json({ error: error.message }, { status: 500 });

  // Distinct filter options — unfiltered (all rows for this property) so the
  // option lists don't collapse as filters are applied.
  const [{ data: srcRows }, { data: rtRows }, { data: stRows }] = await Promise.all([
    sb.from('v_reservations_full')
      .select('source_name')
      .eq('property_id', propertyId)
      .not('source_name', 'is', null)
      .order('source_name')
      .limit(200),
    sb.from('v_reservations_full')
      .select('room_type_name')
      .eq('property_id', propertyId)
      .not('room_type_name', 'is', null)
      .order('room_type_name')
      .limit(200),
    sb.from('v_reservations_full')
      .select('status')
      .eq('property_id', propertyId)
      .not('status', 'is', null)
      .order('status')
      .limit(200),
  ]);

  const availableSources = uniq(
    ((srcRows ?? []) as { source_name: string }[]).map(r => r.source_name)
  );
  const availableRoomTypes = uniq(
    ((rtRows ?? []) as { room_type_name: string }[]).map(r => r.room_type_name)
  );
  const availableStatuses = uniq(
    ((stRows ?? []) as { status: string }[]).map(r => r.status)
  );
  // "Canceled" is synthetic (is_cancelled flag), add it if not already present.
  if (!availableStatuses.includes('Canceled')) availableStatuses.push('Canceled');

  return Response.json({
    rows: rows ?? [],
    availableSources,
    availableRoomTypes,
    availableStatuses,
    total: (rows ?? []).length,
  });
}
