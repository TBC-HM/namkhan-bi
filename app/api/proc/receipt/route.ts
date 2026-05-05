// POST /api/proc/receipt
// Records goods inwards on a PO line.
// Inserts proc.receipts + inv.movement (type='receive') + updates po_items + maybe closes PO.
// Stock balance + items.last_unit_cost auto-update via trigger.
// Used by: Page 5 Receipt modal.

import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface ReceiptInput {
  po_id: string;
  po_item_id: number;
  received_qty: number;
  unit_cost_usd?: number | null;
  unit_cost_lak?: number | null;
  fx_rate_used?: number | null;
  batch_code?: string | null;
  expiry_date?: string | null;
  quality_check_passed?: boolean;
  rejected_qty?: number;
  rejection_reason?: string | null;
  notes?: string | null;
}

export async function POST(req: Request) {
  let admin;
  try { admin = getSupabaseAdmin(); }
  catch (e: any) { return NextResponse.json({ error: e.message }, { status: 500 }); }

  let b: ReceiptInput;
  try { b = await req.json(); }
  catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }

  if (!b.po_id || !b.po_item_id || !b.received_qty || b.received_qty <= 0) {
    return NextResponse.json({ error: 'po_id, po_item_id, received_qty (>0) required' }, { status: 400 });
  }

  // Read PO + line for context (vendor_id, item_id, location)
  const { data: po, error: poErr } = await admin
    .schema('proc')
    .from('purchase_orders')
    .select('po_id, vendor_id, delivery_location_id, status')
    .eq('po_id', b.po_id)
    .maybeSingle();
  if (poErr || !po) return NextResponse.json({ error: poErr?.message ?? 'PO not found' }, { status: 404 });
  if (!po.delivery_location_id) {
    return NextResponse.json({ error: 'PO has no delivery_location_id; cannot receive' }, { status: 400 });
  }

  const { data: line, error: lErr } = await admin
    .schema('proc')
    .from('po_items')
    .select('po_item_id, item_id, quantity_ordered, quantity_received, unit_cost_usd, unit_cost_lak, fx_rate_used')
    .eq('po_item_id', b.po_item_id)
    .maybeSingle();
  if (lErr || !line) return NextResponse.json({ error: lErr?.message ?? 'PO line not found' }, { status: 404 });

  // 1. Insert inv.movement (trigger handles stock_balance + items.last_unit_cost)
  const { data: mov, error: mErr } = await admin
    .schema('inv')
    .from('movements')
    .insert({
      item_id: line.item_id,
      location_id: po.delivery_location_id,
      movement_type: 'receive',
      quantity: b.received_qty,
      unit_cost_usd: b.unit_cost_usd ?? line.unit_cost_usd ?? null,
      unit_cost_lak: b.unit_cost_lak ?? line.unit_cost_lak ?? null,
      fx_rate_used: b.fx_rate_used ?? line.fx_rate_used ?? null,
      total_cost_usd: (b.unit_cost_usd ?? line.unit_cost_usd ?? 0) ? b.received_qty * (b.unit_cost_usd ?? line.unit_cost_usd ?? 0) : null,
      total_cost_lak: (b.unit_cost_lak ?? line.unit_cost_lak ?? 0) ? b.received_qty * (b.unit_cost_lak ?? line.unit_cost_lak ?? 0) : null,
      vendor_id: po.vendor_id,
      reference_type: 'po',
      reference_id: po.po_id,
      batch_code: b.batch_code ?? null,
      expiry_date: b.expiry_date ?? null,
      notes: b.notes ?? null,
    })
    .select('movement_id')
    .maybeSingle();
  if (mErr || !mov) return NextResponse.json({ error: mErr?.message ?? 'Insert movement failed' }, { status: 500 });

  // 2. Insert proc.receipts row, link to movement
  const { error: rcErr } = await admin
    .schema('proc')
    .from('receipts')
    .insert({
      po_id: po.po_id,
      po_item_id: b.po_item_id,
      received_qty: b.received_qty,
      batch_code: b.batch_code ?? null,
      expiry_date: b.expiry_date ?? null,
      quality_check_passed: b.quality_check_passed ?? null,
      rejected_qty: b.rejected_qty ?? 0,
      rejection_reason: b.rejection_reason ?? null,
      movement_id: mov.movement_id,
      notes: b.notes ?? null,
    });
  if (rcErr) return NextResponse.json({ error: rcErr.message }, { status: 500 });

  // 3. Update po_items.quantity_received
  const newReceived = Number(line.quantity_received ?? 0) + Number(b.received_qty);
  await admin
    .schema('proc')
    .from('po_items')
    .update({ quantity_received: newReceived })
    .eq('po_item_id', b.po_item_id);

  // 4. Check whether all lines are fully received → mark PO 'received'
  const { data: allLines } = await admin
    .schema('proc')
    .from('po_items')
    .select('quantity_ordered, quantity_received')
    .eq('po_id', po.po_id);
  const allReceived = (allLines ?? []).every(
    (ln: any) => Number(ln.quantity_received ?? 0) >= Number(ln.quantity_ordered ?? 0),
  );
  if (allReceived && po.status !== 'received' && po.status !== 'invoiced' && po.status !== 'closed') {
    await admin.schema('proc').from('purchase_orders').update({ status: 'received' }).eq('po_id', po.po_id);
  } else if (Number(b.received_qty) > 0 && po.status === 'sent') {
    await admin.schema('proc').from('purchase_orders').update({ status: 'partially_received' }).eq('po_id', po.po_id);
  }

  return NextResponse.json({ ok: true, movement_id: mov.movement_id });
}
