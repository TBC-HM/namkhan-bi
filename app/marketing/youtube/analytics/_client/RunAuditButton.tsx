// app/marketing/youtube/analytics/_client/RunAuditButton.tsx
// PBS 2026-07-13 — Client button that POSTs to /api/marketing/youtube/audit-run
// and reloads the page. Anthropic call can take 30-60s so show progress.
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

const WHITE  = '#FFFFFF';
const HAIR   = '#E6DFCC';
const INK    = '#1B1B1B';
const INK_M  = '#5A5A5A';
const FOREST = '#084838';
const RED    = '#B03826';

export default function RunAuditButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [progress, setProgress] = useState<string | null>(null);

  async function run() {
    setBusy(true); setErr(null); setProgress('Reading channel · playlists · videos…');
    try {
      const res = await fetch('/api/marketing/youtube/audit-run', { method: 'POST' });
      setProgress('Lens is auditing (30-60s)…');
      const j = await res.json();
      if (!res.ok || !j.ok) {
        setErr(j.error ? `${j.error}${j.detail ? ` · ${j.detail}` : ''}` : 'unknown');
        return;
      }
      setProgress(`Done · ${j.video_count} videos audited · overall ${j.overall_grade}`);
      router.refresh();
      setTimeout(() => setProgress(null), 4000);
    } catch (e: any) {
      setErr(e.message ?? 'network');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'flex-end' }}>
      <button onClick={run} disabled={busy} style={{
        padding: '10px 18px', background: busy ? '#B7C7BE' : FOREST, color: WHITE, border: 'none',
        borderRadius: 3, fontSize: 12, textTransform: 'uppercase', letterSpacing: '.05em', fontWeight: 600, cursor: busy ? 'wait' : 'pointer',
      }}>
        {busy ? 'Running…' : 'Run audit'}
      </button>
      {progress && <div style={{ fontSize: 11, color: INK_M }}>{progress}</div>}
      {err && <div style={{ fontSize: 11, color: RED, maxWidth: 260, textAlign: 'right' }}>Failed: {err}</div>}
    </div>
  );
}
