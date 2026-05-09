'use client';

// PBS 2026-05-09: per-row delete + status flip + bulk-clear for /cockpit/tasks.
// Days-old completed/archived tickets cluttered the list. Now removable.

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';

interface RowProps {
  id: number;
  status: string;
}

export function TicketRowActions({ id, status }: RowProps) {
  const [busy, setBusy] = useState(false);
  const [, startTransition] = useTransition();
  const router = useRouter();

  async function archive() {
    if (!confirm(`Archive ticket #${id}?`)) return;
    setBusy(true);
    try {
      await fetch('/api/cockpit/tickets', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, status: 'archived' }),
      });
      startTransition(() => router.refresh());
    } finally { setBusy(false); }
  }

  async function del() {
    if (!confirm(`Delete ticket #${id} permanently? This cannot be undone.`)) return;
    setBusy(true);
    try {
      await fetch(`/api/cockpit/tickets?id=${id}`, { method: 'DELETE' });
      startTransition(() => router.refresh());
    } finally { setBusy(false); }
  }

  const isClosed = status === 'completed' || status === 'archived' || status === 'triage_failed';
  return (
    <span style={{ display: 'inline-flex', gap: 6, marginLeft: 12 }}>
      {!isClosed && (
        <button
          onClick={archive}
          disabled={busy}
          title="Archive this ticket"
          style={btnStyle('#7d7565')}
        >Archive</button>
      )}
      <button
        onClick={del}
        disabled={busy}
        title="Delete this ticket permanently"
        style={btnStyle('#c0584c')}
      >Delete</button>
    </span>
  );
}

interface BulkProps {
  archivedCount: number;
  completedCount: number;
}

export function BulkClear({ archivedCount, completedCount }: BulkProps) {
  const [busy, setBusy] = useState(false);
  const [, startTransition] = useTransition();
  const router = useRouter();

  async function bulk(status: 'archived' | 'completed') {
    const count = status === 'archived' ? archivedCount : completedCount;
    if (count === 0) return;
    if (!confirm(`Delete ALL ${count} ${status} tickets permanently?`)) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/cockpit/tickets?status=${status}`, { method: 'DELETE' });
      const j = await res.json().catch(() => ({}));
      if (res.ok) {
        alert(`Deleted ${j.deleted ?? count} ${status} tickets.`);
        startTransition(() => router.refresh());
      } else {
        alert(`Failed: ${j.error ?? res.status}`);
      }
    } finally { setBusy(false); }
  }

  if (archivedCount + completedCount === 0) return null;
  return (
    <div style={{ marginLeft: 'auto', display: 'inline-flex', gap: 8 }}>
      {archivedCount > 0 && (
        <button onClick={() => bulk('archived')} disabled={busy} style={btnStyle('#c0584c', true)} title="Permanently delete every archived ticket">
          Clear {archivedCount} archived
        </button>
      )}
      {completedCount > 0 && (
        <button onClick={() => bulk('completed')} disabled={busy} style={btnStyle('#7d7565', true)} title="Permanently delete every completed ticket (kept here for audit; archive instead if unsure)">
          Clear {completedCount} completed
        </button>
      )}
    </div>
  );
}

function btnStyle(color: string, big = false): React.CSSProperties {
  return {
    background: 'transparent',
    border: `1px solid ${color}`,
    color,
    padding: big ? '6px 12px' : '3px 8px',
    borderRadius: 4,
    fontSize: big ? 11 : 10,
    fontFamily: "'JetBrains Mono', ui-monospace, monospace",
    letterSpacing: '0.10em',
    textTransform: 'uppercase',
    cursor: 'pointer',
    fontWeight: 600,
  };
}
