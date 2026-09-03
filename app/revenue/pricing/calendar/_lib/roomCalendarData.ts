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

export interface DailyKpi {
  occ_pct:  number | null;
  adr:      number | null;
  rooms_sold: number | null;
}

export async function fetchRoomCalendar(
  propertyId: number,
  from: string,
  to: string,
): Promise<{ roomTypes: RoomType[]; bookings: RoomBooking[]; dailyKpi: Record<string, DailyKpi> }> {
  const sb = getSupabaseAdmin();

  const [typesRes, roomsRes, rrRes, kpiRes] = await Promise.all([
    sb.from('room_types')
      .select('room_type_id, room_type_name')
      .eq('property_id', propertyId)
      .order('room_type_name'),

    // public.rooms is the authoritative room list — has real room names like
    // "Tent 11", "Suite 9". Sorted by room_name so groups render in name order.
    sb.from('rooms')
      .select('room_id, room_type_id, room_name')
      .eq('property_id', propertyId)
      .eq('is_active', true)
      .order('room_name')
      .limit(500),

    // Booking window: one row per night per room for reservations in range.
    sb.from('reservation_rooms')
      .select('reservation_id, room_id, room_type_id')
      .eq('property_id', propertyId)
      .gte('night_date', from)
      .lte('night_date', to)
      .limit(5000),

    // Daily KPI for date-header OCC/ADR display.
    sb.from('mv_kpi_daily')
      .select('night_date, occupancy_pct, adr, rooms_sold')
      .eq('property_id', propertyId)
      .gte('night_date', from)
      .lte('night_date', to),
  ]);

  // Build room_type_id → rooms list from public.rooms (canonical source).
  const typeRooms = new Map<number, Array<{ id: string; name: string }>>();
  for (const r of roomsRes.data ?? []) {
    const tid = Number(r.room_type_id);
    if (!typeRooms.has(tid)) typeRooms.set(tid, []);
    typeRooms.get(tid)!.push({
      id:   r.room_id as string,
      name: (r.room_name as string) ?? (r.room_id as string),
    });
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
      id:    Number(t.room_type_id),
      name:  t.room_type_name as string,
      rooms: typeRooms.get(Number(t.room_type_id)) ?? [],
    }))
    .filter((t) => t.rooms.length > 0);

  // Build daily KPI map: iso date → { occ_pct, adr, rooms_sold }
  const dailyKpi: Record<string, DailyKpi> = {};
  for (const r of kpiRes.data ?? []) {
    const iso = String(r.night_date).slice(0, 10);
    dailyKpi[iso] = {
      occ_pct:    r.occupancy_pct != null ? Number(r.occupancy_pct) : null,
      adr:        r.adr           != null ? Number(r.adr)           : null,
      rooms_sold: r.rooms_sold    != null ? Number(r.rooms_sold)    : null,
    };
  }

  return { roomTypes, bookings, dailyKpi };
}
