// app/api/sales/icp/criteria/route.ts — Update ICP matching criteria (A2)
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

  // Update criteria column in sales.icp_segments
  const { error } = await sb
    .from('icp_segments')
    .update({ criteria: body.criteria })
    .eq('key', body.icp_key);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Log to audit
  await sb.from('cockpit_audit_log').insert({
    action: 'icp_criteria_updated',
    details: { icp_key: body.icp_key, new_criteria: body.criteria },
  });

  return NextResponse.json({ ok: true });
}
