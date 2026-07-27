// app/api/university/kpi-gate/route.ts
// TBC University · KPI definition gating (owner act, ADR-173 conformance
// battery). Wraps public.fn_kpi_definition_gate (SECURITY DEFINER,
// service_role-only EXECUTE) — sets kpi_catalog.definition_status
// 'gated' / back to 'ai_draft'. 'verified_in_code' is NEVER settable here:
// only a green battery run via kpi.fn_conformance_run_battery can set it
// (trigger tg_guard_verified_in_code blocks every other path).

import { NextResponse, type NextRequest } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as { kpi_number?: number; action?: string };
  const kpiNumber = Number(body.kpi_number);
  const action = String(body.action ?? '').trim().toLowerCase();
  if (!Number.isInteger(kpiNumber) || kpiNumber <= 0) {
    return NextResponse.json({ ok: false, error: 'kpi_number required' }, { status: 400 });
  }
  if (action !== 'gate' && action !== 'ungate') {
    return NextResponse.json({ ok: false, error: "action must be 'gate' or 'ungate'" }, { status: 400 });
  }
  try {
    const sb = getSupabaseAdmin();
    const { data, error } = await sb.rpc('fn_kpi_definition_gate', {
      p_kpi_number: kpiNumber,
      p_action: action,
    });
    if (error) throw new Error(error.message);
    return NextResponse.json({ ok: true, result: data ?? null });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : 'gate failed' },
      { status: 500 },
    );
  }
}
