// app/api/newsletter/ai-propose/route.ts
// Optional AI proposal endpoint. Falls back with 503 if no key configured.

import { NextResponse, type NextRequest } from 'next/server';

const SYSTEM = 'You are the marketing writer for The Namkhan, a 30-key riverside boutique retreat outside Luang Prabang, Laos. Your voice is calm, understated, warm, never salesy. Write for repeat travellers who value quiet, nature, and craft. Return STRICT JSON with keys: subject (string, <= 65 chars, no exclamation marks), body_md (string, plain Markdown, 4-8 short paragraphs, greet with "Dear {{first_name}},"), blocks (array of objects with type: header|paragraph|cta|divider and text|label|url fields). Do not use emojis. Do not fabricate offers.';

async function callAnthropic(userPrompt: string) {
  const key = process.env.ANTHROPIC_API_KEY!;
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
    body: JSON.stringify({
      model: 'claude-sonnet-4-7',
      max_tokens: 1200,
      system: SYSTEM,
      messages: [{ role: 'user', content: userPrompt }],
    }),
  });
  if (!res.ok) throw new Error('anthropic_' + res.status);
  const j = await res.json();
  const text = j?.content?.[0]?.text || '{}';
  return JSON.parse(text);
}

async function callOpenAI(userPrompt: string) {
  const key = process.env.OPENAI_API_KEY!;
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Authorization': 'Bearer ' + key, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: SYSTEM },
        { role: 'user', content: userPrompt },
      ],
    }),
  });
  if (!res.ok) throw new Error('openai_' + res.status);
  const j = await res.json();
  const text = j?.choices?.[0]?.message?.content || '{}';
  return JSON.parse(text);
}

export async function POST(req: NextRequest) {
  let body: { prompt: string; filterSummary: Record<string, unknown>; recipientCount: number };
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'bad_json' }, { status: 400 }); }
  const context = 'Audience filter: ' + JSON.stringify(body.filterSummary) + '\nRecipient count: ' + body.recipientCount + '\nUser prompt: ' + body.prompt;
  try {
    if (process.env.ANTHROPIC_API_KEY) { return NextResponse.json(await callAnthropic(context)); }
    if (process.env.OPENAI_API_KEY)    { return NextResponse.json(await callOpenAI(context)); }
    return NextResponse.json({ error: 'no LLM key configured; set ANTHROPIC_API_KEY or OPENAI_API_KEY in Vercel.' }, { status: 503 });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export const dynamic = 'force-dynamic';
