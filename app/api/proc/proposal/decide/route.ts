// POST /api/proc/proposal/decide
// Approve → INSERT inv.items + UPDATE proc.new_item_proposals
// Reject  → UPDATE proc.new_item_proposals
// Used by: Page 6 Catalog Admin.

import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface ProposalDecideInput {
  proposal_id: string;
  decision: 'approve' | 'reject' | 'more_info_needed';
  reviewer_notes?: string | null;
  // Approve-only:
  sku?: string;
  default_location_id?: number | null;
}

export async function POST(req: Request) {
  let admin;
  try { admin = getSupabaseAdmin(); }
  catch (e: any) { return NextResponse.json({ error: e.message }, { status: 500 }); }

  let body: ProposalDecideInput;
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }

  if (!body.proposal_id || !body.decision) {
    return NextResponse.json({ error: 'proposal_id + decision required' }, { status: 400 });
  }
  if (!['approve', 'reject', 'more_info_needed'].includes(body.decision)) {
    return NextResponse.json({ error: 'invalid decision' }, { status: 400 });
  }

  // Reject / more_info_needed — just update proposal
  if (body.decision !== 'approve') {
    const { error } = await admin
      .schema('procurement')
      .from('new_item_proposals')
      .update({
        status: body.decision === 'reject' ? 'rejected' : 'more_info_needed',
        reviewer_notes: body.reviewer_notes ?? null,
        reviewed_at: new Date().toISOString(),
      })
      .eq('proposal_id', body.proposal_id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, decision: body.decision });
  }

  // Approve flow: read proposal, create item, link back
  const { data: prop, error: rErr } = await admin
    .schema('procurement')
    .from('new_item_proposals')
    .select('*')
    .eq('proposal_id', body.proposal_id)
    .maybeSingle();
  if (rErr || !prop) return NextResponse.json({ error: rErr?.message ?? 'proposal not found' }, { status: 404 });
  if (!body.sku) return NextResponse.json({ error: 'sku required for approve' }, { status: 400 });
  if (!prop.category_id || !prop.uom_id) {
    return NextResponse.json({ error: 'proposal must have category_id and uom_id before approval' }, { status: 400 });
  }

  const { data: item, error: iErr } = await admin
    .schema('inv')
    .from('items')
    .insert({
      sku: body.sku,
      item_name: prop.proposed_name,
      description: prop.proposed_description ?? null,
      category_id: prop.category_id,
      uom_id: prop.uom_id,
      primary_vendor_id: prop.likely_vendor_id ?? null,
      last_unit_cost_usd: prop.estimated_unit_cost_usd ?? null,
      default_location_id: body.default_location_id ?? null,
      catalog_status: 'approved',
      catalog_approved_at: new Date().toISOString(),
      is_active: true,
    })
    .select('item_id')
    .maybeSingle();
  if (iErr || !item) return NextResponse.json({ error: iErr?.message ?? 'Insert item failed' }, { status: 500 });

  await admin
    .schema('procurement')
    .from('new_item_proposals')
    .update({
      status: 'approved',
      reviewed_at: new Date().toISOString(),
      approved_item_id: item.item_id,
      reviewer_notes: body.reviewer_notes ?? null,
    })
    .eq('proposal_id', body.proposal_id);

  return NextResponse.json({ ok: true, item_id: item.item_id, decision: 'approve' });
}
