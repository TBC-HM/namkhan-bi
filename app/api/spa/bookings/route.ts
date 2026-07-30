// app/api/spa/bookings/route.ts
// Spa module v1 — booking write path (brief spa-module-v1, gap 2).
// POST  → conflict-safe create via public.fn_spa_create_booking
//         (rejects therapist/room overlap incl. room cleanup buffer).
// PATCH → lifecycle transition via public.fn_spa_set_booking_status
//         (booked → confirmed → arrived → in_treatment → completed | cancelled | no_show).
// Catalogue ids (property.spa_treatments, bigint) are resolved to operational
// spa.treatments uuids via public.fn_spa_resolve_treatment before insert.

import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

const KNOWN_PROPERTIES = new Set([260955, 1000001]);

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const propertyId = Number(body.property_id);
    if (!KNOWN_PROPERTIES.has(propertyId)) {
      return NextResponse.json({ error: 'unknown property_id' }, { status: 400 });
    }
    if (!body.scheduled_at || Number.isNaN(Date.parse(body.scheduled_at))) {
      return NextResponse.json({ error: 'scheduled_at (ISO timestamp) required' }, { status: 400 });
    }
    const guestName = typeof body.guest_name === 'string' ? body.guest_name.trim() : '';
    if (!guestName) {
      return NextResponse.json({ error: 'guest_name required' }, { status: 400 });
    }

    const sb = getSupabaseAdmin();

    // Resolve catalogue treatment (bigint) → operational spa.treatments uuid.
    let treatmentUuid: string | null = null;
    if (body.catalogue_treatment_id != null && body.catalogue_treatment_id !== '') {
      const { data: resolved, error: rErr } = await sb.rpc('fn_spa_resolve_treatment', {
        p_property_id: propertyId,
        p_catalogue_treatment_id: Number(body.catalogue_treatment_id),
      });
      if (rErr) return NextResponse.json({ error: rErr.message }, { status: 400 });
      treatmentUuid = resolved as string;
    }

    const { data, error } = await sb.rpc('fn_spa_create_booking', {
      p_property_id: propertyId,
      p_scheduled_at: body.scheduled_at,
      p_duration_min: body.duration_min != null ? Number(body.duration_min) : null,
      p_guest_name: guestName,
      p_treatment_id: treatmentUuid,
      p_therapist_id: body.therapist_id || null,
      p_room_id: body.room_id != null && body.room_id !== '' ? Number(body.room_id) : null,
      p_reservation_id: body.reservation_id || null,
      p_price: body.price != null && body.price !== '' ? Number(body.price) : null,
      p_currency: body.currency || 'USD',
      p_notes: body.notes || null,
    });
    if (error) {
      const status = /SPA_CONFLICT/.test(error.message) ? 409 : 500;
      return NextResponse.json({ error: error.message }, { status });
    }
    return NextResponse.json({ ok: true, booking_id: data });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'unknown error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const body = await req.json();
    if (!body.booking_id || !body.status) {
      return NextResponse.json({ error: 'booking_id and status required' }, { status: 400 });
    }
    const sb = getSupabaseAdmin();
    const { data, error } = await sb.rpc('fn_spa_set_booking_status', {
      p_booking_id: String(body.booking_id),
      p_status: String(body.status),
    });
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    if (!data) return NextResponse.json({ error: 'booking not found' }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'unknown error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
