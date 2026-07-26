'use client';
// app/holding/it/cockpit/briefs/_components/BriefActions.tsx
// Status-change buttons for a brief row.
// Confirm = draft→ready ("release into pipeline").
// Also surfaces Archive.

import { useState } from 'react';
import { useRouter } from 'next/navigation';

const TRANSITIONS: Record<string, string[]> = {
  draft:       ['ready'],
  ready:       ['in_progress', 'archived'],
  in_progress: ['shipped', 'archived'],
  shipped:     ['archived'],
  archived:    ['ready'],
};

const LABELS: Record<string, string> = {
  ready:       'Confirm → build',
  in_progress: 'Mark in-progress',
  shipped:     'Mark shipped',
  archived:    'Archive',
};

export default function BriefActions({
  slug, currentStatus,
}: {
  slug: string; currentStatus: string;
}) {
  const [loading, setLoading] = useState('');
  const router = useRouter();
  const next = TRANSITIONS[currentStatus] ?? [];

  async function transition(newStatus: string) {
    setLoading(newStatus);
    await fetch('/api/cockpit/briefs/status', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ slug, status: newStatus }),
    });
    setLoading('');
    router.refresh();
  }

  return (
    <div style={{ display: 'flex', gap: 6 }}>
      {next.map((s) => (
        <button
          key={s}
          onClick={() => transition(s)}
          disabled={loading === s}
          style={{
            fontSize: 10, padding: '3px 10px', borderRadius: 4,
            background: s === 'ready' ? '#084838' : '#F4EFE2',
            color: s === 'ready' ? '#fff' : '#5A5A5A',
            border: '1px solid #E6DFCC', cursor: 'pointer',
            opacity: loading ? 0.6 : 1,
          }}
        >
          {loading === s ? '…' : LABELS[s] ?? s}
        </button>
      ))}
    </div>
  );
}
