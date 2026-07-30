// app/api/cockpit/goals/route.ts
// Goal registry write path (service role via SECURITY DEFINER bridge fns, claude_md 0.5):
// POST { action: 'ratify', goal_id }                       -> public.fn_goal_ratify
// POST { action: 'intake', items: [{block,question,answer}] } -> public.fn_goal_intake_save
// POST { action: 'upsert', goal: {...} }                   -> public.fn_goal_upsert
//   (knowledge-goals-intake-v1: write layer for the goals tree — add + inline edit.
//    Ratification gate preserved: new rows land status='proposed'; material edits to
//    ratified L1/L2 rows are reset to 'proposed' by the fn for re-ratification.)

import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const SLUG_RE = /^[a-z0-9][a-z0-9-]{1,79}$/;
const OPERATORS = ['>=', '<=', '>', '<', '=', 'between'];

export async function POST(req: Request) {
  let body: any;
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'bad json' }, { status: 400 }); }
  const sb = getSupabaseAdmin();

  if (body.action === 'ratify') {
    const goalId = Number(body.goal_id);
    if (!goalId) return NextResponse.json({ error: 'goal_id required' }, { status: 400 });
    const { error } = await sb.rpc('fn_goal_ratify', { p_goal_id: goalId, p_by: 'PBS (cockpit)' });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  if (body.action === 'intake') {
    const items = Array.isArray(body.items) ? body.items : [];
    if (!items.length) return NextResponse.json({ error: 'items required' }, { status: 400 });
    for (const it of items) {
      if (!it || typeof it.block !== 'string' || typeof it.question !== 'string') continue;
      const { error } = await sb.rpc('fn_goal_intake_save', {
        p_block: it.block, p_question: it.question, p_answer: String(it.answer ?? ''),
      });
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ ok: true, saved: items.length });
  }

  if (body.action === 'upsert') {
    const g = body.goal;
    if (!g || typeof g !== 'object') return NextResponse.json({ error: 'goal required' }, { status: 400 });

    const goalId = g.goal_id != null ? Number(g.goal_id) : null;
    const level = Number(g.level);
    const slug = typeof g.slug === 'string' ? g.slug.trim().toLowerCase() : '';
    const title = typeof g.title === 'string' ? g.title.trim() : '';

    if (!Number.isInteger(level) || level < 1 || level > 4) {
      return NextResponse.json({ error: 'level must be 1-4' }, { status: 400 });
    }
    if (!goalId && !SLUG_RE.test(slug)) {
      return NextResponse.json({ error: 'slug required: lowercase letters, digits, hyphens (2-80 chars)' }, { status: 400 });
    }
    if (!title) return NextResponse.json({ error: 'title required' }, { status: 400 });
    if (g.target_operator != null && g.target_operator !== '' && !OPERATORS.includes(String(g.target_operator))) {
      return NextResponse.json({ error: 'target_operator must be one of ' + OPERATORS.join(', ') }, { status: 400 });
    }
    const parentId = g.parent_goal_id != null && g.parent_goal_id !== '' ? Number(g.parent_goal_id) : null;
    const propertyId = g.property_id != null && g.property_id !== '' ? Number(g.property_id) : null;
    const targetValue = g.target_value != null && g.target_value !== '' ? Number(g.target_value) : null;
    if (targetValue != null && !Number.isFinite(targetValue)) {
      return NextResponse.json({ error: 'target_value must be a number' }, { status: 400 });
    }

    const { data, error } = await sb.rpc('fn_goal_upsert', {
      p_goal_id: goalId,
      p_level: level,
      p_parent_goal_id: parentId,
      p_slug: slug || null,
      p_title: title,
      p_description: g.description != null ? String(g.description) : null,
      p_measurable_target: g.measurable_target != null ? String(g.measurable_target) : null,
      p_target_metric: g.target_metric != null ? String(g.target_metric) : null,
      p_target_operator: g.target_operator != null && g.target_operator !== '' ? String(g.target_operator) : null,
      p_target_value: targetValue,
      p_property_id: propertyId,
      p_review_cadence: g.review_cadence != null && g.review_cadence !== '' ? String(g.review_cadence) : null,
      p_by: 'PBS (cockpit)',
    });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, goal_id: data });
  }

  return NextResponse.json({ error: 'unknown action' }, { status: 400 });
}
