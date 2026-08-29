// app/api/rooms/calendar/route.ts
// Room-level booking calendar data for the Cloudbeds-style grid view.
// Returns room types, their individual rooms, and all bookings overlapping
// the requested date window.

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { requirePropertyAccess } from '@/lib/tenancy';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const rawPid = searchParams.get('pid');

  let propertyId: number;
  try {
    propertyId = await requirePropertyAccess(req, rawPid == null ? null : Number(rawPid));
  } catch (e) {
    if (e instanceof Response) return e;
    return NextResponse.json({ error: 'unauthorized' }, { status: 403 });
  }

  const today = new Date();
  const defaultFrom = new Date(today);
  defaultFrom.setDate(defaultFrom.getDate() - 3);

  const from = searchParams.get('from') ?? defaultFrom.toISOString().slice(0, 10);
  const toDt = new Date(from + 'T00:00:00Z');
  toDt.setDate(toDt.getDate() + 27);
  const to = searchParams.get('to') ?? toDt.toISOString().slice(0, 10);

  const sb = getSupabaseAdmin();

  // Discover rooms: look ±6 months to capture both active and upcoming rooms.
  const lookback = new Date(today);
  lookback.setMonth(lookback.getMonth() - 6);
  const lookahead = new Date(today);
  lookahead.setMonth(lookahead.getMonth() + 6);

  const [typesRes, allRoomsRes, rrRes] = await Promise.all([
    sb.schema('pms').from('room_types_cb')
      .select('room_type_id, room_type_name')
      .eq('property_id', propertyId)
      .order('room_type_name'),

    sb.schema('pms').from('reservation_rooms_cb')
      .select('room_type_id, room_id')
      .eq('property_id', propertyId)
      .gte('night_date', lookback.toISOString().slice(0, 10))
      .lte('night_date', lookahead.toISOString().slice(0, 10)),

    sb.schema('pms').from('reservation_rooms_cb')
      .select('reservation_id, room_id, room_type_id')
      .eq('property_id', propertyId)
      .gte('night_date', from)
      .lte('night_date', to),
  ]);

  const firstErr = typesRes.error ?? allRoomsRes.error ?? rrRes.error;
  if (firstErr) {
    return NextResponse.json({ error: firstErr.message }, { status: 500 });
  }

  // Build room_type_id → sorted room_ids map, skipping placeholder "unassigned:" rows.
  const typeRooms = new Map<number, Set<string>>();
  for (const r of allRoomsRes.data ?? []) {
    if ((r.room_id as string).startsWith('unassigned:')) continue;
    const tid = Number(r.room_type_id);
    if (!typeRooms.has(tid)) typeRooms.set(tid, new Set());
    typeRooms.get(tid)!.add(r.room_id as string);
  }

  // Fetch reservation details for every booking that overlaps the window.
  const reservationIds = [...new Set((rrRes.data ?? []).map((r) => r.reservation_id as string))];

  let bookings: object[] = [];
  if (reservationIds.length > 0) {
    const resRes = await sb.schema('pms').from('reservations_cb')
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
          reservation_id: rr.reservation_id,
          room_id: rr.room_id,
          room_type_id: Number(rr.room_type_id),
          guest_name: res.guest_name,
          check_in_date: res.check_in_date,
          check_out_date: res.check_out_date,
          status: res.status,
          source_name: res.source_name,
        });
      }
    }
  }

  const roomTypes = (typesRes.data ?? [])
    .map((t) => ({
      id: Number(t.room_type_id),
      name: t.room_type_name as string,
      rooms: [...(typeRooms.get(Number(t.room_type_id)) ?? [])].sort(),
    }))
    .filter((t) => t.rooms.length > 0);

  return NextResponse.json({ roomTypes, bookings, from, to });
}
