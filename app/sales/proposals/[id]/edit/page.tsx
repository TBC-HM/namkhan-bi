// Composer screen — server-renders the proposal data, ComposerEditor handles interactions.
import { notFound } from 'next/navigation';
import { getProposalWithBlocks, getInquiry } from '@/lib/sales';
import ComposerEditor from '@/components/proposal/ComposerEditor';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function ComposerPage({ params }: { params: { id: string } }) {
  const { proposal, blocks, email } = await getProposalWithBlocks(params.id);
  if (!proposal) return notFound();
  const inq = proposal.inquiry_id ? await getInquiry(proposal.inquiry_id) : null;

  return (
    <ComposerEditor
      proposalId={proposal.id}
      initialBlocks={blocks}
      initialEmail={email}
      proposal={{
        guest_name: proposal.guest_name_snapshot ?? inq?.guest_name ?? 'guest',
        date_in: proposal.date_in_snapshot ?? inq?.date_in ?? '',
        date_out: proposal.date_out_snapshot ?? inq?.date_out ?? '',
        status: proposal.status,
        public_token: proposal.public_token,
      }}
    />
  );
}
