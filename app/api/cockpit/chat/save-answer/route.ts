// app/api/cockpit/chat/save-answer/route.ts
// Save a chat answer as a verified answer in brain.verified_answers
// Brief: central-chat-missing-ui-features
// POST { question, answer_md, doc_ids? }

import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { question, answer_md, doc_ids } = body as {
      question?: string;
      answer_md?: string;
      doc_ids?: string[];
    };

    if (!question || !answer_md) {
      return NextResponse.json(
        { ok: false, error: 'question and answer_md required' },
        { status: 400 }
      );
    }

    const sb = getSupabaseAdmin();
    const { data, error } = await sb.rpc('fn_save_verified_answer', {
      p_question: question.trim(),
      p_answer_md: answer_md,
      p_doc_ids: doc_ids || null,
      p_confirmed_by: 'pbs',
    });

    if (error) {
      return NextResponse.json(
        { ok: false, error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json(data);
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : 'unknown' },
      { status: 500 }
    );
  }
}