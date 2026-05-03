import { NextResponse } from 'next/server';
import { getProposalWithBlocks, getInquiry } from '@/lib/sales';
import { composeOffer } from '@/lib/composerRunner';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export const dynamic = 'force-dynamic';

interface Ctx { params: { id: string } }

export async function POST(_req: Request, { params }: Ctx) {
  const { proposal, blocks } = await getProposalWithBlocks(params.id);
  if (!proposal) return NextResponse.json({ error: 'proposal not found' }, { status: 404 });
  const inq = proposal.inquiry_id ? await getInquiry(proposal.inquiry_id) : null;

  const out = await composeOffer({
    inquiryId: proposal.inquiry_id,
    proposalId: proposal.id,
    guestName: proposal.guest_name_snapshot ?? inq?.guest_name ?? 'guest',
    guestCountry: inq?.country ?? null,
    language: inq?.language ?? 'en',
    partyAdults: inq?.party_adults ?? null,
    partyChildren: inq?.party_children ?? null,
    dateIn: proposal.date_in_snapshot ?? inq?.date_in ?? '',
    dateOut: proposal.date_out_snapshot ?? inq?.date_out ?? '',
    blocksContext: blocks.map(b => ({ label: b.label, type: b.block_type, sellLak: Number(b.unit_price_lak) })),
  });

  const sb = getSupabaseAdmin();
  const { data: latest } = await sb.schema('sales')
    .from('proposal_emails')
    .select('version')
    .eq('proposal_id', params.id)
    .order('version', { ascending: false })
    .limit(1)
    .maybeSingle();
  const nextVersion = (latest?.version ?? 0) + 1;
  const { error } = await sb.schema('sales').from('proposal_emails').insert({
    proposal_id: params.id,
    version: nextVersion,
    subject: out.subject,
    intro_md: out.intro,
    outro_md: out.outro,
    ps_md: out.ps,
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({
    subject: out.subject,
    intro_md: out.intro,
    outro_md: out.outro,
    ps_md: out.ps,
    source: out.source,
    cost_eur: out.costEur,
  });
}
