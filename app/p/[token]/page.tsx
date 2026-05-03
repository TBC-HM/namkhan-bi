// Public proposal page — anon-accessible via token in URL.
// Uses dedicated public-facing layout (no portal nav).

import { notFound } from 'next/navigation';
import { getProposalByToken } from '@/lib/sales';
import PublicProposalClient from '@/components/proposal/PublicProposalClient';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function PublicProposalPage({ params }: { params: { token: string } }) {
  const { proposal, blocks } = await getProposalByToken(params.token);
  if (!proposal) return notFound();

  const expired = proposal.expires_at && new Date(proposal.expires_at) < new Date();
  if (expired) {
    return (
      <div className="public-prop-bg">
        <div className="public-prop-done">
          <h1 className="public-prop-done-h1">This proposal has expired</h1>
          <p style={{ fontFamily: 'var(--serif)', fontSize: 'var(--t-md)', color: 'var(--ink-soft)', marginTop: 14 }}>
            Write back to us — we'll redraw the rates.
          </p>
          <p style={{ color: 'var(--ink-mute)', fontFamily: 'var(--mono)', fontSize: 'var(--t-xs)', letterSpacing: 'var(--ls-loose)', textTransform: 'uppercase', marginTop: 14 }}>
            sebastian@thenamkhan.com
          </p>
        </div>
      </div>
    );
  }

  return (
    <PublicProposalClient
      token={params.token}
      proposal={{
        guest_name: proposal.guest_name_snapshot ?? 'guest',
        date_in: proposal.date_in_snapshot ?? '',
        date_out: proposal.date_out_snapshot ?? '',
        status: proposal.status,
      }}
      initialBlocks={blocks.filter(b => b.qty > 0)}
      removedBlocks={blocks.filter(b => b.qty === 0)}
    />
  );
}
