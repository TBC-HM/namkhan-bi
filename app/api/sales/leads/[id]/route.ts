// PATCH/DELETE /api/sales/leads/:id
// Inline status flips + edits from the leads queue.
// PBS 2026-05-09.

import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { PROPERTY_ID } from '@/lib/supabase';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const PATCHABLE = new Set([
  'company_name','category','subcategory','country','city','language','website',
  'instagram_url','decision_maker_name','decision_maker_role','email','phone_whatsapp',
  'retreat_history','upcoming_retreat_signal','audience_size_proxy','price_level',
  'icp_score','intent_score','final_priority','status','notes','prospect_id',
]);

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const id = parseInt(params.id, 10);
  if (!Number.isFinite(id)) return NextResponse.json({ error: 'invalid id' }, { status: 400 });
  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'invalid json' }, { status: 400 }); }

  const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
  for (const [k, v] of Object.entries(body)) {
    if (PATCHABLE.has(k)) update[k] = v;
  }
  if (Object.keys(update).length === 1) {
    return NextResponse.json({ error: 'no patchable fields' }, { status: 400 });
  }

  const sb = getSupabaseAdmin();
  const { data, error } = await sb.schema('sales').from('leads')
    .update(update).eq('id', id).eq('property_id', PROPERTY_ID)
    .select('*').single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, lead: data });
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const id = parseInt(params.id, 10);
  if (!Number.isFinite(id)) return NextResponse.json({ error: 'invalid id' }, { status: 400 });
  const sb = getSupabaseAdmin();
  const { error } = await sb.schema('sales').from('leads')
    .delete().eq('id', id).eq('property_id', PROPERTY_ID);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
