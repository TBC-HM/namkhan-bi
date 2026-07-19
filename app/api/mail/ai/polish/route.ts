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
    // PBS 2026-07-20 · v2 prompt — unambiguous so Claude treats the text as
    // the body to rewrite. Previous wording ("Rewrite this email draft ...
    // Return the rewritten BODY only") caused Claude to sometimes reply
    // "Please share the draft body text you'd like me to polish".
    const prompt = [
      `You are polishing the BODY COPY of an email that a hospitality operator has just typed.`,
      `The text between <<<BODY>>> and <<<END>>> IS the body — treat it as a complete draft, however short.`,
      `Rewrite it in mode: ${mode} · tone: ${tone}.`,
      `Rules:`,
      `- Keep every fact, name, date, number, price, and offer intact.`,
      `- Keep the writer's intent and voice.`,
      `- Do NOT add a subject line, salutation, or signature — return ONLY the rewritten body text.`,
      `- Do NOT ask clarifying questions and do NOT reply with meta-commentary. Just output the rewritten body.`,
      `- If the input is a single line or fragment, rewrite that same fragment — do not invent extra paragraphs.`,
      ``,
      `<<<BODY>>>`,
      b.draft,
      `<<<END>>>`,
    ].join('\n');
    const polished = await callAnthropic({ system, prompt, maxTokens: 900 });
    return NextResponse.json({ ok: true, polished, mode });
  } catch (e: unknown) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : 'polish_failed' }, { status: 500 });
  }
}
