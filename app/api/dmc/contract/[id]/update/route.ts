// app/api/dmc/contract/[id]/update/route.ts
// POST { patch: { ... } } — updates whitelist columns on governance.dmc_contracts
// via SECURITY DEFINER RPC public.fn_dmc_contract_update.

import { NextResponse, type NextRequest } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  let body: { patch?: Record<string, unknown> };
  try { body = await req.json(); }
  catch { return NextResponse.json({ ok: false, error: 'invalid json' }, { status: 400 }); }

  if (!body?.patch || typeof body.patch !== 'object') {
    return NextResponse.json({ ok: false, error: 'patch object required' }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();
  const { error } = await supabase.rpc('fn_dmc_contract_update', {
    p_contract_id: params.id,
    p_patch: body.patch,
  });

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
