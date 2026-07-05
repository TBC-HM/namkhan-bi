// app/api/marketing/prospects/action/route.ts
// PBS 2026-07-05: dispatch to public fn_prospect_* RPCs.
import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const ALLOWED = new Set([
  'fn_prospect_toggle_pin',
  'fn_prospect_delete',
  'fn_prospect_bulk_delete',
  'fn_prospect_add_tag',
  'fn_prospect_remove_tag',
  'fn_prospect_bulk_add_tag',
]);

export async function POST(req: Request) {
  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return NextResponse.json({ ok:false, error:'invalid_json' }, { status:400 }); }
  const rpc = String(body.rpc ?? '');
  if (!ALLOWED.has(rpc)) return NextResponse.json({ ok:false, error:'unknown_rpc' }, { status:400 });

  const payload: Record<string, unknown> = { ...body };
  delete payload.rpc;

  const sb = getSupabaseAdmin();
  const { data, error } = await sb.rpc(rpc, payload);
  if (error) return NextResponse.json({ ok:false, error: error.message }, { status:500 });
  return NextResponse.json(data);
}
