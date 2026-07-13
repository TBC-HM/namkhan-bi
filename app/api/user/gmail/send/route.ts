// app/api/user/gmail/send/route.ts
// POST: send an email from the currently-signed-in user's Gmail. Builds
// a multipart/alternative RFC 2822 message and calls Gmail v1's send.
// If thread_id is provided, Gmail keeps the message in that thread.
// If in_reply_to is provided, we set In-Reply-To + References so external
// mail clients thread it correctly.
import { NextRequest, NextResponse } from 'next/server';
import { getCurrentAuthUser, refreshIfExpired, sendMessage } from '@/lib/userGmail';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface Body {
  to?: string;
  cc?: string;
  bcc?: string;
  subject?: string;
  body_html?: string;
  body_plain?: string;
  in_reply_to?: string;
  thread_id?: string;
}

export async function POST(req: NextRequest) {
  const user = await getCurrentAuthUser();
  if (!user) return NextResponse.json({ error: 'not_signed_in' }, { status: 401 });
  const b = (await req.json().catch(() => ({}))) as Body;
  if (!b.to || !b.subject || !b.body_html) {
    return NextResponse.json({ error: 'missing_fields', detail: 'to, subject, body_html required' }, { status: 400 });
  }
  try {
    const { access, gmail } = await refreshIfExpired(user.id);
    const meta = (user.user_metadata ?? {}) as Record<string, unknown>;
    const display = typeof meta.full_name === 'string' ? meta.full_name : gmail;
    const from = display + ' <' + gmail + '>';
    const references = b.in_reply_to ?? undefined;
    const sent = await sendMessage(access, {
      from,
      to: b.to,
      cc: b.cc,
      bcc: b.bcc,
      subject: b.subject,
      body_html: b.body_html,
      body_plain: b.body_plain,
      in_reply_to: b.in_reply_to,
      references,
      thread_id: b.thread_id,
    });
    return NextResponse.json({ ok: true, id: sent.id, threadId: sent.threadId });
  } catch (e: unknown) {
    return NextResponse.json({ error: 'send_failed', detail: e instanceof Error ? e.message : 'unknown' }, { status: 500 });
  }
}
