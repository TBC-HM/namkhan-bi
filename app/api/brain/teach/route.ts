// app/api/brain/teach/route.ts
// BRAIN v4 · "point the brain at documents": records question→doc hints and
// pushes flagged unreadable docs to the front of the OCR queue (priority 20).
// POST { question, doc_ids: uuid[] }. Session-gated by middleware.

import { NextResponse, type NextRequest } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  let body: { question?: string; doc_ids?: string[] } = {};
  try { body = await req.json(); } catch { /* noop */ }
  const question = (body.question ?? '').trim();
  const docIds = Array.isArray(body.doc_ids) ? body.doc_ids.slice(0, 20) : [];
  if (!question || docIds.length === 0) {
    return NextResponse.json({ ok: false, error: 'question and doc_ids required' }, { status: 400 });
  }
  const sb = getSupabaseAdmin();
  const { data, error } = await sb.rpc('fn_brain_teach', { p_question: question, p_doc_ids: docIds });
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, result: data });
}
