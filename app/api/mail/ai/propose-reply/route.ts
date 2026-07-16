// app/api/mail/ai/propose-reply/route.ts
// POST { thread_id, tone? } → { ok: true, draft: string }
import { NextRequest, NextResponse } from 'next/server';
import { getCurrentAuthUser, getThread } from '@/lib/userGmail';
import { callAnthropic, VECTOR_SYSTEM } from '@/lib/mail/anthropic';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface Body { thread_id?: string; tone?: string }

export async function POST(req: NextRequest) {
  const user = await getCurrentAuthUser();
  if (!user) return NextResponse.json({ ok: false, error: 'not_signed_in' }, { status: 401 });
  const b = (await req.json().catch(() => ({}))) as Body;
  if (!b.thread_id) return NextResponse.json({ ok: false, error: 'missing_thread_id' }, { status: 400 });
  const tone = b.tone || 'warm-professional';

  try {
    const msgs = await getThread(user.id, b.thread_id);
    if (!msgs || msgs.length === 0) return NextResponse.json({ ok: false, error: 'thread_empty' }, { status: 404 });
    const transcript = msgs.map((m, i) => {
      const body = (m.textBody || m.snippet || '').slice(0, 4000);
      return `--- Message ${i + 1} (${m.date || ''}) ---\nFrom: ${m.from}\nTo: ${m.to}\nSubject: ${m.subject}\n\n${body}`;
    }).join('\n\n');

    const prompt = `Draft a reply to the LATEST message in this thread. Tone: ${tone}. Return the reply BODY only — no greeting placeholder like "[Name]", no "Subject:" line, no sign-off boilerplate beyond a single warm closing sentence. End with a clear next step.\n\n${transcript}`;
    const draft = await callAnthropic({ system: VECTOR_SYSTEM, prompt, maxTokens: 700 });
    return NextResponse.json({ ok: true, draft });
  } catch (e: unknown) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : 'propose_failed' }, { status: 500 });
  }
}
