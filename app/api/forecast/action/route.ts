// app/api/forecast/action/route.ts
// Forecasting module v1.1 (brief forecasting-module-v1 §V1.1, findings 7-8).
// One route, three ops — all writes go through SECURITY DEFINER fns:
//   run_custom     → public.fn_forecast_scenario_custom_run (free-form what-if:
//                    validated params → custom scenario row → same deterministic
//                    engine; the Scenario Agent narrates the run afterwards)
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
  op: 'run_scenario' | 'run_custom' | 'recommendation' | 'finding';
  property_id?: number;
  scenario_id?: number;
  adr_delta_pct?: number;
  demand_uplift_pct?: number;
  one_off_cost?: number;
  horizon_days?: number;
  title?: string;
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

  if (body.op === 'run_custom') {
    if (!body.property_id) {
      return NextResponse.json({ error: 'property_id required' }, { status: 400 });
    }
    const params: Record<string, number> = { horizon_days: body.horizon_days ?? 90 };
    if (body.adr_delta_pct) params.adr_delta_pct = body.adr_delta_pct;
    if (body.demand_uplift_pct) params.demand_uplift_pct = body.demand_uplift_pct;
    if (body.one_off_cost) params.one_off_cost = body.one_off_cost;
    if (!params.adr_delta_pct && !params.demand_uplift_pct) {
      return NextResponse.json({ error: 'adr_delta_pct or demand_uplift_pct required' }, { status: 400 });
    }
    const { data, error } = await sb.rpc('fn_forecast_scenario_custom_run', {
      p_property_id: body.property_id,
      p_title: body.title ?? '',
      p_params: params,
      p_actor: actor,
    });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    // Fire-and-forget: ask the Scenario Agent to narrate the fresh run. The
    // numbers are already final — narration failing only delays the prose
    // (hourly sweeper cron catches up).
    try {
      const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
      if (base && key) {
        void fetch(`${base}/functions/v1/forecast-scenario-narrate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
          body: JSON.stringify({ limit: 3 }),
        }).catch(() => undefined);
      }
    } catch { /* narration is best-effort */ }
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
