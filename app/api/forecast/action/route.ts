// app/api/forecast/action/route.ts
// Forecasting module v1.1 (brief forecasting-module-v1 §V1.1, findings 7-8).
// One route, three ops — all writes go through SECURITY DEFINER fns:
//   run_scenario   → public.fn_forecast_run_scenario (deterministic engine,
//                    recommend-never-execute: a scenario run is a simulation
//                    row, it never touches prices/inventory/channels)
//   recommendation → public.fn_forecast_recommendation_set (accept/dismiss/
//                    executed — PBS action tracking, MD success metric)
//   finding        → public.fn_module_finding_add (owner findings channel,
//                    governance.module_findings, rule 729)
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Body = {
  op: 'run_scenario' | 'recommendation' | 'finding';
  property_id?: number;
  scenario_id?: number;
  recommendation_id?: number;
  status?: 'proposed' | 'accepted' | 'dismissed' | 'executed';
  finding?: string;
  severity?: 'low' | 'medium' | 'high';
  actor?: string;
};

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as Body;
  const sb = getSupabaseAdmin();
  const actor = body.actor ?? 'pbs';

  if (body.op === 'run_scenario') {
    if (!body.property_id || !body.scenario_id) {
      return NextResponse.json({ error: 'property_id, scenario_id required' }, { status: 400 });
    }
    const { data, error } = await sb.rpc('fn_forecast_run_scenario', {
      p_property_id: body.property_id,
      p_scenario_id: body.scenario_id,
      p_actor: actor,
    });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, result: data });
  }

  if (body.op === 'recommendation') {
    if (!body.recommendation_id || !body.status) {
      return NextResponse.json({ error: 'recommendation_id, status required' }, { status: 400 });
    }
    const { data, error } = await sb.rpc('fn_forecast_recommendation_set', {
      p_id: body.recommendation_id,
      p_status: body.status,
      p_actor: actor,
    });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, result: data });
  }

  if (body.op === 'finding') {
    if (!body.finding || body.finding.trim().length < 5) {
      return NextResponse.json({ error: 'finding text required' }, { status: 400 });
    }
    const { data, error } = await sb.rpc('fn_module_finding_add', {
      p_module: 'forecasting_module',
      p_finding: body.finding.trim(),
      p_severity: body.severity ?? 'medium',
      p_screenshot: null,
    });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, result: data });
  }

  return NextResponse.json({ error: 'unknown op' }, { status: 400 });
}
