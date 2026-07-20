// app/api/sales/proposals/[id]/lock/route.ts
// PBS 2026-07-20 pm · item #6 · toggle lock on a proposal.
// Body: { lock: boolean }.
// Wraps SECURITY DEFINER RPC public.fn_proposal_toggle_lock which sets/clears
// sales.proposals.locked_at + locked_by. Locking is a soft UI signal today —
// server-side write guards can be added on top of this column later.

import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface Ctx { params: { id: string } }

export async function POST(req: Request, { params }: Ctx) {
  const body = await req.json().catch(() => ({}));
  const lock = body?.lock === true;

  const sb = getSupabaseAdmin();
  const { data, error } = await sb.rpc('fn_proposal_toggle_lock', {
    p_proposal_id: params.id,
    p_lock: lock,
  });

  if (error) {
    return NextResponse.json({ error: 'toggle_failed', message: error.message }, { status: 500 });
  }
  const row = Array.isArray(data) ? data[0] : data;
  return NextResponse.json({ ok: true, locked_at: row?.locked_at ?? null, locked_by: row?.locked_by ?? null });
}
