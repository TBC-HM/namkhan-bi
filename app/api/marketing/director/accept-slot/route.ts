// app/api/marketing/director/accept-slot/route.ts
// PBS 2026-07-21 pm (Newsletter Calendar v2): accept a single director slot.
// Wraps fn_director_slot_accept (SECURITY DEFINER) which creates a draft in
// guest.campaigns with status='draft' (NOT scheduled — user reviews in
// Broadcasts, then hits Schedule from there), stamps director_slot_id, and
// flips the slot to status='approved' with linked_campaign_id.
// Returns { campaign_id, edit_url } for the client toast.

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
  const { data, error } = await sb.rpc('fn_director_slot_accept', { p_slot_id: slot_id });
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

  // fn_director_slot_accept returns jsonb { campaign_id, edit_url }
  const payload = (data ?? {}) as { campaign_id?: string; edit_url?: string };
  if (!payload.campaign_id) {
    return NextResponse.json({ ok: false, error: 'no campaign_id returned' }, { status: 500 });
  }
  return NextResponse.json({ ok: true, campaign_id: payload.campaign_id, edit_url: payload.edit_url ?? `/guest/newsletters/${payload.campaign_id}` });
}
