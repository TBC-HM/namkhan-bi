// app/api/sales/leads/[id]/advance/route.ts
// POST { reason? } → public.fn_lead_advance_stage(p_lead_id, p_reason)
// Only advances new→contacted, contacted→engaged. Higher stages are no-ops.
import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const id = parseInt(params.id, 10);
  if (!Number.isFinite(id)) return NextResponse.json({ error: 'invalid id' }, { status: 400 });
  let body: { reason?: string } = {};
  try { body = await req.json(); } catch { body = {}; }
  try {
    const sb = getSupabaseAdmin();
    const { data, error } = await sb.rpc('fn_lead_advance_stage', {
      p_lead_id: id, p_reason: body.reason ?? null,
    });
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ ok: true, ...(data as Record<string, unknown>) });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
