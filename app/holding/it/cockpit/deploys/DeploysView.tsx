'use client';

// app/holding/it/cockpit/deploys/DeploysView.tsx
// PBS 2026-07-24: Vercel-style live deployment dashboard.
// Polls GitHub check-runs every 5s when building, 30s idle.

import { useEffect, useState, useCallback } from 'react';

// ── Types ─────────────────────────────────────────────────────────────────────

type CheckRun = { name: string; status: string; conclusion: string | null };

type CommitRow = {
  sha: string;
  sha_full: string;
  message: string;
  author: string;
  date: string;
  checks: CheckRun[];
};

type GitHubPayload = { commits: CommitRow[]; fetched_at?: string; error?: string };

type VercelDeploy = {
  uid: string;
  state: string;
  created_at: string;
  sha: string;
  ref: string;
  message: string;
  url: string | null;
  source: 'vercel' | 'audit_log';
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function ageStr(iso: string): string {
  const m = Math.round((Date.now() - new Date(iso).getTime()) / 60_000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  if (m < 1440) return `${Math.round(m / 60)}h ago`;
  return `${Math.round(m / 1440)}d ago`;
}

function checkOverall(checks: CheckRun[]): 'success' | 'failure' | 'in_progress' | 'queued' | 'none' {
  if (!checks.length) return 'none';
  if (checks.some(c => c.status === 'in_progress')) return 'in_progress';
  if (checks.some(c => c.status === 'queued')) return 'queued';
  if (checks.some(c => c.conclusion === 'failure')) return 'failure';
  if (checks.every(c => c.conclusion === 'success')) return 'success';
  return 'in_progress';
}

const STATE_DOT: Record<string, { color: string; pulse: boolean; label: string }> = {
  READY:    { color: '#2E7D32', pulse: false, label: 'Ready' },
  success:  { color: '#2E7D32', pulse: false, label: 'Ready' },
  ERROR:    { color: '#D32F2F', pulse: false, label: 'Error' },
  failure:  { color: '#D32F2F', pulse: false, label: 'Failed' },
  BUILDING: { color: '#F57F17', pulse: true,  label: 'Building' },
  QUEUED:   { color: '#F57F17', pulse: true,  label: 'Queued' },
  in_progress:{ color: '#1565C0', pulse: true, label: 'Running' },
  queued:   { color: '#8A8A8A', pulse: true,  label: 'Queued' },
  none:     { color: '#C8C0B0', pulse: false, label: '—' },
};

function Dot({ state }: { state: string }) {
  const s = STATE_DOT[state] ?? STATE_DOT.none;
  return (
    <span style={{
      display: 'inline-block', width: 9, height: 9, borderRadius: '50%',
      background: s.color, flexShrink: 0, marginTop: 2,
      boxShadow: s.pulse ? `0 0 0 2px ${s.color}44` : 'none',
      animation: s.pulse ? 'pulse 1.4s ease-in-out infinite' : 'none',
    }} />
  );
}

function CheckBadge({ run }: { run: CheckRun }) {
  const shortName = run.name.replace('lint · typecheck · build', 'build').replace('tsc --noEmit', 'tsc').replace('pre-deploy-checks', 'pre-deploy');
  const ok = run.conclusion === 'success';
  const fail = run.conclusion === 'failure';
  const running = run.status === 'in_progress';
  const queued = run.status === 'queued';

  return (
    <span style={{
      fontSize: 10, fontWeight: 600, padding: '2px 6px', borderRadius: 3,
      background: ok ? '#E8F5E9' : fail ? '#FFEBEE' : running ? '#E3F2FD' : '#F5F5F5',
      color: ok ? '#2E7D32' : fail ? '#D32F2F' : running ? '#1565C0' : '#8A8A8A',
      fontFamily: 'monospace',
    }}>
      {shortName} {ok ? '✓' : fail ? '✕' : running ? '⟳' : queued ? '·' : '—'}
    </span>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function DeploysView() {
  const [ghData, setGhData] = useState<GitHubPayload | null>(null);
  const [vercelData, setVercelData] = useState<VercelDeploy[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchedAt, setFetchedAt] = useState<Date | null>(null);
  const [pollInterval, setPollInterval] = useState(30_000);

  const loadGitHub = useCallback(async () => {
    try {
      const res = await fetch('/api/cockpit/deployments/github', { cache: 'no-store' });
      if (res.ok) {
        const j = (await res.json()) as GitHubPayload;
        setGhData(j);
        setFetchedAt(new Date());
        // If any commit has in_progress checks, poll fast
        const anyBuilding = j.commits?.some(c => checkOverall(c.checks) === 'in_progress' || checkOverall(c.checks) === 'queued');
        setPollInterval(anyBuilding ? 5_000 : 30_000);
      }
    } catch {}
  }, []);

  const loadVercel = useCallback(async () => {
    try {
      const res = await fetch('/api/cockpit/deployments', { cache: 'no-store' });
      if (res.ok) {
        const j = await res.json();
        // Extract deploys from any project key
        const allDeploys: VercelDeploy[] = [];
        for (const v of Object.values(j)) {
          if (v && typeof v === 'object' && 'deploys' in (v as any)) {
            allDeploys.push(...((v as any).deploys ?? []));
          }
        }
        allDeploys.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
        setVercelData(allDeploys.slice(0, 20));
      }
    } catch {}
  }, []);

  useEffect(() => {
    Promise.all([loadGitHub(), loadVercel()]).finally(() => setLoading(false));
  }, [loadGitHub, loadVercel]);

  useEffect(() => {
    const id = window.setInterval(loadGitHub, pollInterval);
    return () => window.clearInterval(id);
  }, [loadGitHub, pollInterval]);

  // Build a map from sha (8-char) → vercel deploy for linking
  const vercelBySha = new Map(vercelData.map(d => [d.sha, d]));

  const isLive = pollInterval === 5_000;
  const commits = ghData?.commits ?? [];

  return (
    <div style={{ maxWidth: 900, padding: '24px 24px 48px' }}>
      <style>{`
        @keyframes pulse { 0%,100% { opacity:1 } 50% { opacity:0.4 } }
        @keyframes spin { from { transform:rotate(0deg) } to { transform:rotate(360deg) } }
      `}</style>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
        <h1 style={{ fontSize: 18, fontWeight: 700, color: '#1B1B1B', margin: 0 }}>Deployments</h1>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: isLive ? '#2E7D32' : '#5A5A5A' }}>
          <span style={{ width: 7, height: 7, borderRadius: '50%', background: isLive ? '#2E7D32' : '#C8C0B0',
            display: 'inline-block', animation: isLive ? 'pulse 1.4s ease-in-out infinite' : 'none' }} />
          {isLive ? 'Live · polling 5s' : 'Idle · polling 30s'}
        </div>
        {fetchedAt && (
          <span style={{ fontSize: 10, color: '#8A8A8A', marginLeft: 'auto' }}>
            updated {ageStr(fetchedAt.toISOString())}
          </span>
        )}
        <button onClick={() => { loadGitHub(); loadVercel(); }}
          style={{ fontSize: 11, padding: '4px 10px', borderRadius: 4, border: '1px solid #E6DFCC',
            background: '#FFFFFF', color: '#1B1B1B', cursor: 'pointer' }}>
          ↻ Refresh
        </button>
        <a href="https://vercel.com/pbsbase-2825s-projects/namkhan-bi/deployments"
          target="_blank" rel="noopener"
          style={{ fontSize: 11, padding: '4px 10px', borderRadius: 4, background: '#000',
            color: '#fff', textDecoration: 'none', fontWeight: 600 }}>
          ↗ Vercel
        </a>
      </div>

      {loading && (
        <div style={{ fontSize: 12, color: '#5A5A5A', padding: '20px 0' }}>Loading…</div>
      )}

      {!loading && commits.length === 0 && (
        <div style={{ fontSize: 12, color: '#B8542A', padding: '12px 0' }}>
          {ghData?.error ?? 'No commits found — check GitHub token.'}
        </div>
      )}

      {/* Commit + CI list */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
        {commits.map((c, i) => {
          const overall = checkOverall(c.checks);
          const dot = STATE_DOT[overall] ?? STATE_DOT.none;
          const vDeploy = vercelBySha.get(c.sha);
          const isFirst = i === 0;

          return (
            <div key={c.sha} style={{
              display: 'grid',
              gridTemplateColumns: '16px 1fr auto',
              gap: '0 12px',
              padding: '12px 16px',
              background: isFirst ? '#FAFAF7' : '#FFFFFF',
              borderBottom: '1px solid #E6DFCC',
              borderLeft: isFirst ? '2px solid ' + dot.color : '2px solid transparent',
              alignItems: 'start',
            }}>
              {/* Dot */}
              <div style={{ paddingTop: 3 }}>
                <Dot state={overall} />
              </div>

              {/* Content */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 5, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#1B1B1B',
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {c.message || '(no message)'}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <code style={{ fontSize: 10, background: '#F4EFE2', padding: '1px 6px',
                    borderRadius: 3, color: '#5A5A5A', fontFamily: 'monospace' }}>{c.sha}</code>
                  <span style={{ fontSize: 10, background: '#E8EAF6', padding: '1px 6px',
                    borderRadius: 3, color: '#283593', fontWeight: 600 }}>main</span>
                  <span style={{ fontSize: 10, color: '#8A8A8A' }}>{c.date ? ageStr(c.date) : '—'}</span>
                  {c.author && <span style={{ fontSize: 10, color: '#8A8A8A' }}>· {c.author}</span>}
                </div>
                {c.checks.length > 0 && (
                  <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 2 }}>
                    {c.checks.map(run => <CheckBadge key={run.name} run={run} />)}
                  </div>
                )}
                {vDeploy?.url && (
                  <div style={{ marginTop: 2 }}>
                    <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 3,
                      background: '#E8F5E9', color: '#2E7D32', fontWeight: 600 }}>
                      ● READY
                    </span>
                    <a href={vDeploy.url} target="_blank" rel="noopener"
                      style={{ fontSize: 10, color: '#1565C0', marginLeft: 6 }}>
                      {vDeploy.url.replace('https://', '').slice(0, 50)} ↗
                    </a>
                  </div>
                )}
              </div>

              {/* Right: Vercel state if known */}
              <div style={{ textAlign: 'right', fontSize: 10, color: '#8A8A8A', whiteSpace: 'nowrap' }}>
                {vDeploy ? (
                  <span style={{ color: vDeploy.state === 'READY' ? '#2E7D32' : vDeploy.state === 'ERROR' ? '#D32F2F' : '#F57F17',
                    fontWeight: 600 }}>
                    {vDeploy.state}
                  </span>
                ) : (
                  <span>no deploy</span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Vercel deploys not matched to commits */}
      {vercelData.filter(d => !commits.some(c => c.sha === d.sha)).length > 0 && (
        <div style={{ marginTop: 24 }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.06em',
            textTransform: 'uppercase', color: '#5A5A5A', marginBottom: 10 }}>
            Other Vercel Deployments
          </div>
          {vercelData.filter(d => !commits.some(c => c.sha === d.sha)).map(d => (
            <div key={d.uid} style={{ padding: '10px 16px', borderBottom: '1px solid #E6DFCC',
              display: 'flex', gap: 12, alignItems: 'center', fontSize: 12 }}>
              <Dot state={d.state} />
              <code style={{ fontSize: 10, color: '#5A5A5A', fontFamily: 'monospace' }}>{d.sha || '—'}</code>
              <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: '#1B1B1B' }}>
                {d.message}
              </span>
              <span style={{ color: '#8A8A8A', flexShrink: 0 }}>{ageStr(d.created_at)}</span>
              <span style={{ fontWeight: 600, flexShrink: 0,
                color: d.state === 'READY' ? '#2E7D32' : d.state === 'ERROR' ? '#D32F2F' : '#F57F17' }}>
                {d.state}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
