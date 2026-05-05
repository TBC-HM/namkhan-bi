// POST /api/inv/movement
// Creates an inv.movement row. Triggers update stock_balance + items.last_unit_cost.
// Used by: Item-detail Adjust-count / Move-stock / Mark-write-off modals.

import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const VALID_TYPES = new Set([
  'receive', 'issue', 'consume', 'transfer_in', 'transfer_out',
  'count_correction', 'write_off', 'waste', 'open_stock',
]);

interface MovementInput {
  item_id: string;
  location_id: number;
  movement_type: string;
  quantity: number;
  unit_cost_usd?: number | null;
  unit_cost_lak?: number | null;
  fx_rate_used?: number | null;
  vendor_id?: string | null;
  counterparty_location_id?: number | null;
  reference_type?: string | null;
  reference_id?: string | null;
  batch_code?: string | null;
  expiry_date?: string | null;
  notes?: string | null;
}

export async function POST(req: Request) {
  let admin;
  try { admin = getSupabaseAdmin(); }
  catch (e: any) { return NextResponse.json({ error: e.message }, { status: 500 }); }

  let body: MovementInput | MovementInput[];
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }

  // Accept single or array (Move stock posts a pair)
  const rows = Array.isArray(body) ? body : [body];

  const cleaned: any[] = [];
  for (const r of rows) {
    if (!r.item_id || !r.location_id || !r.movement_type || r.quantity == null) {
      return NextResponse.json({ error: 'item_id, location_id, movement_type, quantity required' }, { status: 400 });
    }
    if (!VALID_TYPES.has(r.movement_type)) {
      return NextResponse.json({ error: `movement_type must be one of ${[...VALID_TYPES].join(', ')}` }, { status: 400 });
    }
    cleaned.push({
      item_id: r.item_id,
      location_id: r.location_id,
      movement_type: r.movement_type,
      quantity: r.quantity,
      unit_cost_usd: r.unit_cost_usd ?? null,
      unit_cost_lak: r.unit_cost_lak ?? null,
      fx_rate_used: r.fx_rate_used ?? null,
      total_cost_usd: r.unit_cost_usd != null ? Math.abs(r.quantity) * r.unit_cost_usd : null,
      total_cost_lak: r.unit_cost_lak != null ? Math.abs(r.quantity) * r.unit_cost_lak : null,
      vendor_id: r.vendor_id ?? null,
      counterparty_location_id: r.counterparty_location_id ?? null,
      reference_type: r.reference_type ?? 'manual',
      reference_id: r.reference_id ?? null,
      batch_code: r.batch_code ?? null,
      expiry_date: r.expiry_date ?? null,
      notes: r.notes ?? null,
    });
  }

  const { data, error } = await admin.schema('inv').from('movements').insert(cleaned).select('movement_id, item_id, quantity, movement_type');
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, movements: data });
}
