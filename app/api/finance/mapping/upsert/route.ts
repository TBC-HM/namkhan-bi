// POST /api/finance/mapping/upsert
// Apply or change a USALI class assignment for a chart-of-accounts account.
// Calls gl.set_account_class(p_account_id, p_class_id, p_note, p_set_by) which:
//   1. upserts gl.account_class_override
//   2. reclassifies all gl_entries for that account currently in 'not_specified'
//   3. refreshes gl.mv_usali_pl_monthly
// Body: { account_id: string, class_id: string, note?: string }

import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const VALID_CLASS = new Set([
  'rooms', 'fb', 'spa', 'activities', 'imekong', 'retail', 'transport',
  'undistributed', 'not_specified',
]);

export async function POST(req: Request) {
  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid json body' }, { status: 400 });
  }

  const account_id = String(body?.account_id ?? '').trim();
  const class_id = String(body?.class_id ?? '').trim();
  const note = body?.note ? String(body.note).slice(0, 500) : null;

  if (!account_id) return NextResponse.json({ error: 'account_id required' }, { status: 400 });
  if (!VALID_CLASS.has(class_id)) {
    return NextResponse.json({ error: `invalid class_id: ${class_id}` }, { status: 400 });
  }

  let admin;
  try {
    admin = getSupabaseAdmin();
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? 'admin client init failed' }, { status: 500 });
  }

  const { data, error } = await admin.schema('gl').rpc('set_account_class', {
    p_account_id: account_id,
    p_class_id: class_id,
    p_note: note,
    p_set_by: 'accountant',
  });

  if (error) {
    return NextResponse.json({ error: error.message, details: error.details }, { status: 500 });
  }

  return NextResponse.json({ ok: true, rows_reclassified: data ?? 0 });
}
