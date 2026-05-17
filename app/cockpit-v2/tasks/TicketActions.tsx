'use client';

// app/cockpit-v2/tasks/TicketActions.tsx
// V2 port of /cockpit/tasks/_components/TicketActions — single-row archive +
// delete. Reuses the existing /api/cockpit/tickets PATCH/DELETE endpoints
// (no new API needed). Bulk-clear lives only on the V1 page for now;
// PBS asked tasks-list + ticket-detail only in #58.
//
// Author: IT-team agent · 2026-05-13 · #58.

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { TOKENS, MONO } from '../_components/tokens';

const TERMINAL = new Set(['completed', 'archived', 'triage_failed', 'done']);

export function TicketActions({ id, status }: { id: number; status: string }) {
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
    } finally {
      setBusy(false);
    }
  }

  async function del() {
    if (!confirm(`Delete ticket #${id} permanently? Cannot be undone.`)) return;
    setBusy(true);
    try {
      await fetch(`/api/cockpit/tickets?id=${id}`, { method: 'DELETE' });
      startTransition(() => router.refresh());
    } finally {
      setBusy(false);
    }
  }

  return (
    <span
      style={{
        display: 'inline-flex',
        gap: 6,
        justifyContent: 'flex-end',
      }}
    >
      {!TERMINAL.has(status) && (
        <button
          onClick={archive}
          disabled={busy}
          style={btn(TOKENS.sand)}
          type="button"
        >
          Archive
        </button>
      )}
      <button onClick={del} disabled={busy} style={btn(TOKENS.terracotta)} type="button">
        Delete
      </button>
    </span>
  );
}

function btn(color: string): React.CSSProperties {
  return {
    background: 'transparent',
    border: `1px solid ${color}`,
    color,
    padding: '3px 8px',
    borderRadius: 2,
    fontFamily: MONO,
    fontSize: 10,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    cursor: 'pointer',
    fontWeight: 600,
  };
}
