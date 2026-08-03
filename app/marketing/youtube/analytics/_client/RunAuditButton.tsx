'use client';
// app/marketing/youtube/analytics/_client/RunAuditButton.tsx
// 2026-08-03: window.location.reload replaces router.refresh (reliable for RSC pages).
// Progress message reflects actual runtime (1-3 min).
// Pagination: stores nextPageToken from each run — "Run next 25" advances through
// all 224 channel videos 25 at a time until nextPageToken is null (fully audited).
import { useState } from 'react';

const WHITE  = '#FFFFFF';
const INK_M  = '#5A5A5A';
const FOREST = '#084838';
const RED    = '#B03826';
const OK     = '#0E7A4B';

export default function RunAuditButton() {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [progress, setProgress] = useState<string | null>(null);
  // nextPageToken persists across page reload via URL param — stored in sessionStorage
  const [nextToken, setNextToken] = useState<string | null>(() => {
    if (typeof window === 'undefined') return null;
    return sessionStorage.getItem('yt_audit_next_token');
  });
  const [batchsDone, setBatchsDone] = useState<number>(() => {
    if (typeof window === 'undefined') return 0;
    return Number(sessionStorage.getItem('yt_audit_batches') ?? 0);
  });

  const isFirstRun = !nextToken;

  async function run() {
    setBusy(true); setErr(null);
    const batchLabel = isFirstRun ? 'first batch' : `batch ${batchsDone + 1}`;
    setProgress(`Lens is auditing — ${batchLabel} of 25 videos… (1–3 min)`);
    try {
      const body: Record<string, unknown> = {};
      if (nextToken) body.pageToken = nextToken;

      const res = await fetch('/api/marketing/youtube/audit-run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const j = await res.json();
      if (!res.ok || !j.ok) {
        setErr(j.error ? `${j.error}${j.detail ? ` · ${j.detail}` : ''}` : 'unknown error');
        setBusy(false); setProgress(null);
        return;
      }

      const newNextToken: string | null = j.next_page_token ?? null;
      const newBatches = batchsDone + 1;

      // Persist across page reload
      if (newNextToken) {
        sessionStorage.setItem('yt_audit_next_token', newNextToken);
      } else {
        sessionStorage.removeItem('yt_audit_next_token');
      }
      sessionStorage.setItem('yt_audit_batches', String(newBatches));
      setNextToken(newNextToken);
      setBatchsDone(newBatches);

      const moreLabel = newNextToken ? ' · more batches available' : ' · all videos covered';
      setProgress(`Done · ${j.video_count} videos · grade ${j.overall_grade}${moreLabel} · reloading…`);
      setTimeout(() => { window.location.reload(); }, 1400);
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : 'network error');
      setBusy(false); setProgress(null);
    }
  }

  const btnLabel = busy ? 'Running…' : isFirstRun ? 'Run audit' : `Run next 25 (batch ${batchsDone + 1})`;
  const btnColor = isFirstRun ? FOREST : OK;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'flex-end' }}>
      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
        {!isFirstRun && !busy && (
          <button
            onClick={() => {
              sessionStorage.removeItem('yt_audit_next_token');
              sessionStorage.setItem('yt_audit_batches', '0');
              setNextToken(null); setBatchsDone(0);
            }}
            style={{ fontSize: 10, color: INK_M, background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
          >
            ↺ restart
          </button>
        )}
        <button onClick={run} disabled={busy} style={{
          padding: '10px 18px', background: busy ? '#B7C7BE' : btnColor, color: WHITE, border: 'none',
          borderRadius: 3, fontSize: 12, textTransform: 'uppercase', letterSpacing: '.05em',
          fontWeight: 600, cursor: busy ? 'wait' : 'pointer',
        }}>
          {btnLabel}
        </button>
      </div>
      {!isFirstRun && !busy && (
        <div style={{ fontSize: 10, color: INK_M, textAlign: 'right' }}>
          {batchsDone} batch{batchsDone !== 1 ? 'es' : ''} done · {batchsDone * 25} videos audited this session
        </div>
      )}
      {progress && <div style={{ fontSize: 11, color: INK_M, maxWidth: 300, textAlign: 'right' }}>{progress}</div>}
      {err && <div style={{ fontSize: 11, color: RED, maxWidth: 300, textAlign: 'right' }}>Failed: {err}</div>}
    </div>
  );
}
