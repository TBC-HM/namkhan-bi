// app/api/google/ai-draft/route.ts
// AI-assisted drafting for GBP review replies and Q&A answers.
// POST { property_id, mode: 'review_reply'|'qa_answer', ...fields }
// L22: property_id verified by requirePropertyAccess before any work.

import { NextRequest, NextResponse } from 'next/server';
import { requirePropertyAccess } from '@/lib/tenancy';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { callAnthropic, isLlmOk } from '@/lib/youtube/skills-common';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;

const PROPERTY_NAME: Record<number, string> = {
  260955:  'The Namkhan · Luang Prabang',
  1000001: 'The Donna Portals · Mallorca',
};

export async function POST(req: NextRequest) {
  let b: {
    property_id?: unknown;
    mode?: unknown;
    review_text?: unknown;
    reviewer_name?: unknown;
    rating?: unknown;
    question?: unknown;
  };
  try { b = await req.json(); }
  catch { return NextResponse.json({ ok: false, error: 'invalid_json' }, { status: 400 }); }

  const mode = String(b.mode ?? '');
  if (!['review_reply', 'qa_answer'].includes(mode)) {
    return NextResponse.json({ ok: false, error: 'mode must be review_reply or qa_answer' }, { status: 400 });
  }

  let property_id: number;
  try {
    property_id = await requirePropertyAccess(req, b.property_id as string | number | null | undefined);
  } catch (e) {
    if (e instanceof Response) return e;
    return NextResponse.json({ ok: false, error: 'access_denied' }, { status: 403 });
  }

  const propertyName = PROPERTY_NAME[property_id] ?? `Property ${property_id}`;
  const sb = getSupabaseAdmin();

  // Brief for property context (soft fail — prompt still works without it)
  let briefText = '';
  try {
    const { data } = await sb.rpc('fn_social_property_brief', { p_property_id: property_id });
    if (typeof data === 'string') briefText = data;
  } catch { /* non-blocking */ }

  const contextBlock = briefText ? `\n\nProperty context:\n${briefText}` : '';

  let systemPrompt: string;
  let userPrompt: string;

  if (mode === 'review_reply') {
    const reviewText   = String(b.review_text   ?? '').trim();
    const reviewerName = String(b.reviewer_name ?? 'Guest').trim();
    const rating       = Number(b.rating ?? 0);

    if (!reviewText) return NextResponse.json({ ok: false, error: 'review_text required' }, { status: 400 });

    systemPrompt = `You are the senior guest relations manager at ${propertyName}, a luxury boutique eco-lodge on the Mekong in Luang Prabang, Laos. Write a warm, specific, professional reply to a Google review. Rules:
- Max 200 words
- Address the reviewer by first name where given
- Reference specific things they mentioned — do not be generic
- Brand voice: warm, poetic, rooted in place — not corporate
- Rating ≤ 3: acknowledge sincerely, no defensiveness, invite private conversation
- Rating ≥ 4: genuine gratitude, reinforce what made it special
- Close with a genuine invitation to return
- Return ONLY the reply text — no subject line, no preamble${contextBlock}`;

    userPrompt = `Reviewer: ${reviewerName}\nRating: ${rating}/5\n\nReview:\n${reviewText}`;
  } else {
    const question = String(b.question ?? '').trim();
    if (!question) return NextResponse.json({ ok: false, error: 'question required' }, { status: 400 });

    systemPrompt = `You are the guest experience team at ${propertyName}, a luxury boutique eco-lodge on the Mekong in Luang Prabang, Laos. Write a warm, accurate, helpful public answer to a Google Q&A question. Rules:
- Max 150 words
- Be specific and factual — no vague generalities
- Brand voice: warm, knowledgeable, welcoming
- Pricing / availability: direct them to the website
- Return ONLY the answer text — no preamble${contextBlock}`;

    userPrompt = `Question: ${question}`;
  }

  const result = await callAnthropic({ systemPrompt, userPrompt, maxTokens: 400 });

  if (!isLlmOk(result)) {
    return NextResponse.json({ ok: false, error: result.error }, { status: 500 });
  }

  return NextResponse.json({ ok: true, draft: result.text.trim() });
}
