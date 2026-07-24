// app/api/brain/confirm/route.ts
// BRAIN v4 · preserve a validated answer (full or owner-edited part) as
// verified knowledge. Embedded immediately so it is retrievable on the next
// similar question. POST { question, answer_md, doc_ids?, sensitivity? }.
// Session-gated by middleware; DB via service role.

import { NextResponse, type NextRequest } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { embedTexts } from '@/lib/brain/llm';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const TIERS = new Set(['staff_ok', 'management', 'owner_only', 'legal_confidential']);

export async function POST(req: NextRequest) {
  let body: { question?: string; answer_md?: string; doc_ids?: string[]; sensitivity?: string } = {};
  try { body = await req.json(); } catch { /* noop */ }
  const question = (body.question ?? '').trim();
  const answerMd = (body.answer_md ?? '').trim();
  if (!question || answerMd.length < 20) {
    return NextResponse.json({ ok: false, error: 'question + answer_md (≥20 chars) required' }, { status: 400 });
  }
  const sensitivity = TIERS.has(body.sensitivity ?? '') ? body.sensitivity : 'owner_only';

  let embedding: string | null = null;
  try {
    const v = await embedTexts([question + '\n' + answerMd.slice(0, 2000)]);
    if (v?.[0]) embedding = JSON.stringify(v[0]);
  } catch { /* stored without embedding; FTS still finds it */ }

  const sb = getSupabaseAdmin();
  const { data, error } = await sb.rpc('fn_brain_confirm_answer', {
    p_question: question, p_answer_md: answerMd,
    p_doc_ids: Array.isArray(body.doc_ids) ? body.doc_ids.slice(0, 20) : [],
    p_sensitivity: sensitivity, p_embedding: embedding,
  });
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, verified_id: data });
}
