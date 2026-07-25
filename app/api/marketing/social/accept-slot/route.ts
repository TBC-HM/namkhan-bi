// app/api/marketing/social/accept-slot/route.ts
// spec-social-media-module (2026-07-25, run 2) · A6 — accept a social calendar
// slot. Wraps public.fn_social_slot_accept (SECURITY DEFINER), which creates a
// draft row in marketing.social_posts (status='draft' — reviewed in the
// channel inbox, then marked ready / scheduled from there), links it via
// linked_post_id, and flips the slot to status='accepted'. Idempotent: a slot
// with an existing linked post returns that post. Mirrors
// /api/marketing/director/accept-slot.

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const slot_id = Number(body?.slot_id);
  if (!slot_id || !Number.isFinite(slot_id)) {
    return NextResponse.json({ ok: false, error: 'slot_id required' }, { status: 400 });
  }

  const sb = getSupabaseAdmin();
  const { data, error } = await sb.rpc('fn_social_slot_accept', { p_slot_id: slot_id });
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

  const payload = (data ?? {}) as { post_id?: string; slot_id?: number; already?: boolean };
  if (!payload.post_id) {
    return NextResponse.json({ ok: false, error: 'no post_id returned' }, { status: 500 });
  }
  return NextResponse.json({ ok: true, post_id: payload.post_id, already: payload.already === true });
}
