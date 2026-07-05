// app/api/marketing/sequences/action/route.ts
// PBS 2026-07-05: dispatch for sequence lifecycle actions (activate/halt/revert/enroll).
import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const RPCS = new Set([
  'fn_sequence_activate',
  'fn_sequence_bulk_enroll_by_tag',
  'fn_sequence_seed_from_ai',
]);
const SCHEMA_RPCS: Record<string, string> = {
  fn_halt_funnel: 'prospects',
  fn_revert_funnel_to_draft: 'prospects',
  fn_enroll_subscriber: 'prospects',
};

export async function POST(req: Request) {
  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return NextResponse.json({ ok:false, error:'invalid_json' }, { status:400 }); }
  const rpc = String(body.rpc ?? '');
  const payload: Record<string, unknown> = { ...body };
  delete payload.rpc;

  const sb = getSupabaseAdmin();

  if (RPCS.has(rpc)) {
    const { data, error } = await sb.rpc(rpc, payload);
    if (error) return NextResponse.json({ ok:false, error: error.message }, { status:500 });
    return NextResponse.json(data);
  }
  if (rpc in SCHEMA_RPCS) {
    const { data, error } = await sb.schema(SCHEMA_RPCS[rpc]).rpc(rpc, payload);
    if (error) return NextResponse.json({ ok:false, error: error.message }, { status:500 });
    return NextResponse.json(data);
  }
  return NextResponse.json({ ok:false, error:'unknown_rpc' }, { status:400 });
}
