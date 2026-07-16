// app/api/mail/ai/polish/route.ts
// POST { draft, tone?, mode? } → { ok: true, polished: string }
// PBS 2026-07-17 · adds `mode` param (polish|shorten|lengthen|warm|formalize).
import { NextRequest, NextResponse } from 'next/server';
import { getCurrentAuthUser } from '@/lib/userGmail';
import { callAnthropic, polishSystemFor, POLISH_MODES, type PolishMode } from '@/lib/mail/anthropic';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface Body { draft?: string; tone?: string; mode?: string }

export async function POST(req: NextRequest) {
  const user = await getCurrentAuthUser();
  if (!user) return NextResponse.json({ ok: false, error: 'not_signed_in' }, { status: 401 });
  const b = (await req.json().catch(() => ({}))) as Body;
  if (!b.draft || !b.draft.trim()) return NextResponse.json({ ok: false, error: 'missing_draft' }, { status: 400 });
  const tone = b.tone || 'warm-professional';
  const mode: PolishMode = (POLISH_MODES as string[]).includes(b.mode || '') ? (b.mode as PolishMode) : 'polish';

  try {
    const system = polishSystemFor(mode);
    const prompt = `Rewrite this email draft. Mode: ${mode}. Tone: ${tone}. Preserve the writer's intent and any facts/numbers. Return the rewritten BODY only — no explanations, no "Here is the polished version" preamble.\n\nDRAFT:\n${b.draft}`;
    const polished = await callAnthropic({ system, prompt, maxTokens: 900 });
    return NextResponse.json({ ok: true, polished, mode });
  } catch (e: unknown) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : 'polish_failed' }, { status: 500 });
  }
}
