// app/api/cockpit/briefs/answer/route.ts
// Answer an open_question on a needs_input brief.
//
// owner-answer-path-consolidation-v1: delegates to the ONE owner-answer
// contract (governance.owner_questions → fn_owner_question_answer) when the
// brief's question has a contract row; falls back to fn_answer_brief_question
// (itself a thin delegate) otherwise. Accepts choice OR free text (law 735).
import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request): Promise<NextResponse> {
  const body = await req.json() as { slug?: string; choice?: string; free_text?: string };
  const slug = typeof body.slug === 'string' ? body.slug.trim() : '';
  const choice = typeof body.choice === 'string' ? body.choice.trim() : '';
  const freeText = typeof body.free_text === 'string' ? body.free_text.trim() : '';
  if (!slug) return NextResponse.json({ error: 'slug required' }, { status: 400 });
  if (!choice && !freeText) {
    return NextResponse.json(
      { error: 'choice or free_text required (law 735: free text is always accepted)' },
      { status: 400 },
    );
  }

  const sb = getSupabaseAdmin();

  const { data: open } = await (sb as any)
    .from('v_owner_questions_open')
    .select('id')
    .eq('asker_kind', 'brief')
    .eq('ref_id', slug)
    .order('asked_at', { ascending: false })
    .limit(1);

  if (open?.length) {
    const { data, error } = await (sb as any).rpc('fn_owner_question_answer', {
      p_question_id: open[0].id,
      p_choice: choice || null,
      p_free_text: freeText || null,
      p_actor: 'pbs',
    });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, question_id: open[0].id, data });
  }

  const { data, error } = await (sb as any).rpc('fn_answer_brief_question', {
    p_slug: slug,
    p_choice: choice || freeText,
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, data });
}
