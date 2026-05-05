// POST /api/proc/proposal
// Creates proc.new_item_proposals row. Used by: Page 3 Shop "Propose new item" modal.

import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface ProposalInput {
  proposed_name: string;
  proposed_description?: string | null;
  category_id?: number | null;
  uom_id?: number | null;
  estimated_unit_cost_usd?: number | null;
  likely_vendor_id?: string | null;
  expected_monthly_usage?: number | null;
  justification: string;
  origin_pr_id?: string | null;
}

export async function POST(req: Request) {
  let admin;
  try { admin = getSupabaseAdmin(); }
  catch (e: any) { return NextResponse.json({ error: e.message }, { status: 500 }); }

  let body: ProposalInput;
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }

  if (!body.proposed_name || !body.justification) {
    return NextResponse.json({ error: 'proposed_name + justification required' }, { status: 400 });
  }

  const { data, error } = await admin
    .schema('proc')
    .from('new_item_proposals')
    .insert({
      proposed_name: body.proposed_name,
      proposed_description: body.proposed_description ?? null,
      category_id: body.category_id ?? null,
      uom_id: body.uom_id ?? null,
      estimated_unit_cost_usd: body.estimated_unit_cost_usd ?? null,
      likely_vendor_id: body.likely_vendor_id ?? null,
      expected_monthly_usage: body.expected_monthly_usage ?? null,
      justification: body.justification,
      origin_pr_id: body.origin_pr_id ?? null,
      status: 'pending_review',
    })
    .select('proposal_id')
    .maybeSingle();
  if (error || !data) return NextResponse.json({ error: error?.message ?? 'Insert failed' }, { status: 500 });
  return NextResponse.json({ ok: true, proposal_id: data.proposal_id });
}
