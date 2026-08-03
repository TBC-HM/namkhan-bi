// app/api/commercial/designer/route.ts
// Monetization Engine v2 — Business Model Designer write path (brief monetization-engine-v2 §2.4, A13).
// POST {action:'create_plan'|'assign_plan', ...} → SECURITY DEFINER RPCs
//   public.fn_commercial_plan_upsert  (membership / usage / hybrid plans, versioned, audited)
//   public.fn_commercial_assign_plan  (property → contract + subscription + tenant_entitlements)
// Both RPCs are service_role-only (grant hygiene A15) — this route is the sole UI path.
// External invoice EXPORT / payment sync stays client-#1-gated (ADR-197, brief §2.5) — not here.

import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

type MeterSpec = {
  meter_code: string;
  price_model?: string;
  unit_amount?: number | null;
  included_quantity?: number | null;
  markup_percent?: number | null;
  tier_definition?: unknown[];
};

export async function POST(req: Request) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid JSON body' }, { status: 400 });
  }
  const action = String(body.action ?? '');
  const sb = getSupabaseAdmin();

  if (action === 'create_plan') {
    const code = String(body.product_code ?? '').trim().toUpperCase();
    const name = String(body.name ?? '').trim();
    const kind = String(body.kind ?? 'plan');
    if (!/^[A-Z0-9-]{3,40}$/.test(code)) {
      return NextResponse.json({ error: 'product_code: 3-40 chars, A-Z 0-9 dash' }, { status: 400 });
    }
    if (name.length < 2) return NextResponse.json({ error: 'name required' }, { status: 400 });
    if (!['plan', 'module', 'package', 'addon', 'usage_product'].includes(kind)) {
      return NextResponse.json({ error: 'kind must be plan/module/package/addon/usage_product' }, { status: 400 });
    }
    const basePrice = body.base_price == null || body.base_price === '' ? null : Number(body.base_price);
    if (basePrice != null && (!Number.isFinite(basePrice) || basePrice < 0)) {
      return NextResponse.json({ error: 'base_price must be a non-negative number' }, { status: 400 });
    }
    const meters = (Array.isArray(body.meters) ? body.meters : []) as MeterSpec[];
    const { data, error } = await sb.rpc('fn_commercial_plan_upsert', {
      p_product_code: code,
      p_name: name,
      p_kind: kind,
      p_base_price: basePrice,
      p_interval: String(body.interval ?? 'month'),
      p_currency: 'USD',
      p_meters: meters,
      p_entitlements: body.entitlements ?? {},
      p_actor: 'designer-ui',
    });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data);
  }

  if (action === 'assign_plan') {
    const propertyId = Number(body.property_id);
    const code = String(body.product_code ?? '').trim().toUpperCase();
    if (![260955, 1000001].includes(propertyId)) {
      return NextResponse.json({ error: 'property_id must be 260955 (Namkhan) or 1000001 (Donna)' }, { status: 400 });
    }
    if (!code) return NextResponse.json({ error: 'product_code required' }, { status: 400 });
    const { data, error } = await sb.rpc('fn_commercial_assign_plan', {
      p_property_id: propertyId,
      p_product_code: code,
      p_actor: 'designer-ui',
    });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data);
  }

  return NextResponse.json({ error: 'action must be create_plan or assign_plan' }, { status: 400 });
}
