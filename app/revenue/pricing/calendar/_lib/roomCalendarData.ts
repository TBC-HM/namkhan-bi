// app/revenue/pricing/calendar/_lib/roomCalendarData.ts
// Server-only data fetch for the room-level OTB calendar.
// Kept separate from the route so PricingPage can call it directly (SSR),
// avoiding the client-auth + PostgREST 1000-row truncation bugs.

import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export interface RoomType { id: number; name: string; rooms: Array<{ id: string; name: string }> }

export interface RoomBooking {
  reservation_id: string;
  room_id:        string;
  room_type_id:   number;
  guest_name:     string;
  check_in_date:  string;
  check_out_date: string;
  status:         string;
  source_name:    string | null;
}

export async function fetchRoomCalendar(
  propertyId: number,
  from: string,
  to: string,
): Promise<{ roomTypes: RoomType[]; bookings: RoomBooking[] }> {
  const sb = getSupabaseAdmin();
  const today = new Date();

  const lookback = new Date(today);
  lookback.setMonth(lookback.getMonth() - 6);
  const lookahead = new Date(today);
  lookahead.setMonth(lookahead.getMonth() + 6);

  const [typesRes, roomNamesRes, allRoomsRes, rrRes] = await Promise.all([
    sb.from('room_types')
      .select('room_type_id, room_type_name')
      .eq('property_id', propertyId)
      .order('room_type_name'),

    // Fetch canonical room names from public.rooms (room_id → room_name).
    sb.from('rooms')
      .select('room_id, room_name')
      .eq('property_id', propertyId)
      .limit(500),

    // Room discovery: ±6 months.  The 12-month window has ~1 800 rows for
    // Namkhan, which exceeds PostgREST's default 1 000-row cap.
    // limit(5000) overrides that cap so we get every room ID.
    sb.from('reservation_rooms')
      .select('room_type_id, room_id')
      .eq('property_id', propertyId)
      .gte('night_date', lookback.toISOString().slice(0, 10))
      .lte('night_date', lookahead.toISOString().slice(0, 10))
      .limit(5000),

    sb.from('reservation_rooms')
      .select('reservation_id, room_id, room_type_id')
      .eq('property_id', propertyId)
      .gte('night_date', from)
      .lte('night_date', to),
  ]);

  // Build room_id → canonical name map from public.rooms.
  const roomNameMap = new Map<string, string>();
  for (const r of roomNamesRes.data ?? []) {
    if (r.room_name) roomNameMap.set(r.room_id as string, r.room_name as string);
  }

  // Build room_type_id → unique room_ids map.
  const typeRooms = new Map<number, Set<string>>();
  for (const r of allRoomsRes.data ?? []) {
    if ((r.room_id as string).startsWith('unassigned:')) continue;
    const tid = Number(r.room_type_id);
    if (!typeRooms.has(tid)) typeRooms.set(tid, new Set());
    typeRooms.get(tid)!.add(r.room_id as string);
  }

  // Fetch reservation details for every booking overlapping the window.
  const reservationIds = [
    ...new Set((rrRes.data ?? []).map((r) => r.reservation_id as string)),
  ];
  const bookings: RoomBooking[] = [];

  if (reservationIds.length > 0) {
    const resRes = await sb.from('reservations')
      .select('reservation_id, guest_name, check_in_date, check_out_date, status, source_name')
      .in('reservation_id', reservationIds)
      .not('status', 'eq', 'cancelled');

    if (!resRes.error && resRes.data) {
      const resMap = new Map(resRes.data.map((r) => [r.reservation_id as string, r]));
      const seen = new Set<string>();

      for (const rr of rrRes.data ?? []) {
        if ((rr.room_id as string).startsWith('unassigned:')) continue;
        const res = resMap.get(rr.reservation_id as string);
        if (!res) continue;
        const key = `${rr.reservation_id}:${rr.room_id}`;
        if (seen.has(key)) continue;
        seen.add(key);
        bookings.push({
          reservation_id: rr.reservation_id as string,
          room_id:        rr.room_id as string,
          room_type_id:   Number(rr.room_type_id),
          guest_name:     (res.guest_name as string) ?? '—',
          check_in_date:  res.check_in_date as string,
          check_out_date: res.check_out_date as string,
          status:         res.status as string,
          source_name:    (res.source_name as string | null) ?? null,
        });
      }
    }
  }

  const roomTypes: RoomType[] = (typesRes.data ?? [])
    .map((t) => ({
      id:   Number(t.room_type_id),
      name: t.room_type_name as string,
      rooms: [...(typeRooms.get(Number(t.room_type_id)) ?? [])]
        .sort()
        .map((id) => ({ id, name: roomNameMap.get(id) ?? id })),
    }))
    .filter((t) => t.rooms.length > 0);

  return { roomTypes, bookings };
}
