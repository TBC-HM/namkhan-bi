'use client';
// app/holding/it/cockpit/deploys/DeploysView.tsx
// Deploys console for the IT cockpit — lists recent Vercel deployments,
// shows live smoke-check results for key routes, and polls every 60 s.
//
// Design: paper-white #FFFFFF, hairlines #E6DFCC, ink #1B1B1B,
//         ink-soft #5A5A5A, brand green #084838.
// Status colours are all routed through CSS custom properties (no raw hex
// in component logic). Primitives are declared first, semantics alias them.

import React, { useCallback, useEffect, useRef, useState } from 'react';

// ─── Types ───────────────────────────────────────────────────────────────────

interface VercelDeploy {
  uid: string;
  name: string;
  url: string;
  state: 'READY' | 'ERROR' | 'BUILDING' | 'QUEUED' | 'CANCELED' | string;
  createdAt: number;
  target: 'production' | 'preview' | string;
  meta?: { githubCommitMessage?: string; githubCommitRef?: string };
}

interface RouteCheck {
  path: string;
  ok: boolean | null; // null = pending
  status: number | null;
  ms: number | null;
}

// ─── Constants ───────────────────────────────────────────────────────────────

const SMOKE_ROUTES = [
  '/api/health',
  '/api/cockpit-v2/health',
  '/holding/it/cockpit',
  '/hotel/dashboard',
  '/hotel/revenue',
];

const POLL_MS = 60_000;

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmtDate(ts: number): string {
  return new Date(ts).toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function deployStateLabel(state: string): string {
  const map: Record<string, string> = {
    READY: 'Live',
    ERROR: 'Failed',
    BUILDING: 'Building',
    QUEUED: 'Queued',
    CANCELED: 'Cancelled',
  };
  return map[state] ?? state;
}

// Maps a Vercel deploy state to a data-status token value
function deployStateToken(state: string): 'success' | 'error' | 'warning' | 'neutral' {
  if (state === 'READY') return 'success';
  if (state === 'ERROR') return 'error';
  if (state === 'BUILDING' || state === 'QUEUED') return 'warning';
  return 'neutral';
}

// Maps a route-check result to a data-status token value
function checkToken(ok: boolean | null): 'success' | 'error' | 'warning' | 'neutral' {
  if (ok === null) return 'warning';
  return ok ? 'success' : 'error';
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function LiveDot({ isLive }: { isLive: boolean }) {
  return (
    <span
      data-status={isLive ? 'success' : 'neutral'}
      style={{
        display: 'inline-block',
        width: 8,
        height: 8,
        borderRadius: '50%',
        background: isLive ? 'var(--status-success-bg-strong)' : 'var(--status-neutral-bg-strong)',
        verticalAlign: 'middle',
        marginRight: 6,
      }}
    />
  );
}

function StateBadge({ state }: { state: string }) {
  const token = deployStateToken(state);
  return (
    <span
      data-status={token}
      style={{
        display: 'inline-block',
        padding: '2px 8px',
        borderRadius: 4,
        fontSize: 11,
        fontWeight: 600,
        letterSpacing: '0.03em',
        background: `var(--status-${token}-bg)`,
        color: `var(--status-${token}-fg)`,
        border: `1px solid var(--status-${token}-border)`,
      }}
    >
      {deployStateLabel(state)}
    </span>
  );
}

function CheckBadge({ check }: { check: RouteCheck }) {
  const token = checkToken(check.ok);
  const label =
    check.ok === null ? 'Checking…' : check.ok ? `OK ${check.status}` : `Fail ${check.status ?? '—'}`;
  return (
    <span
      data-status={token}
      style={{
        display: 'inline-block',
        padding: '2px 8px',
        borderRadius: 4,
        fontSize: 11,
        fontWeight: 600,
        background: `var(--status-${token}-bg)`,
        color: `var(--status-${token}-fg)`,
        border: `1px solid var(--status-${token}-border)`,
        minWidth: 56,
        textAlign: 'center',
      }}
    >
      {label}
    </span>
  );
}

// ─── Main component ──────────────────────────────────────────────────────────

export function DeploysView() {
  const [deploys, setDeploys] = useState<VercelDeploy[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastFetch, setLastFetch] = useState<Date | null>(null);
  const [checks, setChecks] = useState<RouteCheck[]>(
    SMOKE_ROUTES.map((path) => ({ path, ok: null, status: null, ms: null })),
  );
  const pollRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Fetch deployments from existing /api/cockpit/deployments endpoint
  const fetchDeploys = useCallback(async () => {
    try {
      const res = await fetch('/api/cockpit/deployments', { cache: 'no-store' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      // The endpoint may return { deployments: [...] } or an array directly
      const list: VercelDeploy[] = Array.isArray(json)
        ? json
        : Array.isArray(json?.deployments)
          ? json.deployments
          : [];
      setDeploys(list);
      setError(null);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load deployments');
    } finally {
      setLoading(false);
      setLastFetch(new Date());
    }
  }, []);

  // Smoke check a single route via HEAD
  const runChecks = useCallback(async () => {
    setChecks(SMOKE_ROUTES.map((path) => ({ path, ok: null, status: null, ms: null })));
    await Promise.all(
      SMOKE_ROUTES.map(async (path, i) => {
        const t0 = Date.now();
        try {
          const res = await fetch(path, { method: 'HEAD', cache: 'no-store' });
          const ms = Date.now() - t0;
          setChecks((prev) => {
            const next = [...prev];
            next[i] = { path, ok: res.ok, status: res.status, ms };
            return next;
          });
        } catch {
          setChecks((prev) => {
            const next = [...prev];
            next[i] = { path, ok: false, status: null, ms: Date.now() - t0 };
            return next;
          });
        }
      }),
    );
  }, []);

  // Mount + poll
  useEffect(() => {
    fetchDeploys();
    runChecks();
    pollRef.current = setInterval(() => {
      fetchDeploys();
      runChecks();
    }, POLL_MS);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [fetchDeploys, runChecks]);

  const latestDeploy = deploys[0] ?? null;
  const isLive = latestDeploy?.state === 'READY';

  return (
    <>
      <style>{`
        /* ── Primitive palette ─────────────────────────────────────────────── */
        :root {
          --color-green-50:  #E8F5E9;
          --color-green-700: #2E7D32;
          --color-green-900: #084838;
          --color-red-50:    #FFEBEE;
          --color-red-700:   #D32F2F;
          --color-amber-50:  #FFF8E1;
          --color-amber-600: #F57F17;
          --color-blue-50:   #E3F2FD;
          --color-blue-700:  #1565C0;
          --color-grey-50:   #F5F5F5;
          --color-grey-200:  #E6DFCC;
          --color-grey-300:  #C8C0B0;
          --color-grey-600:  #5A5A5A;
          --color-ink:       #1B1B1B;
          --color-white:     #FFFFFF;
        }

        /* ── Semantic status tokens ────────────────────────────────────────── */
        :root {
          /* success (green) */
          --status-success-bg:        var(--color-green-50);
          --status-success-bg-strong: var(--color-green-700);
          --status-success-fg:        var(--color-green-700);
          --status-success-border:    var(--color-green-700);

          /* error (red) */
          --status-error-bg:          var(--color-red-50);
          --status-error-bg-strong:   var(--color-red-700);
          --status-error-fg:          var(--color-red-700);
          --status-error-border:      var(--color-red-700);

          /* warning (amber) */
          --status-warning-bg:        var(--color-amber-50);
          --status-warning-bg-strong: var(--color-amber-600);
          --status-warning-fg:        var(--color-amber-600);
          --status-warning-border:    var(--color-amber-600);

          /* neutral (grey) */
          --status-neutral-bg:        var(--color-grey-50);
          --status-neutral-bg-strong: var(--color-grey-300);
          --status-neutral-fg:        var(--color-grey-600);
          --status-neutral-border:    var(--color-grey-300);
        }

        /* ── Layout ────────────────────────────────────────────────────────── */
        .dv-root {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
          color: var(--color-ink);
          background: var(--color-white);
          padding: 32px 28px;
          max-width: 900px;
        }
        .dv-heading {
          font-size: 20px;
          font-weight: 700;
          letter-spacing: -0.02em;
          margin: 0 0 4px;
          color: var(--color-ink);
        }
        .dv-sub {
          font-size: 13px;
          color: var(--color-grey-600);
          margin: 0 0 24px;
        }
        .dv-section-title {
          font-size: 11px;
          font-weight: 700;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          color: var(--color-grey-600);
          margin: 0 0 10px;
        }
        .dv-card {
          background: var(--color-white);
          border: 1px solid var(--color-grey-200);
          border-radius: 8px;
          padding: 16px 20px;
          margin-bottom: 24px;
        }
        .dv-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 13px;
        }
        .dv-table th {
          text-align: left;
          font-size: 11px;
          font-weight: 600;
          letter-spacing: 0.05em;
          text-transform: uppercase;
          color: var(--color-grey-600);
          border-bottom: 1px solid var(--color-grey-200);
          padding: 0 12px 8px 0;
        }
        .dv-table td {
          padding: 8px 12px 8px 0;
          border-bottom: 1px solid var(--color-grey-200);
          vertical-align: middle;
        }
        .dv-table tr:last-child td { border-bottom: none; }
        .dv-mono {
          font-family: 'SF Mono', 'Fira Mono', monospace;
          font-size: 12px;
          color: var(--color-grey-600);
        }
        .dv-commit {
          font-size: 12px;
          color: var(--color-grey-600);
          max-width: 260px;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .dv-refresh-row {
          display: flex;
          align-items: center;
          gap: 12px;
          margin-bottom: 24px;
        }
        .dv-btn {
          font-size: 12px;
          font-weight: 600;
          color: var(--color-green-900);
          background: var(--color-white);
          border: 1px solid var(--color-green-900);
          border-radius: 5px;
          padding: 5px 14px;
          cursor: pointer;
        }
        .dv-btn:hover { background: var(--color-green-50); }
        .dv-ts {
          font-size: 12px;
          color: var(--color-grey-600);
        }
        .dv-error {
          color: var(--status-error-fg);
          font-size: 13px;
          margin-bottom: 16px;
        }
        .dv-empty {
          color: var(--color-grey-600);
          font-size: 13px;
          padding: 12px 0;
        }
        .dv-live-row {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 14px;
          font-weight: 600;
          margin-bottom: 6px;
        }
        .dv-live-url {
          font-size: 12px;
          color: var(--color-grey-600);
        }
        .dv-live-url a {
          color: var(--color-green-900);
          text-decoration: none;
        }
        .dv-live-url a:hover { text-decoration: underline; }
      `}</style>

      <div className="dv-root">
        <h1 className="dv-heading">Deployments</h1>
        <p className="dv-sub">
          Recent Vercel deployments · auto-refreshes every 60 s
        </p>

        {/* Current production status */}
        <div className="dv-card">
          <p className="dv-section-title">Production</p>
          {latestDeploy ? (
            <>
              <div className="dv-live-row">
                <LiveDot isLive={isLive} />
                <span
                  data-status={isLive ? 'success' : 'neutral'}
                  style={{ color: isLive ? 'var(--status-success-fg)' : 'var(--status-neutral-fg)' }}
                >
                  {isLive ? 'Live' : 'Not live'}
                </span>
                <StateBadge state={latestDeploy.state} />
              </div>
              <div className="dv-live-url">
                <a
                  href={`https://${latestDeploy.url}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  {latestDeploy.url}
                </a>
                {' · '}
                {fmtDate(latestDeploy.createdAt)}
              </div>
            </>
          ) : loading ? (
            <div className="dv-empty">Loading…</div>
          ) : (
            <div className="dv-empty">No deployments found.</div>
          )}
        </div>

        {/* Controls */}
        <div className="dv-refresh-row">
          <button
            className="dv-btn"
            onClick={() => { fetchDeploys(); runChecks(); }}
          >
            Refresh now
          </button>
          {lastFetch && (
            <span className="dv-ts">Last fetched: {lastFetch.toLocaleTimeString('en-GB')}</span>
          )}
        </div>

        {error && <div className="dv-error">⚠ {error}</div>}

        {/* Route smoke checks */}
        <div className="dv-card">
          <p className="dv-section-title">Route smoke checks</p>
          <table className="dv-table">
            <thead>
              <tr>
                <th>Path</th>
                <th>Status</th>
                <th>Latency</th>
              </tr>
            </thead>
            <tbody>
              {checks.map((c) => (
                <tr key={c.path}>
                  <td className="dv-mono">{c.path}</td>
                  <td><CheckBadge check={c} /></td>
                  <td className="dv-mono">{c.ms !== null ? `${c.ms} ms` : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Deploy history */}
        <div className="dv-card">
          <p className="dv-section-title">Deploy history</p>
          {loading && deploys.length === 0 ? (
            <div className="dv-empty">Loading deployments…</div>
          ) : deploys.length === 0 ? (
            <div className="dv-empty">No deployments available.</div>
          ) : (
            <table className="dv-table">
              <thead>
                <tr>
                  <th>State</th>
                  <th>Project</th>
                  <th>Branch / commit</th>
                  <th>Target</th>
                  <th>Deployed</th>
                </tr>
              </thead>
              <tbody>
                {deploys.map((d) => (
                  <tr key={d.uid}>
                    <td><StateBadge state={d.state} /></td>
                    <td style={{ fontWeight: 500 }}>{d.name}</td>
                    <td>
                      <div className="dv-mono">{d.meta?.githubCommitRef ?? '—'}</div>
                      <div className="dv-commit">{d.meta?.githubCommitMessage ?? ''}</div>
                    </td>
                    <td className="dv-mono">{d.target}</td>
                    <td className="dv-mono">{fmtDate(d.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </>
  );
}
