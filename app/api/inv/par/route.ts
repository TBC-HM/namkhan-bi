// POST /api/inv/par
// Upserts an inv.par_levels row (UNIQUE item_id, location_id).
// Used by: Item-detail ParEditor ("Set par" modal). Brief autospec-inventory_module §5.7.
// Schema note: inv.par_levels has par_quantity / min_quantity / max_quantity —
// min_quantity is the reorder threshold (there is no reorder_quantity column).

import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface ParInput {
  item_id: string;
  location_id: number;
  par_quantity: number;
  min_quantity?: number | null;
  max_quantity?: number | null;
  notes?: string | null;
}

export async function POST(req: Request) {
  let admin;
  try { admin = getSupabaseAdmin(); }
  catch (e: any) { return NextResponse.json({ error: e.message }, { status: 500 }); }

  let body: ParInput;
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }

  if (!body.item_id || !body.location_id || body.par_quantity == null) {
    return NextResponse.json({ error: 'item_id, location_id, par_quantity required' }, { status: 400 });
  }
  const par = Number(body.par_quantity);
  if (!Number.isFinite(par) || par < 0) {
    return NextResponse.json({ error: 'par_quantity must be a number >= 0' }, { status: 400 });
  }
  const min = body.min_quantity == null ? null : Number(body.min_quantity);
  const max = body.max_quantity == null ? null : Number(body.max_quantity);
  if (min != null && (!Number.isFinite(min) || min < 0)) {
    return NextResponse.json({ error: 'min_quantity must be a number >= 0' }, { status: 400 });
  }
  if (max != null && (!Number.isFinite(max) || max < 0)) {
    return NextResponse.json({ error: 'max_quantity must be a number >= 0' }, { status: 400 });
  }
  if (min != null && max != null && min > max) {
    return NextResponse.json({ error: 'min_quantity cannot exceed max_quantity' }, { status: 400 });
  }

  const row = {
    item_id: body.item_id,
    location_id: body.location_id,
    par_quantity: par,
    min_quantity: min,
    max_quantity: max,
    notes: body.notes ?? null,
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await admin
    .schema('inv')
    .from('par_levels')
    .upsert(row, { onConflict: 'item_id,location_id' })
    .select('par_id, item_id, location_id, par_quantity, min_quantity, max_quantity');

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, par: data?.[0] ?? null });
}
