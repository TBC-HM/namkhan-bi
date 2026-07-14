// app/api/sales/mails/send/route.ts
// POST { mailbox_id, to, cc?, bcc?, subject, body_html, body_plain?,
//        thread_id?, in_reply_to?, references? }
// Sends FROM the alias in mailbox_id using the SHARED mailbox token via
// Send-As. Alias must be configured under the shared account
// (pb@thenamkhan.com) — otherwise Gmail returns a Send-As error.
import { NextRequest, NextResponse } from 'next/server';
import { getCurrentAuthUser } from '@/lib/userGmail';
import { sendFromShared, logSharedMailboxEvent } from '@/lib/sharedGmail';
// PBS 2026-07-14 (Sales CRM upgrade · Phase F) — after a shared-mailbox
// reply lands, look up any matching lead by thread_id and auto-advance stage.
// Best-effort; a failure here must NEVER break the send response.
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

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

    // Audit log (fire-and-forget).
    logSharedMailboxEvent({
      user_id: user.id, user_email: user.email,
      action: 'reply_sent',
      thread_id: res.thread_id,
      mailbox_alias: mailbox_id,
      metadata: { to, subject, message_id: res.message_id },
    });

    // Phase F post-send hook (best-effort, non-blocking).
    try {
      const outboundThreadId = res.thread_id || body.thread_id;
      if (outboundThreadId) {
        const admin = getSupabaseAdmin();
        const { data: leadRow } = await admin
          .from('v_leads_full')
          .select('id, stage')
          .eq('email_thread_id', outboundThreadId)
          .maybeSingle();
        const leadId = leadRow ? Number((leadRow as { id: number }).id) : null;
        if (leadId) {
          await admin.rpc('fn_lead_advance_stage', { p_lead_id: leadId, p_reason: 'outbound_reply_sent' });
        }
      }
    } catch (hookErr) {
      console.error('[sales/mails/send] auto-advance hook failed', hookErr);
    }

    return NextResponse.json(res);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'unknown';
    return NextResponse.json({ ok: false, error: 'send_failed', detail: msg }, { status: 500 });
  }
}
