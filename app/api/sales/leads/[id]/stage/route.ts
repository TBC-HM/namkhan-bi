// app/api/sales/leads/[id]/stage/route.ts
// POST { stage_key, reason? } → public.fn_lead_set_stage(p_lead_id, p_stage_key, p_reason)
// Any valid stage_key from sales.pipeline_stages is accepted; the RPC validates.
import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const id = parseInt(params.id, 10);
  if (!Number.isFinite(id)) return NextResponse.json({ error: 'invalid id' }, { status: 400 });
  let body: { stage_key?: string; reason?: string };
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: 'invalid_json' }, { status: 400 }); }
  const stage_key = String(body.stage_key ?? '').trim();
  if (!stage_key) return NextResponse.json({ error: 'stage_key required' }, { status: 400 });
  try {
    const sb = getSupabaseAdmin();
    const { data, error } = await sb.rpc('fn_lead_set_stage', {
      p_lead_id: id, p_stage_key: stage_key, p_reason: body.reason ?? null,
    });
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ ok: true, ...(data as Record<string, unknown>) });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
