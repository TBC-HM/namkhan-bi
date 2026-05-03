import { NextResponse } from 'next/server';
import { markProposalSent, getProposalWithBlocks, getInquiry } from '@/lib/sales';
import { fireMakeWebhook } from '@/lib/makeWebhooks';

export const dynamic = 'force-dynamic';

interface Ctx { params: { id: string } }

export async function POST(_req: Request, { params }: Ctx) {
  const sent = await markProposalSent(params.id);
  if (!sent) return NextResponse.json({ error: 'send_failed' }, { status: 500 });

  const { proposal, blocks, email } = await getProposalWithBlocks(params.id);
  const inq = proposal?.inquiry_id ? await getInquiry(proposal.inquiry_id) : null;

  const totalLak = blocks.reduce((s, b) => s + Number(b.total_lak ?? 0), 0);

  const proto = process.env.VERCEL_URL ? 'https' : 'http';
  const host = process.env.VERCEL_URL ?? 'localhost:3000';
  const publicUrl = `${proto}://${host}/p/${sent.token}`;

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
    email_subject: email?.subject ?? null,
    email_intro_md: email?.intro_md ?? null,
    email_outro_md: email?.outro_md ?? null,
    email_ps_md: email?.ps_md ?? null,
    blocks: blocks.map(b => ({ label: b.label, type: b.block_type, qty: b.qty, nights: b.nights, total_lak: b.total_lak })),
  });

  return NextResponse.json({ token: sent.token, public_url: publicUrl });
}
