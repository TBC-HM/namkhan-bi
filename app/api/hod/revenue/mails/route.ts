// app/api/hod/revenue/mails/route.ts
// GET — list up to `max` messages from Mai Vo (rm@thenamkhan.com) in the
// current user's Gmail, excluding those already marked HOD-DISMISSED.
// PBS 2026-07-14.
import { NextRequest, NextResponse } from 'next/server';
import { getCurrentAuthUser, listMessagesInLabel } from '@/lib/userGmail';
import { RM_GMAIL_Q } from '@/lib/hodRevenueMail';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const user = await getCurrentAuthUser();
  if (!user) return NextResponse.json({ ok: false, error: 'not_signed_in' }, { status: 401 });
  const url = new URL(req.url);
  const max = Math.max(1, Math.min(50, Number(url.searchParams.get('max') ?? '30')));
  try {
    const res = await listMessagesInLabel(user.id, '', RM_GMAIL_Q, undefined, max);
    const rows = res.messages.map((m) => ({
      id: m.id,
      threadId: m.threadId,
      subject: m.subject,
      from: m.from,
      date: m.date,
      dateMs: m.dateMs,
      snippet: m.snippet,
      unread: m.unread,
    }));
    return NextResponse.json({ ok: true, data: rows });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'list_failed';
    if (msg.startsWith('gmail_401')) return NextResponse.json({ ok: false, error: 'gmail_not_connected' }, { status: 401 });
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
