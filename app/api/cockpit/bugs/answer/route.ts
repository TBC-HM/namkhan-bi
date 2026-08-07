// app/api/cockpit/bugs/answer/route.ts
// Answer an open_question on a needs_human bug.
//
// owner-answer-path-consolidation-v1 (bug 169): this endpoint used to require
// `choice` and reject free text ("bug_id and choice required") — the owner had
// no escape hatch when none of the options fit (law 735 violation). It now
// delegates to the ONE owner-answer contract: resolves the bug's open row in
// governance.owner_questions and calls fn_owner_question_answer (choice OR
// free text). If no contract row exists (pre-migration stragglers), it falls
// back to fn_answer_bug_question, which itself delegates to the same fn.
import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request): Promise<NextResponse> {
  const body = await req.json() as { bug_id?: number; choice?: string; free_text?: string };
  const bugId = body.bug_id;
  const choice = typeof body.choice === 'string' ? body.choice.trim() : '';
  const freeText = typeof body.free_text === 'string' ? body.free_text.trim() : '';
  if (!bugId) return NextResponse.json({ error: 'bug_id required' }, { status: 400 });
  if (!choice && !freeText) {
    return NextResponse.json(
      { error: 'choice or free_text required (law 735: free text is always accepted)' },
      { status: 400 },
    );
  }

  const sb = getSupabaseAdmin();

  // One contract first: open owner_questions row for this bug.
  const { data: open } = await (sb as any)
    .from('v_owner_questions_open')
    .select('id')
    .eq('asker_kind', 'bug')
    .eq('ref_id', String(bugId))
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

  // Fallback: legacy fn (thin delegate to the same contract at DB level).
  const { data, error } = await (sb as any).rpc('fn_answer_bug_question', {
    p_bug_id: bugId,
    p_choice: choice || freeText,
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, data });
}
