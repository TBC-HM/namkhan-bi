'use client';
// app/marketing/youtube/analytics/_client/RunAuditButton.tsx
// Pagination: next_page_token is stored in the DB (yt_channel_audit_runs.next_page_token)
// and passed as a prop from the RSC — survives hard refresh, browser restart, etc.
// sessionStorage removed: DB is the single source of truth for audit state.
import { useState } from 'react';

const WHITE  = '#FFFFFF';
const INK_M  = '#5A5A5A';
const FOREST = '#084838';
const RED    = '#B03826';
const OK     = '#0E7A4B';

interface Props {
  /** nextPageToken from the latest audit run in DB — null means start from beginning */
  initialNextToken?: string | null;
  /** How many batches have been run (count of audit runs) */
  batchCount?: number;
}

export default function RunAuditButton({ initialNextToken, batchCount = 0 }: Props) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [progress, setProgress] = useState<string | null>(null);

  const isFirstRun = !initialNextToken;
  const batchLabel = isFirstRun ? 'batch 1' : `batch ${batchCount + 1}`;
  const btnLabel = busy ? 'Running…' : isFirstRun ? 'Run audit' : `Run next 25 (batch ${batchCount + 1})`;
  const btnColor = isFirstRun ? FOREST : OK;

  async function run() {
    setBusy(true); setErr(null);
    setProgress(`Lens is auditing — ${batchLabel} · 25 videos… (1–3 min)`);
    try {
      const body: Record<string, unknown> = {};
      if (initialNextToken) body.pageToken = initialNextToken;

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

      const hasMore = !!j.next_page_token;
      setProgress(`Done · ${j.video_count} videos · grade ${j.overall_grade}${hasMore ? ' · more to audit' : ' · all covered'} · reloading…`);
      // Page reload fetches fresh RSC data including new next_page_token from DB
      setTimeout(() => { window.location.reload(); }, 1400);
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : 'network error');
      setBusy(false); setProgress(null);
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'flex-end' }}>
      <button onClick={run} disabled={busy} style={{
        padding: '10px 18px', background: busy ? '#B7C7BE' : btnColor, color: WHITE, border: 'none',
        borderRadius: 3, fontSize: 12, textTransform: 'uppercase', letterSpacing: '.05em',
        fontWeight: 600, cursor: busy ? 'wait' : 'pointer',
      }}>
        {btnLabel}
      </button>
      {!isFirstRun && !busy && (
        <div style={{ fontSize: 10, color: INK_M, textAlign: 'right' }}>
          {batchCount} batch{batchCount !== 1 ? 'es' : ''} done · token from DB
        </div>
      )}
      {progress && <div style={{ fontSize: 11, color: INK_M, maxWidth: 300, textAlign: 'right' }}>{progress}</div>}
      {err && <div style={{ fontSize: 11, color: RED, maxWidth: 300, textAlign: 'right' }}>Failed: {err}</div>}
    </div>
  );
}
