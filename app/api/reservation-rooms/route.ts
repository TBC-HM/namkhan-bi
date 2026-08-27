// app/api/reservation-rooms/route.ts
// Returns the individual room-level accommodations for a single reservation by
// unnesting pms.reservations_cb.raw->'rooms'. Used by the booking feed detail
// drawer to show group bookings (e.g. Claudia Bauer, 8 rooms) as individual rows.
//
// L22: property_id from query is untrusted — requirePropertyAccess() verifies
// the caller's grant before any data is returned.

import { type NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { requirePropertyAccess } from '@/lib/tenancy';

export const dynamic = 'force-dynamic';

interface RawRoom {
  guestName?: string;
  roomName?: string;
  roomTypeName?: string;
  roomCheckIn?: string;
  roomCheckOut?: string;
  adults?: number;
  subReservationID?: string;
}

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const rawPid = sp.get('property_id');
  const reservationId = sp.get('reservation_id');

  if (!reservationId) {
    return NextResponse.json({ error: 'reservation_id required' }, { status: 400 });
  }

  let propertyId: number;
  try {
    propertyId = await requirePropertyAccess(req, rawPid);
  } catch (e) {
    if (e instanceof Response) return e;
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .schema('pms')
    .from('reservations_cb')
    .select('raw')
    .eq('property_id', propertyId)
    .eq('reservation_id', reservationId)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const rooms: RawRoom[] = (data?.raw as { rooms?: RawRoom[] } | null)?.rooms ?? [];

  return NextResponse.json({
    rooms: rooms.map((r) => ({
      guestName: r.guestName ?? null,
      roomName: r.roomName ?? null,
      roomTypeName: r.roomTypeName ?? null,
      checkIn: r.roomCheckIn ? r.roomCheckIn.slice(0, 10) : null,
      checkOut: r.roomCheckOut ? r.roomCheckOut.slice(0, 10) : null,
      adults: r.adults ?? null,
      subReservationId: r.subReservationID ?? null,
    })),
  });
}
