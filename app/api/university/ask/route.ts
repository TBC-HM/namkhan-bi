// app/api/university/ask/route.ts
// TBC University · the ask window backend.
// Flow (design brief §D): fn_university_search (FTS, module-scoped first) →
// ONE Anthropic call answering ONLY from the retrieved articles → citations →
// fn_university_question_log on EVERY ask (answered true/false).
// Session-gated by middleware like every /api/* route. Fallback wording is
// fixed by the brief: "I'm not sure. I've flagged this for PBS."

import { NextResponse, type NextRequest } from 'next/server';
import { cookies } from 'next/headers';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const FALLBACK = "I'm not sure. I've flagged this for PBS.";

type Hit = {
  slug: string; module: string; article_type: string; title: string;
  purpose: string; body_md: string; related: string[] | null; rank: number; in_module: boolean;
};

// Best-effort user email from the Supabase auth cookie (same JWT middleware
// validates). Never blocks the ask — returns null on any parse failure.
function userEmailFromCookies(): string | null {
  try {
    const all = cookies().getAll();
    const authCookie = all
      .filter((c) => /^sb-.*-auth-token(\.0)?$/.test(c.name))
      .map((c) => c.value)
      .join('');
    if (!authCookie) return null;
    let raw = authCookie;
    if (raw.startsWith('base64-')) {
      raw = Buffer.from(raw.slice(7), 'base64').toString('utf8');
    }
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

async function callAnthropic(system: string, userPrompt: string): Promise<string> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) throw new Error('anthropic_api_key_missing');
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
    body: JSON.stringify({
      model: 'claude-sonnet-4-6',
      max_tokens: 700,
      system,
      messages: [{ role: 'user', content: userPrompt }],
    }),
  });
  if (!res.ok) {
    const t = await res.text().catch(() => '');
    throw new Error('anthropic_' + res.status + ' ' + t.slice(0, 200));
  }
  const j = await res.json();
  return String(j?.content?.[0]?.text ?? '');
}

const SYSTEM = [
  'You are the help assistant of TBC University, answering questions from hotel staff and the owner at The Namkhan.',
  'Answer ONLY from the provided articles. Never invent steps, buttons, timings or rules that are not in the articles.',
  'Write in plain, friendly language a busy hotel staff member can follow — short sentences, numbered steps when the user needs to do something.',
  'Keep the answer under 180 words.',
  'If the articles do not contain the answer, reply with exactly: NOT_COVERED',
].join('\n');

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as { question?: string; module?: string | null; route?: string | null };
  const question = String(body.question ?? '').trim().slice(0, 800);
  const moduleKey = body.module ? String(body.module).trim().slice(0, 60) : null;
  const route = body.route ? String(body.route).trim().slice(0, 200) : null;
  if (!question) return NextResponse.json({ ok: false, error: 'question required' }, { status: 400 });

  const sb = getSupabaseAdmin();
  const userEmail = userEmailFromCookies();

  const log = async (retrieved: string[], answer: string | null, answered: boolean) => {
    try {
      await sb.rpc('fn_university_question_log', {
        p_question: question, p_route: route, p_module: moduleKey, p_user_email: userEmail,
        p_retrieved_slugs: retrieved, p_answer_given: answer, p_answered: answered,
      });
    } catch { /* logging must never break the answer */ }
  };

  // 1 — retrieve
  let hits: Hit[] = [];
  try {
    const { data, error } = await sb.rpc('fn_university_search', { p_q: question, p_module: moduleKey });
    if (error) throw new Error(error.message);
    hits = (data as Hit[] | null) ?? [];
  } catch (e) {
    await log([], null, false);
    return NextResponse.json({ ok: false, error: 'search_failed: ' + (e instanceof Error ? e.message : 'unknown') }, { status: 500 });
  }

  if (hits.length === 0) {
    await log([], FALLBACK, false);
    return NextResponse.json({ ok: true, answer: FALLBACK, citations: [], answered: false });
  }

  // 2 — answer (one call, top 5 articles as grounding)
  const top = hits.slice(0, 5);
  const corpus = top.map((h, i) =>
    `--- ARTICLE ${i + 1} · slug: ${h.slug} · title: ${h.title}\n${h.purpose}\n\n${h.body_md}`,
  ).join('\n\n');
  const userPrompt = `QUESTION (asked${route ? ` from page ${route}` : ''}${moduleKey ? ` about the ${moduleKey} module` : ''}):\n${question}\n\nARTICLES:\n${corpus}`;

  let answer = '';
  try {
    answer = (await callAnthropic(SYSTEM, userPrompt)).trim();
  } catch {
    // Model unavailable — still useful: point at the top articles.
    const citations = top.slice(0, 3).map((h) => ({ slug: h.slug, title: h.title, module: h.module }));
    await log(top.map((h) => h.slug), null, false);
    return NextResponse.json({
      ok: true,
      answer: 'The assistant is unavailable right now — but these articles should cover it:',
      citations, answered: false,
    });
  }

  const declined = answer === '' || answer.includes('NOT_COVERED');
  const citations = declined ? [] : top.slice(0, 3).map((h) => ({ slug: h.slug, title: h.title, module: h.module }));
  const finalAnswer = declined ? FALLBACK : answer;

  // 3 — log everything
  await log(top.map((h) => h.slug), finalAnswer, !declined);

  return NextResponse.json({ ok: true, answer: finalAnswer, citations, answered: !declined });
}
