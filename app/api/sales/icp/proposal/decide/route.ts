// app/api/sales/icp/proposal/decide/route.ts — Approve/reject proposals (A7)
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const sbAdmin = getSupabaseAdmin();
  const sbUser = await createClient();
  const { data: { user } } = await sbUser.auth.getUser();
  
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json().catch(() => ({})) as { id?: number; status?: string };
  
  if (!body.id || !body.status) {
    return NextResponse.json({ error: 'missing id or status' }, { status: 400 });
  }

  if (!['approved', 'rejected'].includes(body.status)) {
    return NextResponse.json({ error: 'status must be approved or rejected' }, { status: 400 });
  }

  // Call the bridge function
  const { data, error } = await sbAdmin.rpc('fn_icp_proposal_decide', {
    p_id: body.id,
    p_status: body.status,
    p_decided_by: user.email || user.id,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, result: data });
}
