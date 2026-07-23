// app/api/university/feedback/route.ts
// TBC University · article thumbs. Every vote lands in the question log
// (university.questions) — the content backlog — via fn_university_question_log.

import { NextResponse, type NextRequest } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as { slug?: string; module?: string; helpful?: boolean };
  const slug = String(body.slug ?? '').trim().slice(0, 120);
  const moduleKey = String(body.module ?? '').trim().slice(0, 60) || null;
  const helpful = body.helpful === true;
  if (!slug) return NextResponse.json({ ok: false, error: 'slug required' }, { status: 400 });

  try {
    const sb = getSupabaseAdmin();
    const { error } = await sb.rpc('fn_university_question_log', {
      p_question: `[article feedback] ${slug}`,
      p_route: `/university/${moduleKey ?? 'unknown'}/${slug}`,
      p_module: moduleKey,
      p_user_email: null,
      p_retrieved_slugs: [slug],
      p_answer_given: null,
      p_answered: true,
      p_feedback: helpful ? 'up' : 'down',
    });
    if (error) throw new Error(error.message);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : 'log failed' }, { status: 500 });
  }
}
