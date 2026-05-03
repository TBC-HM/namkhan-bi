// POST /api/operations/suppliers/price-history
//
// Insert a single row into suppliers.price_history. Posted by
// app/operations/inventory/suppliers/[id]/_PriceForm.tsx.
//
// Body: {
//   supplier_id: string (uuid),
//   effective_date: string (YYYY-MM-DD, required),
//   inv_sku: string | null,
//   unit_price_usd: number | null,
//   unit_price_lak: number | null,
//   min_order_qty: number | null,
//   source: string | null,
//   source_ref: string | null,
//   notes: string | null,
// }
//
// At least one of unit_price_usd / unit_price_lak must be set.
// Returns: { ok, price_id?, error? }
//
// Uses service-role client.

import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface Body {
  supplier_id?: string;
  effective_date?: string;
  inv_sku?: string | null;
  unit_price_usd?: number | null;
  unit_price_lak?: number | null;
  min_order_qty?: number | null;
  source?: string | null;
  source_ref?: string | null;
  notes?: string | null;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export async function POST(req: Request) {
  let admin;
  try {
    admin = getSupabaseAdmin();
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }

  let body: Body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid JSON body' }, { status: 400 });
  }

  const supplier_id = (body.supplier_id ?? '').trim();
  const effective_date = (body.effective_date ?? '').trim();

  if (!UUID_RE.test(supplier_id)) {
    return NextResponse.json({ ok: false, error: 'supplier_id must be a UUID' }, { status: 400 });
  }
  if (!DATE_RE.test(effective_date)) {
    return NextResponse.json({ ok: false, error: 'effective_date must be YYYY-MM-DD' }, { status: 400 });
  }

  const usd = typeof body.unit_price_usd === 'number' ? body.unit_price_usd : null;
  const lak = typeof body.unit_price_lak === 'number' ? body.unit_price_lak : null;
  if (usd == null && lak == null) {
    return NextResponse.json({ ok: false, error: 'At least one of unit_price_usd / unit_price_lak is required' }, { status: 400 });
  }
  if (usd != null && (!Number.isFinite(usd) || usd < 0)) {
    return NextResponse.json({ ok: false, error: 'unit_price_usd must be a non-negative number' }, { status: 400 });
  }
  if (lak != null && (!Number.isFinite(lak) || lak < 0)) {
    return NextResponse.json({ ok: false, error: 'unit_price_lak must be a non-negative number' }, { status: 400 });
  }

  const moq = typeof body.min_order_qty === 'number' ? body.min_order_qty : null;
  if (moq != null && (!Number.isFinite(moq) || moq < 0)) {
    return NextResponse.json({ ok: false, error: 'min_order_qty must be a non-negative number' }, { status: 400 });
  }

  // Verify the supplier exists (cheap sanity check; helpful error vs FK violation)
  const { data: sup, error: supErr } = await admin
    .schema('suppliers')
    .from('suppliers')
    .select('supplier_id')
    .eq('supplier_id', supplier_id)
    .maybeSingle();
  if (supErr) {
    return NextResponse.json({ ok: false, error: `Failed to verify supplier: ${supErr.message}` }, { status: 500 });
  }
  if (!sup) {
    return NextResponse.json({ ok: false, error: 'Supplier not found' }, { status: 404 });
  }

  // Optional: resolve inv_sku → inv_item_id so downstream joins work
  let inv_item_id: string | null = null;
  const inv_sku = body.inv_sku ? String(body.inv_sku).trim() : null;
  if (inv_sku) {
    const { data: itemRow } = await admin
      .schema('inv')
      .from('items')
      .select('item_id')
      .eq('sku', inv_sku)
      .maybeSingle();
    if (itemRow?.item_id) inv_item_id = itemRow.item_id;
  }

  const insertRow: Record<string, unknown> = {
    supplier_id,
    effective_date,
    inv_sku,
    inv_item_id,
    unit_price_usd: usd,
    unit_price_lak: lak,
    min_order_qty: moq,
    source: body.source?.toString().trim() || null,
    source_ref: body.source_ref?.toString().trim() || null,
    notes: body.notes?.toString().trim() || null,
  };

  const { data: inserted, error: insErr } = await admin
    .schema('suppliers')
    .from('price_history')
    .insert(insertRow)
    .select('price_id')
    .single();

  if (insErr) {
    return NextResponse.json({ ok: false, error: insErr.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, price_id: inserted?.price_id ?? null }, { status: 200 });
}
