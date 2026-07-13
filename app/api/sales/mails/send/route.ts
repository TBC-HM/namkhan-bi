// app/api/sales/mails/send/route.ts
// POST { mailbox_id, to, cc?, bcc?, subject, body_html, thread_id?, in_reply_to? }
// The From: header is enforced to the shared mailbox_address of the
// connection — clients cannot spoof another sender.
import { NextRequest, NextResponse } from 'next/server';
import { refreshIfExpired, sendMessage } from '@/lib/sharedGmail';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface SendBody {
  mailbox_id?: string;
  to?: string;
  cc?: string;
  bcc?: string;
  subject?: string;
  body_html?: string;
  thread_id?: string;
  in_reply_to?: string;
  references?: string;
}

export async function POST(req: NextRequest) {
  let body: SendBody;
  try { body = (await req.json()) as SendBody; }
  catch { return NextResponse.json({ error: 'invalid_json' }, { status: 400 }); }
  const { mailbox_id, to, subject, body_html } = body;
  if (!mailbox_id || !to || !subject || !body_html) {
    return NextResponse.json({ error: 'missing_params' }, { status: 400 });
  }
  try {
    const { access, mailbox } = await refreshIfExpired(mailbox_id);
    const sent = await sendMessage(access, {
      from: mailbox.mailbox_address,
      to,
      cc: body.cc,
      bcc: body.bcc,
      subject,
      body_html,
      thread_id: body.thread_id,
      in_reply_to: body.in_reply_to,
      references: body.references,
    });
    return NextResponse.json({ ok: true, id: sent.id, threadId: sent.threadId });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'unknown';
    return NextResponse.json({ error: 'send_failed', detail: msg }, { status: 500 });
  }
}
