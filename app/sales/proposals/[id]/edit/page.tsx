// Composer screen — server-renders the proposal data.
// If wizard_completed_at IS NULL, gate entry with ProposerWizard.
// Otherwise, ComposerEditor handles interactions.
import { notFound } from 'next/navigation';
import { getProposalWithBlocks, getInquiry } from '@/lib/sales';
import ComposerEditor from '@/components/proposal/ComposerEditor';
import ProposerWizard from '@/components/proposal/ProposerWizard';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function ComposerPage({ params }: { params: { id: string } }) {
  const { proposal, blocks, email } = await getProposalWithBlocks(params.id);
  if (!proposal) return notFound();
  const inq = proposal.inquiry_id ? await getInquiry(proposal.inquiry_id) : null;

  // Gate on wizard completion — new proposals require dates/pax/rooms/rate plan first.
  const wizardCompletedAt = (proposal as unknown as { wizard_completed_at: string | null })
    .wizard_completed_at;
  if (!wizardCompletedAt) {
    const p = proposal as unknown as {
      adults_snapshot: number | null;
      children_snapshot: number | null;
      rooms_snapshot: number | null;
    };
    return (
      <ProposerWizard
        proposalId={proposal.id}
        propertyId={proposal.property_id}
        initialDateIn={proposal.date_in_snapshot ?? inq?.date_in ?? null}
        initialDateOut={proposal.date_out_snapshot ?? inq?.date_out ?? null}
        initialAdults={p.adults_snapshot ?? inq?.party_adults ?? null}
        initialChildren={p.children_snapshot ?? inq?.party_children ?? null}
        initialRooms={p.rooms_snapshot ?? null}
      />
    );
  }

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
