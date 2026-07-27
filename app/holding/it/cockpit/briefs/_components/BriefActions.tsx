'use client';
// app/holding/it/cockpit/briefs/_components/BriefActions.tsx
// Status transition buttons for a build brief row.

import { useState } from 'react';
import { TOKENS, MONO } from '../../_components/tokens';

const TRANSITIONS: Record<string, { label: string; next: string; primary?: boolean }[]> = {
  draft:       [{ label: 'Confirm → build', next: 'ready', primary: true }, { label: 'Archive', next: 'archived' }],
  ready:       [{ label: 'Start', next: 'in_progress', primary: true }, { label: 'Back to draft', next: 'draft' }],
  in_progress: [{ label: 'Ship', next: 'shipped', primary: true }, { label: 'Pause', next: 'ready' }],
  shipped:     [],
  archived:    [{ label: 'Restore', next: 'draft' }],
};

export default function BriefActions({ slug, currentStatus }: { slug: string; currentStatus: string }) {
  const [status, setStatus] = useState(currentStatus);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const transitions = TRANSITIONS[status] ?? [];

  async function transition(next: string) {
    setBusy(true); setErr(null);
    try {
      const r = await fetch('/api/cockpit/briefs/status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug, status: next }),
      });
      if (r.ok) { setStatus(next); return; }
      // NEVER swallow failures (bug #89): show the real error
      const j = await r.json().catch(() => ({} as { error?: string }));
      setErr(j.error ?? `failed (${r.status})`);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (transitions.length === 0) return null;

  return (
    <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
      {err && <span style={{ fontSize: 10.5, color: 'var(--status-red)' }}>⚠ {err}</span>}
      {transitions.map((t) => (
        <button
          key={t.next}
          onClick={() => transition(t.next)}
          disabled={busy}
          style={{
            fontSize: 11, padding: '3px 10px', borderRadius: 6, cursor: 'pointer',
            fontFamily: MONO, fontWeight: t.primary ? 700 : 500,
            border: `1px solid ${t.primary ? TOKENS.forest : TOKENS.border}`,
            background: t.primary ? TOKENS.forest : TOKENS.bg,
            color: t.primary ? '#fff' : TOKENS.text2,
            opacity: busy ? 0.6 : 1,
          }}
        >
          {busy ? '…' : t.label}
        </button>
      ))}
    </div>
  );
}
