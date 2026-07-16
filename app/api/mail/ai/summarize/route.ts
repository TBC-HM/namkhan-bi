// app/api/mail/ai/summarize/route.ts
// POST { thread_id, refine_mode? } → { ok: true, summary: string }
// PBS 2026-07-17 · adds refine_mode ("shorten" | "actionable" | "focus_rate" | "focus_dates").
import { NextRequest, NextResponse } from 'next/server';
import { getCurrentAuthUser, getThread } from '@/lib/userGmail';
import { callAnthropic, VECTOR_SYSTEM } from '@/lib/mail/anthropic';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type RefineMode = 'shorten' | 'actionable' | 'focus_rate' | 'focus_dates';

interface Body { thread_id?: string; refine_mode?: string }

function refineHint(mode: RefineMode | null): string {
  switch (mode) {
    case 'shorten':     return 'Return AT MOST 2 bullets. Every word must earn its place.';
    case 'actionable':  return 'Focus on actions I need to take. Each bullet must begin with a verb.';
    case 'focus_rate':  return 'Focus on rates, prices, discounts, currency, commissions. Ignore pleasantries.';
    case 'focus_dates': return 'Focus on dates, deadlines, arrival/departure, response windows. Include every date mentioned.';
    default:            return '';
  }
}

export async function POST(req: NextRequest) {
  const user = await getCurrentAuthUser();
  if (!user) return NextResponse.json({ ok: false, error: 'not_signed_in' }, { status: 401 });
  const b = (await req.json().catch(() => ({}))) as Body;
  if (!b.thread_id) return NextResponse.json({ ok: false, error: 'missing_thread_id' }, { status: 400 });
  const validModes: RefineMode[] = ['shorten', 'actionable', 'focus_rate', 'focus_dates'];
  const refine: RefineMode | null = (validModes as string[]).includes(b.refine_mode || '') ? (b.refine_mode as RefineMode) : null;

  try {
    const msgs = await getThread(user.id, b.thread_id);
    if (!msgs || msgs.length === 0) {
      return NextResponse.json({ ok: false, error: 'thread_empty' }, { status: 404 });
    }
    const transcript = msgs.map((m, i) => {
      const body = (m.textBody || m.snippet || '').slice(0, 4000);
      return `--- Message ${i + 1} (${m.date || ''}) ---\nFrom: ${m.from}\nTo: ${m.to}\nSubject: ${m.subject}\n\n${body}`;
    }).join('\n\n');

    const hint = refineHint(refine);
    const prompt = `Summarize this email thread in 3-4 bullets, then list any open questions on a separate line prefixed with "Open questions:". Keep it tight — no filler.${hint ? '\n\nRefinement: ' + hint : ''}\n\n${transcript}`;
    const summary = await callAnthropic({ system: VECTOR_SYSTEM, prompt, maxTokens: 700 });
    return NextResponse.json({ ok: true, summary, refine_mode: refine });
  } catch (e: unknown) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : 'summarize_failed' }, { status: 500 });
  }
}
