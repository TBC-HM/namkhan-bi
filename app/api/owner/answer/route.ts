// app/api/owner/answer/route.ts
// owner-answer-path-consolidation-v1 — THE single owner-answer route (law 735).
//
// Every owner answer — brief, bug, finding, comment — lands here and is
// dispatched by public.fn_owner_question_answer (the ONE contract over
// governance.owner_questions). Option click OR free text, always both allowed.
//
// Accepts EITHER:
//   { question_id, choice?, free_text? }
//   { asker_kind, ref_id, choice?, free_text? }   // resolved via v_owner_questions_open
// At least one of choice / free_text is required (law 735: free text is never
// optional-by-configuration — the fn falls unmatched choices through to free text).
import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const KINDS = new Set(['brief', 'bug', 'finding', 'comment']);

export async function POST(req: Request): Promise<NextResponse> {
  let body: {
    question_id?: number;
    asker_kind?: string;
    ref_id?: string | number;
    choice?: string;
    free_text?: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid JSON body' }, { status: 400 });
  }

  const choice = typeof body.choice === 'string' ? body.choice.trim() : '';
  const freeText = typeof body.free_text === 'string' ? body.free_text.trim() : '';
  if (!choice && !freeText) {
    return NextResponse.json(
      { error: 'choice or free_text required (law 735: free text is always accepted)' },
      { status: 400 },
    );
  }

  const sb = getSupabaseAdmin();
  let questionId = body.question_id;

  // Resolve by (asker_kind, ref_id) when no question_id was sent — this is what
  // legacy surfaces (brief slug / bug id) know about themselves.
  if (!questionId) {
    const kind = String(body.asker_kind ?? '').trim();
    const refId = body.ref_id != null ? String(body.ref_id).trim() : '';
    if (!KINDS.has(kind) || !refId) {
      return NextResponse.json(
        { error: 'question_id or (asker_kind + ref_id) required' },
        { status: 400 },
      );
    }
    const { data: open, error: findErr } = await (sb as any)
      .from('v_owner_questions_open')
      .select('id')
      .eq('asker_kind', kind)
      .eq('ref_id', refId)
      .order('asked_at', { ascending: false })
      .limit(1);
    if (findErr) return NextResponse.json({ error: findErr.message }, { status: 500 });
    if (!open?.length) {
      return NextResponse.json(
        { error: `no open question for ${kind}:${refId}` },
        { status: 404 },
      );
    }
    questionId = open[0].id as number;
  }

  const { data, error } = await (sb as any).rpc('fn_owner_question_answer', {
    p_question_id: questionId,
    p_choice: choice || null,
    p_free_text: freeText || null,
    p_actor: 'pbs',
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, question_id: questionId, data });
}
