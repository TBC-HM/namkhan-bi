// app/api/spa/passes/route.ts
// Spa module v1 — day-pass + package sale & redemption (brief
// spa-module-v1-slice-day-pass-tiers). Tier-based pricing now supported.
// POST  → sell a pass via public.fn_spa_sell_pass (with optional tier_id).
// PATCH → { action: 'redeem', pass_id, booking_id?, credits?, note? }
//           via fn_spa_redeem_pass — locks the pass row, validates window +
//           remaining credits, ties the redemption to a booking when given.
//         { action: 'cancel' | 'expire', pass_id }
//           via fn_spa_set_pass_status (active → cancelled | expired only).
// SPA_PASS_* function errors map to 409 (conflict-class) with the friendly
// message intact; anything else stays 400/500.

import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

const KNOWN_PROPERTIES = new Set([260955, 1000001]);

function errStatus(message: string): number {
  return /SPA_PASS_/.test(message) ? 409 : 500;
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const propertyId = Number(body.property_id);
    if (!KNOWN_PROPERTIES.has(propertyId)) {
      return NextResponse.json({ error: 'unknown property_id' }, { status: 400 });
    }
    const passType = String(body.pass_type ?? '');
    if (!['day_pass', 'package'].includes(passType)) {
      return NextResponse.json({ error: "pass_type must be 'day_pass' or 'package'" }, { status: 400 });
    }
    const name = typeof body.name === 'string' ? body.name.trim() : '';
    const guestName = typeof body.guest_name === 'string' ? body.guest_name.trim() : '';
    if (!name || !guestName) {
      return NextResponse.json({ error: 'name and guest_name required' }, { status: 400 });
    }

    const sb = getSupabaseAdmin();
    const { data, error } = await sb.rpc('fn_spa_sell_pass', {
      p_property_id: propertyId,
      p_pass_type: passType,
      p_name: name,
      p_guest_name: guestName,
      p_credits_total: body.credits_total != null && body.credits_total !== '' ? Number(body.credits_total) : 1,
      p_valid_from: body.valid_from || undefined,
      p_valid_until: body.valid_until || null,
      p_price: body.price != null && body.price !== '' ? Number(body.price) : null,
      p_currency: body.currency || 'USD',
      p_guest_email: body.guest_email || null,
      p_guest_phone: body.guest_phone || null,
      p_reservation_id: body.reservation_id || null,
      p_notes: body.notes || null,
      p_tier_id: body.tier_id != null && body.tier_id !== '' ? Number(body.tier_id) : null,
    });
    if (error) return NextResponse.json({ error: error.message }, { status: errStatus(error.message) });
    return NextResponse.json({ ok: true, pass_id: data });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'unknown error' }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const body = await req.json();
    const passId = String(body.pass_id ?? '');
    const action = String(body.action ?? '');
    if (!passId) return NextResponse.json({ error: 'pass_id required' }, { status: 400 });

    const sb = getSupabaseAdmin();

    if (action === 'redeem') {
      const { data, error } = await sb.rpc('fn_spa_redeem_pass', {
        p_pass_id: passId,
        p_booking_id: body.booking_id || null,
        p_credits: body.credits != null && body.credits !== '' ? Number(body.credits) : 1,
        p_note: body.note || null,
      });
      if (error) return NextResponse.json({ error: error.message }, { status: errStatus(error.message) });
      return NextResponse.json({ ok: true, ...(data as Record<string, unknown>) });
    }

    if (action === 'cancel' || action === 'expire') {
      const { data, error } = await sb.rpc('fn_spa_set_pass_status', {
        p_pass_id: passId,
        p_status: action === 'cancel' ? 'cancelled' : 'expired',
      });
      if (error) return NextResponse.json({ error: error.message }, { status: errStatus(error.message) });
      if (!data) return NextResponse.json({ error: 'pass not found' }, { status: 404 });
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: "action must be 'redeem', 'cancel' or 'expire'" }, { status: 400 });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'unknown error' }, { status: 500 });
  }
}
