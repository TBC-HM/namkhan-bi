// app/api/marketing/media-action/route.ts
// PBS 2026-07-05: delete asset, change tier, or email-share a media asset.
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const action = String(body?.action || '');
  const sb = getSupabaseAdmin();

  if (action === 'delete') {
    const asset_id = String(body?.asset_id || '');
    if (!asset_id) return NextResponse.json({ ok: false, error: 'asset_id required' }, { status: 400 });
    const { data, error } = await sb.rpc('fn_media_delete_asset', { p_asset_id: asset_id });
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    return NextResponse.json(data);
  }

  if (action === 'set-tier') {
    const asset_id = String(body?.asset_id || '');
    const tier = String(body?.tier || '');
    if (!asset_id || !tier) return NextResponse.json({ ok: false, error: 'asset_id + tier required' }, { status: 400 });
    const { data, error } = await sb.rpc('fn_media_set_tier', { p_asset_id: asset_id, p_tier: tier });
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    return NextResponse.json(data);
  }

  if (action === 'email-share') {
    const to_email = String(body?.to_email || '').trim().toLowerCase();
    const urls: string[] = Array.isArray(body?.urls) ? body.urls.map(String) : [];
    const note = String(body?.note || '');
    if (!to_email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to_email) || urls.length === 0) {
      return NextResponse.json({ ok: false, error: 'valid to_email + urls[] required' }, { status: 400 });
    }
    const { data: tokenData } = await sb.rpc('fn_get_newsletter_cron_token');
    const cronToken: string = (tokenData as unknown as string) || '';
    const { data, error } = await sb.functions.invoke('send-media-share', {
      body: { to_email, urls, note },
      headers: cronToken ? { 'x-cron-token': cronToken } : undefined,
    });
    if (error) return NextResponse.json({ ok: false, error: (error as { message?: string })?.message || 'invoke_failed' }, { status: 502 });
    return NextResponse.json(data);
  }

  return NextResponse.json({ ok: false, error: 'unknown action' }, { status: 400 });
}
