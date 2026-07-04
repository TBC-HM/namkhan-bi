// app/api/newsletter/schedule/route.ts
// PBS 2026-07-04: enqueue chosen guests + flip campaign to scheduled (or sending if send_at is now).
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const campaign_id = String(body?.campaign_id || '');
  const guest_ids   = Array.isArray(body?.guest_ids) ? (body.guest_ids as unknown[]).map(String) : [];
  const send_at     = body?.send_at ? new Date(body.send_at).toISOString() : null;
  if (!campaign_id || guest_ids.length === 0) {
    return NextResponse.json({ ok: false, error: 'campaign_id + guest_ids required' }, { status: 400 });
  }
  if (guest_ids.length > 5000) {
    return NextResponse.json({ ok: false, error: 'max 5000 recipients per schedule' }, { status: 400 });
  }
  const sb = getSupabaseAdmin();
  const { data, error } = await sb.schema('guest').rpc('fn_schedule_campaign', {
    p_campaign_id: campaign_id,
    p_guest_ids:   guest_ids,
    p_send_at:     send_at,
  });
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
