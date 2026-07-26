// app/api/specs/route.ts — POST: save a spec questionnaire as a build_brief
// v2 2026-07-26 (spec-builder completion): goal_id is REQUIRED and validated
// against public.v_goals (ADR-165 traceability — orphan briefs rejected at
// intake). status restricted to 'draft' | 'ready' (dual-save from the form).
import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export async function POST(req: Request) {
  try {
    const { slug, title, content_md, tags, status, goal_id } = await req.json();
    if (!slug || !title || !content_md) {
      return NextResponse.json({ error: 'slug, title, content_md required' }, { status: 400 });
    }
    const goalId = Number(goal_id);
    if (!goal_id || !Number.isInteger(goalId) || goalId <= 0) {
      return NextResponse.json({ error: 'goal_id required — every brief must link a goal (ADR-165)' }, { status: 400 });
    }
    const briefStatus = status === 'draft' ? 'draft' : 'ready';

    const sb = getSupabaseAdmin();

    // Validate the goal exists via the public bridge view.
    const { data: goal, error: goalErr } = await sb
      .from('v_goals')
      .select('goal_id')
      .eq('goal_id', goalId)
      .maybeSingle();
    if (goalErr) return NextResponse.json({ error: goalErr.message }, { status: 500 });
    if (!goal) return NextResponse.json({ error: `goal_id ${goalId} not found in governance goals` }, { status: 400 });

    const { data, error } = await sb.schema('documentation').from('build_briefs').insert({
      slug, title, content_md,
      tags: tags ?? ['spec'],
      status: briefStatus,
      goal_id: goalId,
      target_repo: 'TBC-HM/namkhan-bi',
      target_branch: 'main',
      last_updated_by: 'spec-builder-ui',
    }).select('slug, title, status').single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data, { status: 201 });
  } catch {
    return NextResponse.json({ error: 'Unexpected error' }, { status: 500 });
  }
}
