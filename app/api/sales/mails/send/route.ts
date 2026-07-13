// app/api/sales/mails/send/route.ts
// POST { mailbox_id, to, cc?, bcc?, subject, body_html, body_plain?,
//        thread_id?, in_reply_to?, references? }
// Sends FROM the alias in mailbox_id using the current user's Gmail token
// via Send-As. If the alias isn't configured in Gmail's Send-As settings,
// we surface a plain-english error.
import { NextRequest, NextResponse } from 'next/server';
import { getCurrentAuthUser } from '@/lib/userGmail';
import { sendFromShared } from '@/lib/sharedGmail';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface SendBody {
  mailbox_id?: string;
  to?: string;
  cc?: string;
  bcc?: string;
  subject?: string;
  body_html?: string;
  body_plain?: string;
  thread_id?: string;
  in_reply_to?: string;
  references?: string;
}

export async function POST(req: NextRequest) {
  const user = await getCurrentAuthUser();
  if (!user) return NextResponse.json({ error: 'not_authenticated' }, { status: 401 });
  let body: SendBody;
  try { body = (await req.json()) as SendBody; }
  catch { return NextResponse.json({ error: 'invalid_json' }, { status: 400 }); }
  const { mailbox_id, to, subject, body_html } = body;
  if (!mailbox_id || !to || !subject || !body_html) {
    return NextResponse.json({ error: 'missing_params' }, { status: 400 });
  }
  try {
    const res = await sendFromShared(user.id, mailbox_id, {
      to,
      cc: body.cc,
      bcc: body.bcc,
      subject,
      body_html,
      body_plain: body.body_plain,
      thread_id: body.thread_id,
      in_reply_to: body.in_reply_to,
      references: body.references,
    });
    if (!res.ok) return NextResponse.json(res, { status: 400 });
    return NextResponse.json(res);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'unknown';
    return NextResponse.json({ ok: false, error: 'send_failed', detail: msg }, { status: 500 });
  }
}
