// app/api/media/asset-url/route.ts
// PBS 2026-07-22 · Resolve a media asset uuid to its public URL via fn_asset_public_url.
// GET ?asset_id=UUID → { asset_id, public_url }

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const id = req.nextUrl.searchParams.get('asset_id');
    if (!id) return NextResponse.json({ error: 'asset_id required' }, { status: 400 });
    const sb = getSupabaseAdmin();
    const { data, error } = await sb.rpc('fn_asset_public_url', { p_asset_id: id });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ asset_id: id, public_url: data ?? null });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
