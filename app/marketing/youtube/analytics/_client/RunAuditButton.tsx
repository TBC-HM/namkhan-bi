'use client';
// app/marketing/youtube/analytics/_client/RunAuditButton.tsx
// Fix 2026-08-03: progress message now reflects actual runtime (1-3 min).
// window.location.reload replaces router.refresh (reliable for RSC pages).
import { useState } from 'react';

const WHITE  = '#FFFFFF';
const INK_M  = '#5A5A5A';
const FOREST = '#084838';
const RED    = '#B03826';

export default function RunAuditButton() {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [progress, setProgress] = useState<string | null>(null);

  async function run() {
    setBusy(true); setErr(null);
    setProgress('Lens is auditing — reading channel, playlists and videos… (1–3 min)');
    try {
      const res = await fetch('/api/marketing/youtube/audit-run', { method: 'POST' });
      const j = await res.json();
      if (!res.ok || !j.ok) {
        setErr(j.error ? `${j.error}${j.detail ? ` · ${j.detail}` : ''}` : 'unknown error');
        setBusy(false);
        setProgress(null);
        return;
      }
      setProgress(`Done · ${j.video_count} videos · overall ${j.overall_grade} · reloading…`);
      setTimeout(() => { window.location.reload(); }, 1400);
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : 'network error');
      setBusy(false);
      setProgress(null);
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'flex-end' }}>
      <button onClick={run} disabled={busy} style={{
        padding: '10px 18px', background: busy ? '#B7C7BE' : FOREST, color: WHITE, border: 'none',
        borderRadius: 3, fontSize: 12, textTransform: 'uppercase', letterSpacing: '.05em',
        fontWeight: 600, cursor: busy ? 'wait' : 'pointer',
      }}>
        {busy ? 'Running…' : 'Run audit'}
      </button>
      {progress && <div style={{ fontSize: 11, color: INK_M, maxWidth: 280, textAlign: 'right' }}>{progress}</div>}
      {err && <div style={{ fontSize: 11, color: RED, maxWidth: 280, textAlign: 'right' }}>Failed: {err}</div>}
    </div>
  );
}
