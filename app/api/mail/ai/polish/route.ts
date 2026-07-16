// app/api/mail/ai/polish/route.ts
// POST { draft, tone? } → { ok: true, polished: string }
import { NextRequest, NextResponse } from 'next/server';
import { getCurrentAuthUser } from '@/lib/userGmail';
import { callAnthropic, VECTOR_SYSTEM } from '@/lib/mail/anthropic';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface Body { draft?: string; tone?: string }

export async function POST(req: NextRequest) {
  const user = await getCurrentAuthUser();
  if (!user) return NextResponse.json({ ok: false, error: 'not_signed_in' }, { status: 401 });
  const b = (await req.json().catch(() => ({}))) as Body;
  if (!b.draft || !b.draft.trim()) return NextResponse.json({ ok: false, error: 'missing_draft' }, { status: 400 });
  const tone = b.tone || 'warm-professional';

  try {
    const prompt = `Polish this email draft. Tone: ${tone}. Preserve the writer's intent and any facts/numbers. Tighten sentences, fix grammar, remove filler, keep it concise. Return the polished BODY only — no explanations, no "Here is the polished version" preamble.\n\nDRAFT:\n${b.draft}`;
    const polished = await callAnthropic({ system: VECTOR_SYSTEM, prompt, maxTokens: 700 });
    return NextResponse.json({ ok: true, polished });
  } catch (e: unknown) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : 'polish_failed' }, { status: 500 });
  }
}
