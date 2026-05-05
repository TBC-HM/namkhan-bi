// POST /api/proc/request
// Creates proc.requests + request_items + invokes proc_pr_submit RPC for routing.
// Used by: Page 3 Shop submit.

import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface PrLine {
  item_id: string;
  quantity: number;
  unit_cost_usd?: number | null;
  unit_cost_lak?: number | null;
  preferred_supplier_id?: string | null;
}

interface PrInput {
  pr_title: string;
  requesting_dept?: string | null;
  delivery_location_id?: number | null;
  needed_by_date?: string | null;
  priority?: 'low' | 'normal' | 'high' | 'urgent';
  business_justification?: string | null;
  lines: PrLine[];
}

export async function POST(req: Request) {
  let admin;
  try { admin = getSupabaseAdmin(); }
  catch (e: any) { return NextResponse.json({ error: e.message }, { status: 500 }); }

  let body: PrInput;
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }

  if (!body.pr_title || !Array.isArray(body.lines) || body.lines.length === 0) {
    return NextResponse.json({ error: 'pr_title + non-empty lines required' }, { status: 400 });
  }
  for (const l of body.lines) {
    if (!l.item_id || l.quantity == null || Number(l.quantity) <= 0) {
      return NextResponse.json({ error: 'each line needs item_id and quantity > 0' }, { status: 400 });
    }
  }

  // 1. Insert PR header (status='draft' until proc_pr_submit lifts it)
  const { data: pr, error: pErr } = await admin
    .schema('proc')
    .from('requests')
    .insert({
      pr_title: body.pr_title,
      requesting_dept: body.requesting_dept ?? null,
      delivery_location_id: body.delivery_location_id ?? null,
      needed_by_date: body.needed_by_date ?? null,
      priority: body.priority ?? 'normal',
      business_justification: body.business_justification ?? null,
      status: 'draft',
    })
    .select('pr_id')
    .maybeSingle();
  if (pErr || !pr) return NextResponse.json({ error: pErr?.message ?? 'Insert header failed' }, { status: 500 });

  // 2. Insert lines
  const lines = body.lines.map((l) => ({
    pr_id: pr.pr_id,
    item_id: l.item_id,
    quantity: Number(l.quantity),
    unit_cost_usd: l.unit_cost_usd != null ? Number(l.unit_cost_usd) : null,
    unit_cost_lak: l.unit_cost_lak != null ? Number(l.unit_cost_lak) : null,
    preferred_supplier_id: l.preferred_supplier_id ?? null,
  }));
  const { error: lErr } = await admin.schema('proc').from('request_items').insert(lines);
  if (lErr) return NextResponse.json({ error: lErr.message, pr_id: pr.pr_id }, { status: 500 });

  // 3. Submit + auto-route via RPC (returns 'auto_approved' | 'pending_gm' | 'pending_owner')
  const { data: status, error: rpcErr } = await admin
    .schema('proc')
    .rpc('proc_pr_submit', { p_pr_id: pr.pr_id });
  if (rpcErr) return NextResponse.json({ error: rpcErr.message, pr_id: pr.pr_id }, { status: 500 });

  return NextResponse.json({ ok: true, pr_id: pr.pr_id, approval_status: status });
}
