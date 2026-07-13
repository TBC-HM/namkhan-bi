// app/api/mail/send/route.ts
// POST { to, cc?, bcc?, subject, body_html, body_plain?, in_reply_to?, thread_id? }
// Personal Gmail send (mirror of /api/user/gmail/send for the /mail namespace).
import { NextRequest, NextResponse } from 'next/server';
import { getCurrentAuthUser, refreshIfExpired, sendMessage } from '@/lib/userGmail';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface Body {
  to?: string; cc?: string; bcc?: string;
  subject?: string; body_html?: string; body_plain?: string;
  in_reply_to?: string; thread_id?: string;
}

export async function POST(req: NextRequest) {
  const user = await getCurrentAuthUser();
  if (!user) return NextResponse.json({ ok: false, error: 'not_signed_in' }, { status: 401 });
  const b = (await req.json().catch(() => ({}))) as Body;
  if (!b.to || !b.subject || !b.body_html) {
    return NextResponse.json({ ok: false, error: 'missing_fields' }, { status: 400 });
  }
  try {
    const { access, gmail } = await refreshIfExpired(user.id);
    const meta = (user.user_metadata ?? {}) as Record<string, unknown>;
    const display = typeof meta.full_name === 'string' ? meta.full_name : gmail;
    const from = display + ' <' + gmail + '>';
    const sent = await sendMessage(access, {
      from, to: b.to, cc: b.cc, bcc: b.bcc,
      subject: b.subject, body_html: b.body_html, body_plain: b.body_plain,
      in_reply_to: b.in_reply_to, references: b.in_reply_to, thread_id: b.thread_id,
    });
    return NextResponse.json({ ok: true, data: sent });
  } catch (e: unknown) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : 'send_failed' }, { status: 500 });
  }
}
