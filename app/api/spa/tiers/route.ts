// app/api/spa/tiers/route.ts
// Spa module v1 — tier catalogue (brief spa-module-v1-slice-day-pass-tiers).
// GET  → fetch active tiers for a property via v_spa_pass_tiers

import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const propertyId = searchParams.get('property_id');
  if (!propertyId) {
    return NextResponse.json({ error: 'property_id required' }, { status: 400 });
  }

  const sb = getSupabaseAdmin();
  const { data, error } = await (sb as any)
    .from('v_spa_pass_tiers')
    .select('tier_id, code, name, pass_type, credits_total, price, currency, valid_days, is_active, display_order')
    .eq('property_id', Number(propertyId))
    .eq('is_active', true)
    .order('display_order');

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, tiers: data ?? [] });
}
