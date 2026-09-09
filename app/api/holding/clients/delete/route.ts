// app/api/holding/clients/delete/route.ts
// PBS 2026-07-09: soft-delete (deactivate) a holding client.
import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { requireHoldingFromRequest } from '@/lib/holding/guard';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  // Holding gate. Middleware 403s /holding/* pages but NOT /api/holding/*, so
  // without this any signed-in tenant user reaches this route. Fails closed.
  const _gate = await requireHoldingFromRequest(req);
  if (!_gate.ok) return NextResponse.json({ error: _gate.message }, { status: _gate.status });

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
