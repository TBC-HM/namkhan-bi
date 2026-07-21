// app/api/marketing/newsletter/campaign-detail/route.ts
// PBS 2026-07-22 · Fetch a campaign's subject/body/hero for the SlotPreviewDrawer.
// GET ?id=UUID → { ok, data: { subject, body_md, hero_asset_id, hero_public_url } }

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const id = req.nextUrl.searchParams.get('id');
    if (!id) return NextResponse.json({ ok: false, error: 'id required' }, { status: 400 });
    const sb = getSupabaseAdmin();
    const { data, error } = await sb.from('v_guest_campaigns')
      .select('campaign_id, subject, body_md, hero_asset_id')
      .eq('campaign_id', id).maybeSingle();
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    if (!data) return NextResponse.json({ ok: false, error: 'not found' }, { status: 404 });

    let hero_public_url: string | null = null;
    if ((data as any).hero_asset_id) {
      const r = await sb.rpc('fn_asset_public_url', { p_asset_id: (data as any).hero_asset_id });
      hero_public_url = (r.data as string | null) ?? null;
    }
    return NextResponse.json({ ok: true, data: { ...data, hero_public_url } });
  } catch (e) {
    return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 500 });
  }
}
