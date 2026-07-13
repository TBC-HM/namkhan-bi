// app/api/mail/reply/route.ts
// POST { threadId, inReplyToId, to, subject, body }
// Sends a reply in the given Gmail thread, setting proper In-Reply-To/References.
import { NextRequest, NextResponse } from 'next/server';
import { getCurrentAuthUser, replyToMessage } from '@/lib/userGmail';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface Body { threadId?: string; inReplyToId?: string; to?: string; subject?: string; body?: string }

export async function POST(req: NextRequest) {
  const user = await getCurrentAuthUser();
  if (!user) return NextResponse.json({ ok: false, error: 'not_signed_in' }, { status: 401 });
  const b = (await req.json().catch(() => ({}))) as Body;
  if (!b.threadId || !b.inReplyToId || !b.to || !b.subject || typeof b.body !== 'string') {
    return NextResponse.json({ ok: false, error: 'missing_fields' }, { status: 400 });
  }
  try {
    const res = await replyToMessage(user.id, b.threadId, b.inReplyToId, b.body, b.subject, b.to);
    return NextResponse.json({ ok: true, data: res });
  } catch (e: unknown) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : 'reply_failed' }, { status: 500 });
  }
}
