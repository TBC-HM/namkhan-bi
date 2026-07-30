// app/api/settings/knowledge/route.ts
// knowledge-goals-intake-v1: write path for the client Knowledge tab.
// POST { action: 'goal_upsert', property_id, goal: {...} } -> public.fn_tenant_goal_upsert
// POST { action: 'answers_save', property_id, items: [{section,question,answer}] }
//   -> public.fn_tenant_knowledge_answer_save
// Rows are canon; the rendered knowledge docs + brain re-embed pick these up via
// the fn_render_tenant_knowledge save-path contract (wired in the render fn stage).

import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const KINDS = ['big_goal', 'module_goal'];
const GUARDRAILS = ['floor', 'ceiling', 'approval_required', 'watch'];

function num(v: unknown): number | null {
  if (v == null || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : NaN;
}

export async function POST(req: Request) {
  let body: any;
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'bad json' }, { status: 400 }); }
  const propertyId = Number(body.property_id);
  if (!Number.isInteger(propertyId) || propertyId <= 0) {
    return NextResponse.json({ error: 'property_id required' }, { status: 400 });
  }
  const sb = getSupabaseAdmin();

  if (body.action === 'goal_upsert') {
    const g = body.goal;
    if (!g || typeof g !== 'object') return NextResponse.json({ error: 'goal required' }, { status: 400 });
    const title = typeof g.title === 'string' ? g.title.trim() : '';
    if (!title) return NextResponse.json({ error: 'title required' }, { status: 400 });
    if (!KINDS.includes(String(g.kind))) return NextResponse.json({ error: 'kind must be big_goal or module_goal' }, { status: 400 });
    if (g.kind === 'module_goal' && !g.module) return NextResponse.json({ error: 'module required for module goals' }, { status: 400 });
    const guardrail = g.guardrail_type ? String(g.guardrail_type) : null;
    if (guardrail && !GUARDRAILS.includes(guardrail)) {
      return NextResponse.json({ error: 'guardrail_type must be one of ' + GUARDRAILS.join(', ') }, { status: 400 });
    }
    const baseline = num(g.baseline);
    const target = num(g.target_value);
    const weight = num(g.weight);
    if ([baseline, target, weight].some((v) => v != null && Number.isNaN(v))) {
      return NextResponse.json({ error: 'baseline / target / weight must be numbers' }, { status: 400 });
    }

    const { data, error } = await sb.rpc('fn_tenant_goal_upsert', {
      p_goal_id: g.goal_id != null ? Number(g.goal_id) : null,
      p_property_id: propertyId,
      p_kind: String(g.kind),
      p_parent_goal_id: g.parent_goal_id != null ? Number(g.parent_goal_id) : null,
      p_module: g.module ? String(g.module) : null,
      p_title: title,
      p_description: g.description ? String(g.description) : null,
      p_metric: g.metric ? String(g.metric) : null,
      p_baseline: baseline,
      p_target_value: target,
      p_deadline: g.deadline ? String(g.deadline) : null,
      p_weight: weight,
      p_guardrail_type: guardrail,
      p_by: 'client (settings/knowledge)',
    });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, goal_id: data });
  }

  if (body.action === 'answers_save') {
    const items = Array.isArray(body.items) ? body.items : [];
    if (!items.length) return NextResponse.json({ error: 'items required' }, { status: 400 });
    for (const it of items) {
      if (!it || typeof it.section !== 'string' || typeof it.question !== 'string') continue;
      const { error } = await sb.rpc('fn_tenant_knowledge_answer_save', {
        p_property_id: propertyId,
        p_section: it.section,
        p_question: it.question,
        p_answer: String(it.answer ?? ''),
        p_by: 'client (settings/knowledge)',
      });
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ ok: true, saved: items.length });
  }

  return NextResponse.json({ error: 'unknown action' }, { status: 400 });
}
