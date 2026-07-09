// app/api/holding/clients/delete/route.ts
// PBS 2026-07-09: soft-delete (deactivate) a holding client.
import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const { id } = await req.json() as { id: number };
    if (!Number.isFinite(Number(id))) return NextResponse.json({ error: 'id required' }, { status: 400 });
    const sb = getSupabaseAdmin();
    const { error } = await sb.rpc('fn_holding_client_delete', { p_id: Number(id) });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
