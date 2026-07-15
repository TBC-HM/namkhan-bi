'use client';
// PBS 2026-07-16 — inline X delete button for the proposals list row.
// Confirms, calls DELETE /api/sales/proposals/[id], then hard-refreshes.

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';

export default function DeleteProposalButton({ proposalId, label }: { proposalId: string; label?: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [flash, setFlash] = useState<string | null>(null);

  const run = () => {
    if (!confirm('Delete proposal ' + (label ? '"' + label + '"' : proposalId) + '? Cannot be undone.')) return;
    startTransition(async () => {
      try {
        const r = await fetch('/api/sales/proposals/' + encodeURIComponent(proposalId), { method: 'DELETE' });
        if (!r.ok) { setFlash('failed'); return; }
        router.refresh();
      } catch {
        setFlash('failed');
      }
    });
  };

  return (
    <button
      type="button"
      onClick={run}
      disabled={pending}
      title="Delete proposal (permanent)"
      style={{
        marginLeft: 6, padding: '3px 8px', fontSize: 13, lineHeight: 1, borderRadius: 3,
        border: '1px solid #E6DFCC', background: '#FFFFFF', color: '#B04A2F',
        cursor: pending ? 'wait' : 'pointer', opacity: pending ? 0.5 : 1,
      }}
    >
      {flash === 'failed' ? '⚠' : '🗑'}
    </button>
  );
}
