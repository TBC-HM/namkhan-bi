// app/api/sales/icp/target/route.ts — Set target share per ICP (A6)
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const sb = getSupabaseAdmin();
  const body = await req.json().catch(() => ({})) as { icp_key?: string; target_share_pct?: number };
  
  if (!body.icp_key || body.target_share_pct === undefined) {
    return NextResponse.json({ error: 'missing icp_key or target_share_pct' }, { status: 400 });
  }

  if (body.target_share_pct < 0 || body.target_share_pct > 100) {
    return NextResponse.json({ error: 'target_share_pct must be 0-100' }, { status: 400 });
  }

  // Update target_share_pct in sales.icp_segments
  const { error } = await sb
    .from('icp_segments')
    .update({ target_share_pct: body.target_share_pct })
    .eq('key', body.icp_key);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Log to audit
  await sb.from('cockpit_audit_log').insert({
    action: 'icp_target_updated',
    details: { icp_key: body.icp_key, target_share_pct: body.target_share_pct },
  });

  return NextResponse.json({ ok: true });
}
