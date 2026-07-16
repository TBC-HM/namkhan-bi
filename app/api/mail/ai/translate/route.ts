// app/api/mail/ai/translate/route.ts
// POST { text, target_lang } → { ok: true, translated: string, target_lang: string }
// PBS 2026-07-17 · used by the message-pane summary card language dropdown.
import { NextRequest, NextResponse } from 'next/server';
import { getCurrentAuthUser } from '@/lib/userGmail';
import { callAnthropic, VECTOR_SYSTEM } from '@/lib/mail/anthropic';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const LANG_LABEL: Record<string, string> = {
  EN: 'English',
  FR: 'French',
  DE: 'German',
  ES: 'Spanish',
  TH: 'Thai',
  LO: 'Lao',
  JA: 'Japanese',
  ZH: 'Chinese (Simplified)',
};

interface Body { text?: string; target_lang?: string }

export async function POST(req: NextRequest) {
  const user = await getCurrentAuthUser();
  if (!user) return NextResponse.json({ ok: false, error: 'not_signed_in' }, { status: 401 });
  const b = (await req.json().catch(() => ({}))) as Body;
  const text = (b.text || '').trim();
  const lang = (b.target_lang || '').toUpperCase();
  if (!text) return NextResponse.json({ ok: false, error: 'missing_text' }, { status: 400 });
  if (!LANG_LABEL[lang]) return NextResponse.json({ ok: false, error: 'unknown_lang' }, { status: 400 });

  try {
    const prompt = `Translate the following text into ${LANG_LABEL[lang]}. Preserve bullet structure, numbers, and any "Open questions:" heading verbatim (translate its label). Return ONLY the translation — no explanations, no source echo.\n\nTEXT:\n${text}`;
    const translated = await callAnthropic({ system: VECTOR_SYSTEM, prompt, maxTokens: 900 });
    return NextResponse.json({ ok: true, translated, target_lang: lang });
  } catch (e: unknown) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : 'translate_failed' }, { status: 500 });
  }
}
