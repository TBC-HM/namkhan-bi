// app/api/sales/icp/criteria/route.ts — Update ICP matching criteria (A2)
// Writes via public.fn_icp_criteria_update (SECURITY DEFINER bridge).
// claude_md §0.5: sales.* is not PostgREST-reachable — a direct
// .from('icp_segments') resolves against public and 500s. RPC bridge only.
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const sb = getSupabaseAdmin();
  const body = await req.json().catch(() => ({})) as { icp_key?: string; criteria?: Record<string, unknown> };

  if (!body.icp_key || !body.criteria) {
    return NextResponse.json({ error: 'missing icp_key or criteria' }, { status: 400 });
  }

  // Bridge fn updates sales.icp_segments.criteria AND writes the
  // cockpit_audit_log row (metadata column) in one transaction.
  const { data, error } = await sb.rpc('fn_icp_criteria_update', {
    p_icp_key: body.icp_key,
    p_criteria: body.criteria,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const res = data as { ok?: boolean; error?: string; updated_count?: number } | null;
  if (!res?.ok) {
    return NextResponse.json({ error: res?.error ?? 'update failed' }, { status: 400 });
  }

  return NextResponse.json({ ok: true, updated_count: res.updated_count ?? 0 });
}
