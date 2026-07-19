// Composer screen — unified editor.
// PBS 2026-07-16 (item 1) — wizard gate REMOVED. Left pane of ComposerEditor now
// carries the dates/pax/rooms/rate-plan fields inline, so new proposals land on the
// same page as in-flight ones. Right pane is the live email iframe preview.
// ProposerWizard.tsx is deprecated (kept only for dependency safety, no longer routed).
import { notFound } from 'next/navigation';
import { getProposalWithBlocks, getInquiry } from '@/lib/sales';
import ComposerEditor from '@/components/proposal/ComposerEditor';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function ComposerPage({ params }: { params: { id: string } }) {
  const { proposal, blocks, email } = await getProposalWithBlocks(params.id);
  if (!proposal) return notFound();
  const inq = proposal.inquiry_id ? await getInquiry(proposal.inquiry_id) : null;

  const p = proposal as unknown as {
    adults_snapshot: number | null;
    children_snapshot: number | null;
    rooms_snapshot: number | null;
    selected_rate_plan_id: string | null;
    selected_room_type_id: string | null;
    wizard_completed_at: string | null;
  };

  return (
    <ComposerEditor
      proposalId={proposal.id}
      propertyId={proposal.property_id}
      initialBlocks={blocks}
      initialEmail={email}
      proposal={{
        guest_name: proposal.guest_name_snapshot ?? inq?.guest_name ?? 'guest',
        date_in: proposal.date_in_snapshot ?? inq?.date_in ?? '',
        date_out: proposal.date_out_snapshot ?? inq?.date_out ?? '',
        status: proposal.status,
        public_token: proposal.public_token,
        header_hero_asset_id: (proposal as any).header_hero_asset_id ?? null,
        header_hero_hide: (proposal as any).header_hero_hide ?? false,
      }}
      wizard={{
        date_in: proposal.date_in_snapshot ?? inq?.date_in ?? null,
        date_out: proposal.date_out_snapshot ?? inq?.date_out ?? null,
        adults: p.adults_snapshot ?? inq?.party_adults ?? null,
        children: p.children_snapshot ?? inq?.party_children ?? null,
        rooms: p.rooms_snapshot ?? null,
        rate_plan_id: p.selected_rate_plan_id ?? null,
        room_type_id: p.selected_room_type_id ?? null,
        completed_at: p.wizard_completed_at ?? null,
      }}
    />
  );
}
