// app/api/mail/ai/summarize/route.ts
// POST { thread_id } → { ok: true, summary: string }
// Pulls the thread via getThread (same helper the /api/mail/thread route uses)
// and asks Anthropic for a 3-4 bullet summary + open questions.
import { NextRequest, NextResponse } from 'next/server';
import { getCurrentAuthUser, getThread } from '@/lib/userGmail';
import { callAnthropic, VECTOR_SYSTEM } from '@/lib/mail/anthropic';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface Body { thread_id?: string }

export async function POST(req: NextRequest) {
  const user = await getCurrentAuthUser();
  if (!user) return NextResponse.json({ ok: false, error: 'not_signed_in' }, { status: 401 });
  const b = (await req.json().catch(() => ({}))) as Body;
  if (!b.thread_id) return NextResponse.json({ ok: false, error: 'missing_thread_id' }, { status: 400 });

  try {
    const msgs = await getThread(user.id, b.thread_id);
    if (!msgs || msgs.length === 0) {
      return NextResponse.json({ ok: false, error: 'thread_empty' }, { status: 404 });
    }
    const transcript = msgs.map((m, i) => {
      const body = (m.textBody || m.snippet || '').slice(0, 4000);
      return `--- Message ${i + 1} (${m.date || ''}) ---\nFrom: ${m.from}\nTo: ${m.to}\nSubject: ${m.subject}\n\n${body}`;
    }).join('\n\n');

    const prompt = `Summarize this email thread in 3-4 bullets, then list any open questions on a separate line prefixed with "Open questions:". Keep it tight — no filler.\n\n${transcript}`;
    const summary = await callAnthropic({ system: VECTOR_SYSTEM, prompt, maxTokens: 600 });
    return NextResponse.json({ ok: true, summary });
  } catch (e: unknown) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : 'summarize_failed' }, { status: 500 });
  }
}
