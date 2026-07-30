// POST /api/inv/count/post
// Approves a submitted stock count and posts its lines as inv.movements via
// public.fn_inv_count_post (SECURITY DEFINER).
//   - count_type='opening'  → posts the FULL counted_quantity (open_stock, reason 'opening')
//   - other count types     → posts only the variance (count_correction, reason 'count_variance')
// Segregation of duties: the RPC rejects approval when the approver's
// deterministic uuid equals counts.counted_by.
// Used by: /h/[pid]/operations/inventory/counts approve buttons.

import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface PostInput {
  count_id: string;
  approved_by_name: string;
}

export async function POST(req: Request) {
  let admin;
  try { admin = getSupabaseAdmin(); }
  catch (e: any) { return NextResponse.json({ error: e.message }, { status: 500 }); }

  let body: PostInput;
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }

  if (!body.count_id || !body.approved_by_name?.trim()) {
    return NextResponse.json({ error: 'count_id + approved_by_name required' }, { status: 400 });
  }

  const { data, error } = await admin.rpc('fn_inv_count_post', {
    p_count_id: body.count_id,
    p_approved_by_name: body.approved_by_name.trim(),
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  return NextResponse.json({ ok: true, result: data });
}
