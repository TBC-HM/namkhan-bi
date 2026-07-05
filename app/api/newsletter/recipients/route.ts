// app/api/newsletter/recipients/route.ts
// PBS 2026-07-05: list recipients for a campaign + remove one.
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const campaign_id = url.searchParams.get('campaign_id');
  if (!campaign_id) return NextResponse.json({ ok: false, error: 'campaign_id required' }, { status: 400 });
  const sb = getSupabaseAdmin();
  const { data, error } = await sb.schema('guest').from('campaign_recipients')
    .select('guest_id, full_name, email, country, send_status, send_at, sent_at, error, unsubscribed_at')
    .eq('campaign_id', campaign_id)
    .order('send_status')
    .order('snapshot_at', { ascending: false })
    .limit(500);
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, recipients: data || [] });
}

export async function DELETE(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const campaign_id = String(body?.campaign_id || '');
  const guest_id    = String(body?.guest_id    || '');
  if (!campaign_id || !guest_id) return NextResponse.json({ ok: false, error: 'campaign_id + guest_id required' }, { status: 400 });
  const sb = getSupabaseAdmin();
  const { data, error } = await sb.schema('guest').rpc('fn_remove_recipient', {
    p_campaign_id: campaign_id, p_guest_id: guest_id,
  });
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
