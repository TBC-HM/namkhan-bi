// app/api/revenue/rate-action/route.ts
// Revenue Management v1 (brief revenue-module-v1) — rate action desk.
// One route, three ops — all writes go through SECURITY DEFINER fns:
//   propose → public.fn_rate_action_propose (guardrail-validated BEFORE insert;
//             below the ADR floor is REFUSED with the named rule — guardrail > goal)
//   decide  → public.fn_rate_action_decide (approve/reject PBS-gated; 'execute'
//             only LOGS the manual Cloudbeds change — nothing writes to the PMS)
//   finding → public.fn_module_finding_add (owner findings channel, rule 729)
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Body = {
  op: 'propose' | 'decide' | 'finding';
  property_id?: number;
  // propose
  stay_start?: string;
  stay_end?: string;
  current_rate?: number;
  proposed_rate?: number;
  rationale?: string;
  rationale_ref?: Record<string, unknown>;
  // decide
  id?: number;
  decision?: 'approve' | 'reject' | 'execute';
  note?: string;
  // finding
  finding?: string;
  severity?: 'low' | 'medium' | 'high';
  actor?: string;
};

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as Body;
  const sb = getSupabaseAdmin();
  const actor = body.actor ?? 'pbs';

  if (body.op === 'propose') {
    if (!body.property_id || !body.stay_start || !body.stay_end || !body.proposed_rate) {
      return NextResponse.json(
        { error: 'property_id, stay_start, stay_end, proposed_rate required' },
        { status: 400 },
      );
    }
    const { data, error } = await sb.rpc('fn_rate_action_propose', {
      p_property_id: body.property_id,
      p_stay_start: body.stay_start,
      p_stay_end: body.stay_end,
      p_current_rate: body.current_rate ?? null,
      p_proposed_rate: body.proposed_rate,
      p_rationale: body.rationale ?? null,
      p_rationale_ref: body.rationale_ref ?? {},
      p_proposed_by: actor,
    });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, result: data });
  }

  if (body.op === 'decide') {
    if (!body.id || !body.decision) {
      return NextResponse.json({ error: 'id, decision required' }, { status: 400 });
    }
    const { data, error } = await sb.rpc('fn_rate_action_decide', {
      p_id: body.id,
      p_decision: body.decision,
      p_actor: actor,
      p_note: body.note ?? null,
    });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, result: data });
  }

  if (body.op === 'finding') {
    if (!body.finding) {
      return NextResponse.json({ error: 'finding required' }, { status: 400 });
    }
    const { data, error } = await sb.rpc('fn_module_finding_add', {
      p_module: 'revenue',
      p_finding: body.finding,
      p_severity: body.severity ?? 'medium',
    });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, result: data });
  }

  return NextResponse.json({ error: 'unknown op' }, { status: 400 });
}
