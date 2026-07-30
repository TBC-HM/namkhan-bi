// app/api/costs/infra-charge/route.ts
// Cost Governance v1.5 (brief cost-governance-v1 · ADR-196 full ledger now):
// manual infra / SaaS charge entry. Thin wrapper over the SECURITY DEFINER
// bridge public.fn_costs_add_infra_charge (PostgREST public-only law) — the
// bridge inserts into costs.infra_charges and runs costs.fn_ingest_all(), so
// the charge lands in the immutable ledger immediately (idempotency_key infra:<id>).

import { NextResponse, type NextRequest } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Body = {
  charge_month?: string;      // 'YYYY-MM' or 'YYYY-MM-DD'
  provider?: string;
  description?: string;
  amount_usd?: number;
  work_class?: string;
  cost_nature?: string;
  property_id?: number | null;
  is_estimate?: boolean;
};

export async function POST(req: NextRequest) {
  let body: Body;
  try { body = await req.json(); }
  catch { return NextResponse.json({ ok: false, error: 'bad_json' }, { status: 400 }); }

  const month = String(body.charge_month ?? '').trim();
  if (!/^\d{4}-\d{2}(-\d{2})?$/.test(month)) {
    return NextResponse.json({ ok: false, error: 'charge_month_required (YYYY-MM)' }, { status: 400 });
  }
  const amount = Number(body.amount_usd);
  if (!Number.isFinite(amount) || amount <= 0) {
    return NextResponse.json({ ok: false, error: 'amount_usd_must_be_positive' }, { status: 400 });
  }

  const sb = getSupabaseAdmin();
  const { data, error } = await sb.rpc('fn_costs_add_infra_charge', {
    p_charge_month: month.length === 7 ? `${month}-01` : month,
    p_provider: String(body.provider ?? '').trim(),
    p_description: String(body.description ?? '').trim() || null,
    p_amount_usd: amount,
    p_work_class: String(body.work_class ?? 'platform_operations'),
    p_cost_nature: String(body.cost_nature ?? 'infrastructure'),
    p_property_id: body.property_id == null ? null : Number(body.property_id),
    p_is_estimate: !!body.is_estimate,
    p_created_by: 'holding_costs_ui',
  });
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  const j = (data ?? {}) as { ok?: boolean; error?: string };
  return NextResponse.json(j, { status: j.ok ? 200 : 400 });
}
