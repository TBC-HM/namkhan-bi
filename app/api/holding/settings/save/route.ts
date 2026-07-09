// app/api/holding/settings/save/route.ts
// PBS 2026-07-09: writes to holding.settings via fn_holding_settings_save
// SECURITY DEFINER RPC (non-public schema — direct .from().update() would
// silently no-op per PostgREST public-only exposure).
import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const key   = String(body.key ?? '').trim();
    const value = body.value ?? {};
    if (!key) return NextResponse.json({ error: 'key required' }, { status: 400 });
    if (typeof value !== 'object' || Array.isArray(value)) {
      return NextResponse.json({ error: 'value must be an object' }, { status: 400 });
    }
    const sb = getSupabaseAdmin();
    const { error } = await sb.rpc('fn_holding_settings_save', {
      p_key: key,
      p_value: value,
      p_updated_by: 'pbs',
    });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
