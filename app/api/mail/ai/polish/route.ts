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
    // PBS 2026-07-20 · v3 prompt — expand + polish. Previous v1 was too vague
    // (Claude asked "share the body"); v2 was too literal (Claude echoed short
    // fragments back). v3 tells Claude: treat the notes as SEED for a full
    // guest-facing email body — expand into 2-4 warm paragraphs even from a
    // short jotting, but never invent facts.
    const prompt = [
      `You are drafting the BODY COPY of a guest-facing hospitality email.`,
      `The notes between <<<NOTES>>> and <<<END>>> are the operator's raw jotting — treat them as SEED material.`,
      `Expand and polish them into a warm, well-formed guest-facing email body in mode: ${mode}, tone: ${tone}.`,
      `Rules:`,
      `- Preserve every fact, name, date, number, price, and offer stated by the operator.`,
      `- If the notes are short or bullet-style, EXPAND them into 2-4 flowing paragraphs suitable to send to a guest.`,
      `- Do NOT invent prices, dates, room names, or offers that are not implied by the notes.`,
      `- Do NOT add subject line, salutation, or signature — only the body paragraphs.`,
      `- Do NOT reply with meta-commentary or clarifying questions. Return the body directly.`,
      ``,
      `<<<NOTES>>>`,
      b.draft,
      `<<<END>>>`,
    ].join('\n');
    const polished = await callAnthropic({ system, prompt, maxTokens: 900 });
    return NextResponse.json({ ok: true, polished, mode });
  } catch (e: unknown) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : 'polish_failed' }, { status: 500 });
  }
}
