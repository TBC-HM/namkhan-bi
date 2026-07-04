// app/api/newsletter/enqueue-ad-hoc/route.ts
// PBS 2026-07-04: dispatch a draft to a hand-picked list of guests.
// Calls guest.fn_enqueue_ad_hoc — the batch-send cron picks up the queued rows within a minute.

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const campaign_id = String(body?.campaign_id || '');
  const guest_ids   = Array.isArray(body?.guest_ids) ? (body.guest_ids as unknown[]).map(String) : [];
  const send_at     = body?.send_at ? new Date(body.send_at).toISOString() : new Date().toISOString();

  if (!campaign_id || guest_ids.length === 0) {
    return NextResponse.json({ ok: false, error: 'campaign_id + guest_ids required' }, { status: 400 });
  }
  if (guest_ids.length > 5000) {
    return NextResponse.json({ ok: false, error: 'max 5000 recipients per dispatch' }, { status: 400 });
  }

  const sb = getSupabaseAdmin();
  const { data, error } = await sb.schema('guest').rpc('fn_enqueue_ad_hoc', {
    p_campaign_id: campaign_id,
    p_guest_ids:   guest_ids,
    p_send_at:     send_at,
  });
  if (error) {
    return NextResponse.json({ ok: false, error: error.message || 'enqueue_failed' }, { status: 500 });
  }
  return NextResponse.json(data);
}
