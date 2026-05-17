'use client';

// app/cockpit-v2/tasks/TicketActions.tsx
// V2 archive + delete buttons. Checks response.ok and surfaces failures
// so silent server errors don't masquerade as success (the 2026-05-17 bug).

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { TOKENS, MONO } from '../_components/tokens';

const TERMINAL = new Set(['completed', 'archived', 'triage_failed', 'done']);

export function TicketActions({ id, status }: { id: number; status: string }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const router = useRouter();

  async function callAndReport(label: string, doFetch: () => Promise<Response>) {
    setBusy(true); setErr(null);
    try {
      const res = await doFetch();
      let body: any = null;
      try { body = await res.json(); } catch {}
      if (!res.ok || body?.ok === false) {
        const msg = body?.error || `HTTP ${res.status}`;
        setErr(`${label} failed: ${msg}`);
        return;
      }
      startTransition(() => router.refresh());
    } catch (e) {
      setErr(`${label} threw: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setBusy(false);
    }
  }

  async function archive() {
    if (!confirm(`Archive ticket #${id}?`)) return;
    await callAndReport('Archive', () =>
      fetch('/api/cockpit/tickets', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, status: 'archived' }),
      }),
    );
  }

  async function del() {
    if (!confirm(`Delete ticket #${id} permanently? Cannot be undone.`)) return;
    await callAndReport('Delete', () =>
      fetch(`/api/cockpit/tickets?id=${id}`, { method: 'DELETE' }),
    );
  }

  return (
    <span style={{ display: 'inline-flex', gap: 6, justifyContent: 'flex-end', alignItems: 'center' }}>
      {!TERMINAL.has(status) && (
        <button onClick={archive} disabled={busy} style={btn(TOKENS.sand)} type="button">Archive</button>
      )}
      <button onClick={del} disabled={busy} style={btn(TOKENS.terracotta)} type="button">Delete</button>
      {err && (
        <span title={err} style={{
          fontFamily: MONO, fontSize: 9, letterSpacing: '0.1em', textTransform: 'uppercase',
          color: '#E07856', marginLeft: 4, cursor: 'help',
        }}>
          ✗ {err.slice(0, 28)}{err.length > 28 ? '…' : ''}
        </span>
      )}
    </span>
  );
}

function btn(color: string): React.CSSProperties {
  return {
    background: 'transparent', border: `1px solid ${color}`, color,
    padding: '3px 8px', borderRadius: 2,
    fontFamily: MONO, fontSize: 10, letterSpacing: 0.5,
    textTransform: 'uppercase', cursor: 'pointer', fontWeight: 600,
  };
}
