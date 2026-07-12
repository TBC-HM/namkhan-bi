'use client';
// app/marketing/youtube/_client/PlaylistCalendarActions.tsx
// PBS 2026-07-12 — Client side of the 12-month title-proposal calendar.
// Two behaviours:
//   • Generate — when there are no proposals yet; POSTs to
//     /api/marketing/youtube/generate-title-proposals and reloads.
//   • Queue    — one button per proposal card; POSTs to
//     /api/marketing/youtube/queue-title-proposal and reloads.

import { useRouter } from 'next/navigation';
import { useState } from 'react';

const HAIR   = '#E6DFCC';
const INK    = '#1B1B1B';
const INK_M  = '#5A5A5A';
const WHITE  = '#FFFFFF';
const RED    = '#B03826';
const FOREST = '#084838';

interface GenerateProps {
  playlistId: string;
  hasProposals: boolean;
}

export function GenerateProposalsButton({ playlistId, hasProposals }: GenerateProps) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const label = hasProposals ? 'Regenerate calendar' : 'Generate 12-month calendar';

  const onClick = async () => {
    if (hasProposals && !confirm('Regenerate the 12-month calendar? Existing "proposed" rows will be replaced. Queued/shipped rows stay.')) return;
    setBusy(true); setMsg(null);
    try {
      const r = await fetch('/api/marketing/youtube/generate-title-proposals', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ playlist_id: playlistId }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok || !j.ok) throw new Error(j.error ?? `HTTP ${r.status}`);
      router.refresh();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'generate failed');
    } finally {
      setBusy(false);
    }
  };

  const btn: React.CSSProperties = {
    padding: '8px 14px',
    border: `1px solid ${HAIR}`,
    borderRadius: 3,
    background: hasProposals ? WHITE : FOREST,
    color:      hasProposals ? INK   : WHITE,
    fontSize: 12,
    cursor: busy ? 'progress' : 'pointer',
    letterSpacing: '.04em',
    textTransform: 'uppercase',
    fontWeight: 500,
    opacity: busy ? 0.6 : 1,
  };

  return (
    <div style={{ display: 'inline-flex', gap: 8, alignItems: 'center' }}>
      <button type="button" onClick={onClick} disabled={busy} style={btn}>
        {busy ? 'Generating… (30-60s)' : label}
      </button>
      {msg && <span style={{ fontSize: 11, color: RED }}>{msg}</span>}
    </div>
  );
}

interface QueueProps {
  proposalId: string;
  status: string;
}

export function QueueProposalButton({ proposalId, status }: QueueProps) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  if (status !== 'proposed') {
    const label =
      status === 'queued'    ? 'Queued'    :
      status === 'requested' ? 'Requested' :
      status === 'shipped'   ? 'Shipped'   :
      status === 'dismissed' ? 'Dismissed' : status;
    const color =
      status === 'shipped'  ? FOREST :
      status === 'queued'   ? INK    :
      status === 'dismissed'? INK_M  : INK;
    return (
      <div style={{
        display: 'inline-block',
        padding: '4px 8px',
        border: `1px solid ${HAIR}`,
        borderRadius: 3,
        fontSize: 10,
        color,
        textTransform: 'uppercase',
        letterSpacing: '.05em',
      }}>{label}</div>
    );
  }

  const onClick = async () => {
    setBusy(true); setMsg(null);
    try {
      const r = await fetch('/api/marketing/youtube/queue-title-proposal', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ proposal_id: proposalId }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok || !j.ok) throw new Error(j.error ?? `HTTP ${r.status}`);
      router.refresh();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'queue failed');
      setBusy(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'flex-end' }}>
      <button type="button" onClick={onClick} disabled={busy} style={{
        padding: '4px 8px',
        border: `1px solid ${HAIR}`,
        borderRadius: 3,
        background: WHITE,
        color: INK,
        fontSize: 10,
        cursor: busy ? 'progress' : 'pointer',
        letterSpacing: '.04em',
        textTransform: 'uppercase',
        opacity: busy ? 0.6 : 1,
      }}>
        {busy ? 'Queuing…' : 'Queue to publish →'}
      </button>
      {msg && <span style={{ fontSize: 10, color: RED, maxWidth: 160, textAlign: 'right' }}>{msg}</span>}
    </div>
  );
}
