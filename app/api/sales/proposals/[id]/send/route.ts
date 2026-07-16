// POST /api/sales/proposals/[id]/send
// Pre-send gate: re-check rate_inventory for every room block.
// Returns 409 with the ProposalCheck details if any room is unavailable
// (status === 'red'). Yellow / green proceed.
//
// PBS 2026-07-16 — DIRECT GMAIL SEND primary path. Previously the route only
// fired a Make webhook (`proposal_sent`) — with MAKE_WEBHOOK_PROPOSAL_SENT
// unset, the DB was marked 'sent' but zero email actually left. Now we send
// via the current user's Gmail (via lib/userGmail.sendMessage) directly, and
// fire the Make webhook as a secondary CRM-log trigger. If no recipient email
// can be resolved, we surface the error to the composer so PBS knows.

import { NextResponse } from 'next/server';
import { markProposalSent, getProposalWithBlocks, getInquiry, checkProposalRoomsAvail } from '@/lib/sales';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { fireMakeWebhook } from '@/lib/makeWebhooks';
import { getCurrentAuthUser, refreshIfExpired, sendMessage } from '@/lib/userGmail';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

interface Ctx { params: { id: string } }

export async function POST(req: Request, { params }: Ctx) {
  const url = new URL(req.url);
  const force = url.searchParams.get('force') === '1';

  // ---- pre-send room availability gate ----
  const check = await checkProposalRoomsAvail(params.id);
  if (!check) return NextResponse.json({ error: 'proposal not found' }, { status: 404 });
  if (check.status === 'red' && !force) {
    return NextResponse.json({ error: 'rooms_unavailable', message: check.message, check }, { status: 409 });
  }

  // ---- resolve recipient email BEFORE marking sent ----
  const sb = getSupabaseAdmin();
  const { proposal, blocks, email } = await getProposalWithBlocks(params.id);
  if (!proposal) return NextResponse.json({ error: 'proposal_not_found' }, { status: 404 });

  const inq = proposal.inquiry_id ? await getInquiry(proposal.inquiry_id) : null;
  let recipientEmail: string | null = inq?.guest_email ?? null;
  let recipientName: string | null = inq?.guest_name ?? proposal.guest_name_snapshot ?? null;

  if (!recipientEmail) {
    const leadId = (proposal as unknown as { lead_id: number | null }).lead_id;
    if (leadId) {
      const { data: lead } = await sb.schema('sales').from('leads')
        .select('email, decision_maker_name, company_name')
        .eq('id', leadId).maybeSingle();
      const l = lead as { email: string | null; decision_maker_name: string | null; company_name: string | null } | null;
      if (l?.email) {
        recipientEmail = l.email;
        recipientName = l.decision_maker_name ?? l.company_name ?? recipientName;
      }
    }
  }

  if (!recipientEmail) {
    return NextResponse.json({
      error: 'no_recipient_email',
      message: 'This proposal has no linked inquiry or lead with an email address. Add a recipient before sending.',
    }, { status: 400 });
  }

  // ---- render the newsletter-quality HTML ----
  const proto = process.env.VERCEL_URL ? 'https' : 'http';
  const host = process.env.VERCEL_URL ?? 'localhost:3000';
  let emailHtml: string | null = null;
  let emailSubject: string = email?.subject ?? `Your stay at The Namkhan`;
  try {
    const r = await fetch(`${proto}://${host}/api/sales/proposals/${params.id}/email/preview?format=json`, { cache: 'no-store' });
    if (r.ok) {
      const j = await r.json();
      emailHtml = j.html ?? null;
      if (j.subject) emailSubject = j.subject;
    }
  } catch (_) { /* non-fatal */ }

  if (!emailHtml) {
    return NextResponse.json({ error: 'preview_render_failed', message: 'Could not render email HTML — send aborted so no partial send.' }, { status: 500 });
  }

  // ---- send via the current user's Gmail ----
  const user = await getCurrentAuthUser();
  if (!user) return NextResponse.json({ error: 'not_signed_in' }, { status: 401 });

  let gmailMessageId: string | null = null;
  let gmailError: string | null = null;
  try {
    const { access, gmail } = await refreshIfExpired(user.id);
    const toHeader = recipientName ? `"${recipientName.replace(/"/g, '')}" <${recipientEmail}>` : recipientEmail;
    const sendRes = await sendMessage(access, {
      from: gmail,
      to: toHeader,
      subject: emailSubject,
      body_html: emailHtml,
    });
    gmailMessageId = sendRes?.id ?? null;
  } catch (e: unknown) {
    gmailError = e instanceof Error ? e.message : 'gmail_send_failed';
  }

  if (gmailError && !gmailMessageId) {
    return NextResponse.json({
      error: 'gmail_send_failed',
      message: gmailError,
      hint: 'Check your Gmail connection at /mail (Connect / Reconnect Email).',
    }, { status: 500 });
  }

  // ---- mark as sent + generate public_token ----
  const sent = await markProposalSent(params.id);
  if (!sent) {
    return NextResponse.json({
      error: 'mark_sent_failed',
      message: 'Email was sent via Gmail (id=' + gmailMessageId + ') but the DB flag could not be updated. Investigate manually.',
    }, { status: 500 });
  }
  const publicUrl = `${proto}://${host}/p/${sent.token}`;
  const totalLak = blocks.reduce((s, b) => s + Number(b.total_lak ?? 0), 0);

  // ---- fire Make webhook as SECONDARY CRM log trigger (non-blocking) ----
  await fireMakeWebhook('proposal_sent', {
    proposal_id: params.id,
    public_token: sent.token,
    public_url: publicUrl,
    recipient_email: recipientEmail,
    recipient_phone: inq?.guest_phone ?? null,
    guest_name: recipientName,
    date_in: proposal.date_in_snapshot ?? inq?.date_in ?? null,
    date_out: proposal.date_out_snapshot ?? inq?.date_out ?? null,
    total_lak: totalLak,
    avail_check_status: check.status,
    avail_check_message: check.message,
    email_subject: emailSubject,
    email_html: emailHtml,
    gmail_message_id: gmailMessageId,
    blocks: blocks.map(b => ({ label: b.label, type: b.block_type, qty: b.qty, nights: b.nights, total_lak: b.total_lak, hero_asset_id: b.hero_asset_id })),
  });

  return NextResponse.json({
    ok: true,
    token: sent.token,
    public_url: publicUrl,
    recipient_email: recipientEmail,
    gmail_message_id: gmailMessageId,
    avail_check: check,
    forced: force,
  });
}
