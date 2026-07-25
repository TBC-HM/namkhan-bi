// app/api/marketing/social/reject-slot/route.ts
// spec-social-media-module (2026-07-25, run 2) · A6 — reject (skip) a social
// calendar slot without creating a post. Wraps public.fn_social_slot_reject.
// Mirrors /api/marketing/director/reject-slot.

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
  const { data, error } = await sb.rpc('fn_social_slot_reject', { p_slot_id: slot_id });
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, slot_id: data ?? slot_id });
}
