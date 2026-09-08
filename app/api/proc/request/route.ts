// POST /api/proc/request
// Creates procurement.requests + request_items + invokes proc_pr_submit RPC for routing.
// Used by: HOD Shop cart submit (app/operations/inventory/_components/ShopCart.tsx).
//
// 2026-09-09 REPAIR (inventory buying-side, ADR-310):
//   procurement.requests.property_id is NOT NULL with no default, and this route
//   never sent it -> EVERY submit died on 23502 "null value in column property_id"
//   before the routing RPC was ever reached. The route now requires an explicit
//   property_id in the body (ADR-300/302: no silent COALESCE to 260955) and
//   rejects a $0 basket up front instead of letting proc_pr_submit raise after
//   the header row has already been written.

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
  property_id: number;
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
  catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'admin client failed' }, { status: 500 });
  }

  let body: PrInput;
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }

  // ADR-300/302: tenant scope is explicit or the request is refused.
  const propertyId = Number(body.property_id);
  if (!Number.isFinite(propertyId) || propertyId <= 0) {
    return NextResponse.json(
      { error: 'property_id required (ADR-300: no default tenant)' }, { status: 400 });
  }

  if (!body.pr_title || !Array.isArray(body.lines) || body.lines.length === 0) {
    return NextResponse.json({ error: 'pr_title + non-empty lines required' }, { status: 400 });
  }
  for (const l of body.lines) {
    if (!l.item_id || l.quantity == null || Number(l.quantity) <= 0) {
      return NextResponse.json({ error: 'each line needs item_id and quantity > 0' }, { status: 400 });
    }
  }

  // proc_pr_submit refuses a $0 basket. Fail here with a usable message rather
  // than letting the RPC raise after the header row is already written.
  const estTotal = body.lines.reduce(
    (s, l) => s + Number(l.quantity) * (Number(l.unit_cost_usd) || 0), 0);
  if (!(estTotal > 0)) {
    return NextResponse.json(
      { error: 'Request total is $0 - enter an estimated unit cost on at least one line.' },
      { status: 400 });
  }

  // 1. Insert PR header (status='draft' until proc_pr_submit lifts it)
  const { data: pr, error: pErr } = await admin
    .schema('procurement')
    .from('requests')
    .insert({
      property_id: propertyId,
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
  if (pErr || !pr) {
    return NextResponse.json({ error: pErr?.message ?? 'Insert header failed' }, { status: 500 });
  }

  // 2. Insert lines. total_usd / total_lak are GENERATED columns - never send them.
  const lines = body.lines.map((l) => ({
    pr_id: pr.pr_id,
    item_id: l.item_id,
    quantity: Number(l.quantity),
    unit_cost_usd: l.unit_cost_usd != null ? Number(l.unit_cost_usd) : null,
    unit_cost_lak: l.unit_cost_lak != null ? Number(l.unit_cost_lak) : null,
    preferred_supplier_id: l.preferred_supplier_id ?? null,
  }));
  const { error: lErr } = await admin.schema('procurement').from('request_items').insert(lines);
  if (lErr) return NextResponse.json({ error: lErr.message, pr_id: pr.pr_id }, { status: 500 });

  // 3. Submit + auto-route via RPC -> 'auto_approved' | 'pending_gm' | 'pending_owner'
  const { data: status, error: rpcErr } = await admin
    .schema('procurement')
    .rpc('proc_pr_submit', { p_pr_id: pr.pr_id });
  if (rpcErr) return NextResponse.json({ error: rpcErr.message, pr_id: pr.pr_id }, { status: 500 });

  return NextResponse.json({ ok: true, pr_id: pr.pr_id, approval_status: status });
}
