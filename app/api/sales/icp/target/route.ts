// app/api/sales/icp/target/route.ts — Set target share per ICP (A6)
// Writes via public.fn_icp_target_update (SECURITY DEFINER bridge).
// claude_md §0.5: sales.* is not PostgREST-reachable — a direct
// .from('icp_segments') resolves against public and 500s. RPC bridge only.
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const sb = getSupabaseAdmin();
  const body = await req.json().catch(() => ({})) as { icp_key?: string; target_share_pct?: number | null };

  if (!body.icp_key || body.target_share_pct === undefined) {
    return NextResponse.json({ error: 'missing icp_key or target_share_pct' }, { status: 400 });
  }

  if (body.target_share_pct !== null && (body.target_share_pct < 0 || body.target_share_pct > 100)) {
    return NextResponse.json({ error: 'target_share_pct must be 0-100 (or null to clear)' }, { status: 400 });
  }

  // Bridge fn updates sales.icp_segments.target_share_pct AND writes the
  // cockpit_audit_log row (metadata column) in one transaction.
  const { data, error } = await sb.rpc('fn_icp_target_update', {
    p_icp_key: body.icp_key,
    p_target_share_pct: body.target_share_pct,
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
