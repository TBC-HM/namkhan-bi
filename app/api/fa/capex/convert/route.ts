// POST /api/fa/capex/convert
// Convert a delivered capex line item into a fixed asset.
// Used by: Page 8 Capex Pipeline detail panel.

import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface ConvertInput {
  capex_id: string;
  asset_tag: string;
  serial_number?: string | null;
  manufacturer?: string | null;
  model?: string | null;
  in_service_date?: string | null;
  location?: string | null;
  insurance_value_usd?: number | null;
  warranty_expiry?: string | null;
  gl_account_code?: string | null;
}

export async function POST(req: Request) {
  let admin;
  try { admin = getSupabaseAdmin(); }
  catch (e: any) { return NextResponse.json({ error: e.message }, { status: 500 }); }

  let b: ConvertInput;
  try { b = await req.json(); }
  catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }

  if (!b.capex_id || !b.asset_tag) {
    return NextResponse.json({ error: 'capex_id + asset_tag required' }, { status: 400 });
  }

  const { data: capex, error: cErr } = await admin
    .schema('fa')
    .from('capex_pipeline')
    .select('*')
    .eq('capex_id', b.capex_id)
    .maybeSingle();
  if (cErr || !capex) return NextResponse.json({ error: cErr?.message ?? 'capex not found' }, { status: 404 });
  if (!capex.category_id) {
    return NextResponse.json({ error: 'capex must have category_id before conversion' }, { status: 400 });
  }
  if (capex.converted_to_asset_id) {
    return NextResponse.json({ error: `already converted (asset_id=${capex.converted_to_asset_id})` }, { status: 400 });
  }

  const today = new Date().toISOString().slice(0, 10);
  const { data: asset, error: aErr } = await admin
    .schema('fa')
    .from('assets')
    .insert({
      asset_tag: b.asset_tag,
      name: capex.title,
      category_id: capex.category_id,
      supplier_id: capex.preferred_supplier_id ?? null,
      acquired_via: 'purchase',
      purchase_date: today,
      in_service_date: b.in_service_date ?? today,
      purchase_cost_usd: capex.estimated_cost_usd,
      purchase_cost_lak: null,
      fx_rate_used: capex.fx_rate_used ?? null,
      useful_life_years: capex.expected_useful_life_years ?? null,
      depreciation_method: 'straight_line',
      residual_value_usd: 0,
      insurance_value_usd: b.insurance_value_usd ?? null,
      warranty_expiry: b.warranty_expiry ?? null,
      serial_number: b.serial_number ?? null,
      manufacturer: b.manufacturer ?? null,
      model: b.model ?? null,
      location: b.location ?? null,
      gl_account_code: b.gl_account_code ?? null,
      status: 'in_service',
      condition: 'excellent',
    })
    .select('asset_id')
    .maybeSingle();
  if (aErr || !asset) return NextResponse.json({ error: aErr?.message ?? 'Insert asset failed' }, { status: 500 });

  await admin
    .schema('fa')
    .from('capex_pipeline')
    .update({ converted_to_asset_id: asset.asset_id, status: 'received' })
    .eq('capex_id', b.capex_id);

  return NextResponse.json({ ok: true, asset_id: asset.asset_id });
}
