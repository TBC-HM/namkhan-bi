// components/proposal/SentProposalView.tsx
// Proposals brief A3/#48 (2026-07-29) — read-only view of a SENT proposal.
// Once a proposal is sent it can no longer be edited; this view renders the
// EXACT email HTML that left via Gmail (sales.proposal_emails.sent_html,
// persisted by the send route at send time). Legacy proposals sent before
// sent_html existed fall back to a note + the live public page link.
// Server component — no client JS needed; the iframe renders a static snapshot.

import Link from 'next/link';

const T = {
  WHITE: '#FFFFFF', HAIR: '#E6DFCC', INK: '#1B1B1B', INK_M: '#5A5A5A',
  CREAM: '#F5F0E1', FOREST: '#084838', AMBER: '#B48A3A',
};

export interface SentProposalViewProps {
  proposalId: string;
  guestName: string;
  status: string;
  sentAt: string | null;
  publicToken: string | null;
  sentHtml: string | null;
  sentSubject: string | null;
  sentTo: string | null;
}

export default function SentProposalView({
  proposalId, guestName, status, sentAt, publicToken, sentHtml, sentSubject, sentTo,
}: SentProposalViewProps) {
  const publicUrl = publicToken ? `/p/${publicToken}` : null;
  const printUrl = publicToken ? `/p/${publicToken}/print` : null;

  return (
    <div style={{ maxWidth: 980, margin: '0 auto', padding: 16 }}>
      <div style={{
        background: T.CREAM, border: `1px solid ${T.HAIR}`, borderRadius: 8,
        padding: '12px 16px', marginBottom: 16,
        display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center', justifyContent: 'space-between',
      }}>
        <div>
          <div style={{ fontSize: 15, fontWeight: 600, color: T.INK }}>
            {guestName} · <span style={{ color: T.AMBER, textTransform: 'capitalize' }}>{status}</span>
          </div>
          <div style={{ fontSize: 12, color: T.INK_M, marginTop: 2 }}>
            Sent {sentAt ? new Date(sentAt).toLocaleString() : '—'}
            {sentTo ? ` · to ${sentTo}` : ''}
            {sentSubject ? ` · “${sentSubject}”` : ''}
          </div>
          <div style={{ fontSize: 11, color: T.INK_M, marginTop: 4 }}>
            🔒 Read-only — a sent proposal is an immutable record of what the guest received.
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {publicUrl && (
            <a href={publicUrl} target="_blank" rel="noreferrer" style={{
              padding: '6px 12px', fontSize: 12, borderRadius: 4, border: `1px solid ${T.FOREST}`,
              color: T.FOREST, textDecoration: 'none', fontWeight: 600, background: T.WHITE,
            }}>Guest page ↗</a>
          )}
          {printUrl && (
            <a href={printUrl} target="_blank" rel="noreferrer" style={{
              padding: '6px 12px', fontSize: 12, borderRadius: 4, border: `1px solid ${T.FOREST}`,
              color: T.FOREST, textDecoration: 'none', fontWeight: 600, background: T.WHITE,
            }}>Open PDF view ↗</a>
          )}
          <Link href="/sales/proposals" style={{
            padding: '6px 12px', fontSize: 12, borderRadius: 4, border: `1px solid ${T.HAIR}`,
            color: T.INK_M, textDecoration: 'none', background: T.WHITE,
          }}>← All proposals</Link>
        </div>
      </div>

      {sentHtml ? (
        <iframe
          title={`Sent proposal ${proposalId}`}
          srcDoc={sentHtml}
          sandbox=""
          style={{
            width: '100%', height: '78vh', border: `1px solid ${T.HAIR}`,
            borderRadius: 8, background: T.WHITE,
          }}
        />
      ) : (
        <div style={{
          background: T.WHITE, border: `1px solid ${T.HAIR}`, borderRadius: 8,
          padding: 32, textAlign: 'center', color: T.INK_M, fontSize: 13,
        }}>
          This proposal was sent before email snapshots were stored (2026-07-29),
          so the exact sent HTML is not on record.
          {publicUrl ? (
            <> The live guest page shows the same content: <a href={publicUrl} style={{ color: T.FOREST, fontWeight: 600 }}>open guest page</a>.</>
          ) : null}
        </div>
      )}
    </div>
  );
}
