// app/api/brain/ask/route.ts
// BRAIN v1 · "Ask the company brain". v1 caller role = owner (the window lives
// on /holding/it/brain, an owner surface), so retrieval runs at the
// legal_confidential tier. All logic lives in lib/brain/ask-core.ts — shared
// verbatim with the /api/cron/brain-battery leak tests. Every ask is logged
// to brain.questions via fn_brain_log_question. Session-gated by middleware.

import { NextResponse, type NextRequest } from 'next/server';
import { cookies } from 'next/headers';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { brainAsk } from '@/lib/brain/ask-core';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const V1_ROLE = 'owner';
const V1_TIER = 'legal_confidential'; // owner sees every tier; ACL still SQL-side

function userEmailFromCookies(): string | null {
  try {
    const all = cookies().getAll();
    const authCookie = all
      .filter((c) => /^sb-.*-auth-token(\.0)?$/.test(c.name))
      .map((c) => c.value)
      .join('');
    if (!authCookie) return null;
    let raw = authCookie;
    if (raw.startsWith('base64-')) raw = Buffer.from(raw.slice(7), 'base64').toString('utf8');
    const parsed = JSON.parse(raw) as { access_token?: string };
    const token = parsed?.access_token;
    if (!token) return null;
    const payloadB64 = token.split('.')[1]?.replace(/-/g, '+').replace(/_/g, '/');
    if (!payloadB64) return null;
    const pad = payloadB64.length % 4 === 0 ? payloadB64 : payloadB64 + '='.repeat(4 - (payloadB64.length % 4));
    const claims = JSON.parse(Buffer.from(pad, 'base64').toString('utf8')) as { email?: string };
    return typeof claims.email === 'string' ? claims.email : null;
  } catch { return null; }
}

export async function POST(req: NextRequest) {
  let body: { question?: string } = {};
  try { body = await req.json(); } catch { /* noop */ }
  const question = (body.question ?? '').trim().slice(0, 2000);
  if (!question) return NextResponse.json({ ok: false, error: 'question required' }, { status: 400 });

  const sb = getSupabaseAdmin();
  const asker = userEmailFromCookies();

  try {
    const result = await brainAsk(question, V1_TIER);
    try {
      await sb.rpc('fn_brain_log_question', {
        p_question: question, p_asker_email: asker, p_role_used: V1_ROLE,
        p_retrieved_chunk_ids: result.retrievedChunkIds,
        p_answer: result.answered ? result.answer : null,
        p_answered: result.answered, p_refused_reason: result.refusedReason,
      });
    } catch { /* logging must never block the answer */ }
    return NextResponse.json({
      ok: true, answered: result.answered, answer: result.answer, sources: result.sources,
      // BRAIN v5: answers built on the live HR source must not be preserved/confirmed
      used_hr: result.usedHr,
    });
  } catch (e) {
    try {
      await sb.rpc('fn_brain_log_question', {
        p_question: question, p_asker_email: asker, p_role_used: V1_ROLE,
        p_retrieved_chunk_ids: [], p_answer: null, p_answered: false, p_refused_reason: 'error',
      });
    } catch { /* noop */ }
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : 'ask failed' }, { status: 502 });
  }
}
