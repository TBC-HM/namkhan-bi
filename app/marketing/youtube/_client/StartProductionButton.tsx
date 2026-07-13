'use client';
// app/marketing/youtube/_client/StartProductionButton.tsx
// PBS 2026-07-13 — Flips a yt_video_requests row from queued -> scripting via
// public.fn_yt_video_request_start_production and inserts a Lumen cockpit_ticket.
// v2 (Phase 1 UX fix): shows a green "→ moved to Script" flash for 2.5s before
// the parent refresh removes the row from the Request stage; optional onSuccess
// callback lets the parent auto-open the Script stage tile.
import { useRouter } from 'next/navigation';
import { useState } from 'react';

const HAIR   = '#E6DFCC';
const WHITE  = '#FFFFFF';
const RED    = '#B03826';
const FOREST = '#084838';
const OK     = '#0E7A4B';

interface Props {
  requestId: string;
  onSuccess?: () => void; // parent can auto-open the Script stage panel
}

export default function StartProductionButton({ requestId, onSuccess }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const onClick = async () => {
    if (!confirm('Start production for this video request? It will move to Script stage and open a Lumen ticket.')) return;
    setBusy(true); setErr(null);
    try {
      const r = await fetch('/api/marketing/youtube/start-production', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ request_id: requestId }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok || !j.ok) throw new Error(j.error ?? `HTTP ${r.status}`);
      setDone(true);
      onSuccess?.();
      // Give the flash a moment to be visible, then refresh — server component
      // will re-render, dropping this row from the Request table.
      setTimeout(() => router.refresh(), 900);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'start failed');
    } finally {
      setBusy(false);
    }
  };

  if (done) {
    return (
      <span style={{
        display: 'inline-block', padding: '5px 10px', background: OK, color: WHITE,
        fontSize: 11, borderRadius: 3, letterSpacing: '.04em', textTransform: 'uppercase', fontWeight: 500,
      }}>✓ Moved to Script</span>
    );
  }

  return (
    <div style={{ display: 'inline-flex', gap: 8, alignItems: 'center' }}>
      <button type="button" onClick={onClick} disabled={busy}
        style={{
          padding: '5px 12px', border: `1px solid ${HAIR}`, borderRadius: 3,
          background: FOREST, color: WHITE, fontSize: 11,
          cursor: busy ? 'progress' : 'pointer', letterSpacing: '.04em',
          textTransform: 'uppercase', fontWeight: 500, opacity: busy ? 0.6 : 1,
        }}>{busy ? 'Starting…' : '▶ Start production'}</button>
      {err && <span style={{ fontSize: 10, color: RED }}>{err}</span>}
    </div>
  );
}
