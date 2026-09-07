// app/api/google/answer-qa/route.ts
// Save an answer to a GBP Q&A question.
// POST { property_id, question_id, answer_text }
// L22: property_id from body is untrusted — requirePropertyAccess() verifies
// the caller's session has a grant for that property (throws 400/401/403).
// Writes to marketing.gbp_questions, then calls google-sync action=post-qa-answer
// if the edge function supports it (graceful fallback — saves to DB regardless).

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { requirePropertyAccess } from '@/lib/tenancy';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  let body: { property_id?: unknown; question_id?: unknown; answer_text?: unknown };
  try { body = await req.json(); }
  catch { return NextResponse.json({ ok: false, error: 'invalid_json' }, { status: 400 }); }

  // L22: verify caller owns access to this property — throws 400/401/403 if not
  let propertyId: number;
  try {
    propertyId = await requirePropertyAccess(req, body.property_id as string | number | null | undefined);
  } catch (e) {
    if (e instanceof Response) return e;
    return NextResponse.json({ ok: false, error: 'access_denied' }, { status: 403 });
  }

  const questionId = String(body.question_id ?? '').trim();
  const answerText = String(body.answer_text ?? '').trim();

  if (!questionId) {
    return NextResponse.json({ ok: false, error: 'question_id required' }, { status: 400 });
  }
  if (answerText.length < 2) {
    return NextResponse.json({ ok: false, error: 'answer_text required' }, { status: 400 });
  }
  if (answerText.length > 4000) {
    return NextResponse.json({ ok: false, error: 'answer too long (max 4000 chars)' }, { status: 400 });
  }

  const sb = getSupabaseAdmin();

  // Verify the question belongs to this property
  const { data: qrow, error: qErr } = await sb
    .schema('marketing').from('gbp_questions')
    .select('question_id, property_id, google_question_name')
    .eq('question_id', questionId)
    .eq('property_id', propertyId)
    .maybeSingle();

  if (qErr) return NextResponse.json({ ok: false, error: 'lookup_failed: ' + qErr.message }, { status: 500 });
  if (!qrow) return NextResponse.json({ ok: false, error: `question ${questionId} not found for property ${propertyId}` }, { status: 404 });

  // Save answer to DB
  const { error: upErr } = await sb
    .schema('marketing').from('gbp_questions')
    .update({
      answer_text: answerText,
      answered_at: new Date().toISOString(),
      answered_by: 'the_namkhan',
    })
    .eq('question_id', questionId)
    .eq('property_id', propertyId);

  if (upErr) return NextResponse.json({ ok: false, error: 'db_update_failed: ' + upErr.message }, { status: 500 });

  // Optionally call google-sync to post to GBP API (non-blocking on failure)
  const googleQuestionName = (qrow as { google_question_name?: string | null }).google_question_name ?? null;
  if (googleQuestionName) {
    try {
      await sb.functions.invoke('google-sync', {
        body: { action: 'post-qa-answer', propertyID: propertyId, questionName: googleQuestionName, answerText },
      });
    } catch { /* best-effort — DB is already saved */ }
  }

  return NextResponse.json({ ok: true, synced_to_google: !!googleQuestionName });
}
