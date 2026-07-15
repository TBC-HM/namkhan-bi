// POST /api/sales/proposals/[id]/send
// Pre-send gate: re-check rate_inventory for every room block.
// Returns 409 with the ProposalCheck details if any room is unavailable
// (status === 'red'). Yellow / green proceed.
//
// PBS 2026-07-16 update: also render newsletter-quality HTML and attach it
// to the Make webhook payload as `email_html` — so outbound sends can go
// straight through Make → Resend/Gmail without a second render round-trip.

import { NextResponse } from 'next/server';
import { markProposalSent, getProposalWithBlocks, getInquiry, checkProposalRoomsAvail } from '@/lib/sales';
import { fireMakeWebhook } from '@/lib/makeWebhooks';

export const dynamic = 'force-dynamic';

interface Ctx { params: { id: string } }

export async function POST(req: Request, { params }: Ctx) {
  // Optional ?force=1 lets the agent bypass the gate (logged in agent_runs).
  const url = new URL(req.url);
  const force = url.searchParams.get('force') === '1';

  // ---- pre-send room availability gate ----
  const check = await checkProposalRoomsAvail(params.id);
  if (!check) return NextResponse.json({ error: 'proposal not found' }, { status: 404 });

  if (check.status === 'red' && !force) {
    return NextResponse.json({
      error: 'rooms_unavailable',
      message: check.message,
      check,
    }, { status: 409 });
  }

  // ---- send ----
  const sent = await markProposalSent(params.id);
  if (!sent) return NextResponse.json({ error: 'send_failed' }, { status: 500 });

  const { proposal, blocks, email } = await getProposalWithBlocks(params.id);
  const inq = proposal?.inquiry_id ? await getInquiry(proposal.inquiry_id) : null;

  const totalLak = blocks.reduce((s, b) => s + Number(b.total_lak ?? 0), 0);

  const proto = process.env.VERCEL_URL ? 'https' : 'http';
  const host = process.env.VERCEL_URL ?? 'localhost:3000';
  const publicUrl = `${proto}://${host}/p/${sent.token}`;

  // Render the newsletter-quality HTML server-side.
  // Prefer an internal fetch to reuse the exact preview route logic (single source of truth).
  let emailHtml: string | null = null;
  let emailSubject: string | null = email?.subject ?? null;
  try {
    const r = await fetch(`${proto}://${host}/api/sales/proposals/${params.id}/email/preview?format=json`, {
      cache: 'no-store',
    });
    if (r.ok) {
      const j = await r.json();
      emailHtml = j.html ?? null;
      emailSubject = j.subject ?? emailSubject;
    }
  } catch (_) {
    // Non-fatal — Make can still deliver from the plain intro/outro fields.
  }

  await fireMakeWebhook('proposal_sent', {
    proposal_id: params.id,
    public_token: sent.token,
    public_url: publicUrl,
    recipient_email: inq?.guest_email ?? null,
    recipient_phone: inq?.guest_phone ?? null,
    guest_name: proposal?.guest_name_snapshot ?? inq?.guest_name ?? null,
    date_in: proposal?.date_in_snapshot ?? inq?.date_in ?? null,
    date_out: proposal?.date_out_snapshot ?? inq?.date_out ?? null,
    total_lak: totalLak,
    avail_check_status: check.status,
    avail_check_message: check.message,
    email_subject: emailSubject,
    email_intro_md: email?.intro_md ?? null,
    email_outro_md: email?.outro_md ?? null,
    email_ps_md: email?.ps_md ?? null,
    email_html: emailHtml,
    blocks: blocks.map(b => ({ label: b.label, type: b.block_type, qty: b.qty, nights: b.nights, total_lak: b.total_lak, hero_asset_id: b.hero_asset_id })),
  });

  return NextResponse.json({
    token: sent.token,
    public_url: publicUrl,
    avail_check: check,
    forced: force,
    email_html_ready: !!emailHtml,
  });
}
