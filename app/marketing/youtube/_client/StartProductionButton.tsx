'use client';
// app/marketing/youtube/_client/StartProductionButton.tsx
// PBS 2026-07-13 — Flips a yt_video_requests row from queued -> scripting via
// public.fn_yt_video_request_start_production and inserts a Lumen cockpit_ticket.
import { useRouter } from 'next/navigation';
import { useState } from 'react';

const HAIR   = '#E6DFCC';
const INK    = '#1B1B1B';
const WHITE  = '#FFFFFF';
const RED    = '#B03826';
const FOREST = '#084838';

export default function StartProductionButton({ requestId }: { requestId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

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
      router.refresh();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'start failed');
    } finally {
      setBusy(false);
    }
  };

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
