'use client';
// app/holding/it2/system/routes/page.tsx
// brief route_canon_registry-v1 · D3 — Route Canon Dashboard
// Four tabs: Backlog (tenant stubs) · Quarantine (dead legacy) · Defects · Drift
// Reads public.v_route_registry via /api/governance/route-registry.
// Decision dropdown writes back via /api/governance/route-decision.
// Visual language mirrors app/holding/it2/knowledge/data/sitemap/page.tsx.

import { useState, useEffect, useMemo } from 'react';

type Tree = 'tenant' | 'holding' | 'legacy' | 'platform' | 'tenant-malformed' | 'holding-bound' | 'removed';
type Reach = 'menu' | 'linked' | 'dead' | null;
type Decision = 'keep' | 'port' | 'quarantine' | 'archive' | 'redirect' | null;

interface RouteRow {
  route_path: string;
  file_path: string | null;
  tree: Tree;
  twin_path: string | null;
  twin_state: string | null;
  is_stub: boolean;
  is_redirect_only: boolean;
  reachability: Reach;
  defects: string[];
  decision: Decision;
  decision_by: string | null;
  decision_at: string | null;
  decision_note: string | null;
  scanned_commit: string | null;
  last_seen_at: string | null;
}

type TabKey = 'backlog' | 'quarantine' | 'defects' | 'drift';

const TREE_STYLE: Record<string, { bg: string; color: string }> = {
  tenant:             { bg: '#E3F2FD', color: '#1565C0' },
  holding:            { bg: '#E8F5E9', color: '#2E7D32' },
  legacy:             { bg: '#FFF3E0', color: '#E65100' },
  platform:           { bg: '#F3E5F5', color: '#6A1B9A' },
  'tenant-malformed': { bg: '#FFEBEE', color: '#B71C1C' },
  'holding-bound':    { bg: '#E8F5E9', color: '#388E3C' },
  removed:            { bg: '#FAFAFA', color: '#9E9E9E' },
};

const DECISION_OPTS = [
  { value: '', label: '— decide —' },
  { value: 'keep',       label: '✓ keep' },
  { value: 'port',       label: '⬆ port to tenant' },
  { value: 'quarantine', label: '🔒 quarantine' },
  { value: 'archive',    label: '📦 archive' },
  { value: 'redirect',   label: '↗ add redirect' },
];

const DECISION_COLOR: Record<string, string> = {
  keep: '#2E7D32', port: '#1565C0', quarantine: '#E65100',
  archive: '#9E9E9E', redirect: '#6A1B9A',
};

function Pill({ label, bg, color }: { label: string; bg: string; color: string }) {
  return (
    <span style={{
      fontSize: 9, fontWeight: 700, padding: '2px 6px', borderRadius: 99,
      background: bg, color, letterSpacing: '0.05em',
      textTransform: 'uppercase' as const, whiteSpace: 'nowrap' as const, flexShrink: 0,
    }}>{label}</span>
  );
}

function RouteTable({ rows, onDecide, busy }: {
  rows: RouteRow[];
  onDecide: (path: string, decision: string) => void;
  busy: string | null;
}) {
  if (rows.length === 0) {
    return <div style={{ padding: '40px 0', textAlign: 'center' as const, color: '#8A8A8A', fontSize: 13 }}>No routes in this view.</div>;
  }
  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse' as const, fontSize: 12 }}>
        <thead>
          <tr style={{ borderBottom: '2px solid #E6DFCC', background: '#FAFAF7' }}>
            {['Route', 'Tree', 'Twin', 'Reach', 'Defects', 'Decision'].map(h => (
              <th key={h} style={{ padding: '8px 10px', textAlign: 'left' as const, fontSize: 10, fontWeight: 700, color: '#5A5A5A', letterSpacing: '0.05em', textTransform: 'uppercase' as const }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map(row => {
            const ts = TREE_STYLE[row.tree] ?? TREE_STYLE.legacy;
            return (
              <tr key={row.route_path} style={{ borderBottom: '1px solid #F0EBE0', background: busy === row.route_path ? '#FFFBF0' : undefined }}>
                <td style={{ padding: '6px 10px', fontFamily: 'monospace', fontSize: 11, color: '#1B1B1B', maxWidth: 320, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const }}>
                  <code>{row.route_path}</code>
                </td>
                <td style={{ padding: '6px 8px' }}>
                  <Pill label={row.tree.replace(/-/g, ' ')} bg={ts.bg} color={ts.color} />
                </td>
                <td style={{ padding: '6px 8px' }}>
                  {row.twin_state && <Pill label={row.twin_state} bg="#F9F7F2" color="#5A5A5A" />}
                </td>
                <td style={{ padding: '6px 8px' }}>
                  {row.reachability && (
                    <Pill
                      label={row.reachability}
                      bg={row.reachability === 'dead' ? '#FFEBEE' : row.reachability === 'menu' ? '#E8F5E9' : '#E3F2FD'}
                      color={row.reachability === 'dead' ? '#B71C1C' : row.reachability === 'menu' ? '#2E7D32' : '#1565C0'}
                    />
                  )}
                </td>
                <td style={{ padding: '6px 8px' }}>
                  <span style={{ display: 'flex', gap: 3, flexWrap: 'wrap' as const }}>
                    {(row.defects ?? []).map(d => <Pill key={d} label={d.replace(/_/g, ' ')} bg="#FFEBEE" color="#B71C1C" />)}
                  </span>
                </td>
                <td style={{ padding: '6px 8px' }}>
                  <select
                    value={row.decision ?? ''}
                    onChange={e => onDecide(row.route_path, e.target.value)}
                    disabled={busy === row.route_path}
                    style={{
                      fontSize: 11, padding: '3px 6px', border: '1px solid #E6DFCC', borderRadius: 4,
                      color: row.decision ? DECISION_COLOR[row.decision] : '#5A5A5A',
                      fontWeight: row.decision ? 600 : 400, cursor: 'pointer',
                    }}
                  >
                    {DECISION_OPTS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

const TAB_LABELS: Record<TabKey, string> = {
  backlog: 'Backlog', quarantine: 'Quarantine', defects: 'Defects', drift: 'Drift',
};
const TAB_DESC: Record<TabKey, string> = {
  backlog:    'Tenant stubs — pages that exist as shells and need porting to real implementations',
  quarantine: 'Dead legacy routes — no menu link, no code reference, quarantine candidates',
  defects:    'Routes with code-level defects (bare hrefs, hardcoded property IDs, dead stub imports…)',
  drift:      'Routes that vanished from the repo since the last registry scan',
};

export default function RoutesPage() {
  const [rows, setRows]       = useState<RouteRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr]         = useState<string | null>(null);
  const [tab, setTab]         = useState<TabKey>('quarantine');
  const [busy, setBusy]       = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/governance/route-registry')
      .then(r => r.json())
      .then(d => { setRows(d.routes ?? []); setLoading(false); })
      .catch(e => { setErr(e.message); setLoading(false); });
  }, []);

  const backlog    = useMemo(() => rows.filter(r => r.tree === 'tenant' && r.is_stub), [rows]);
  const quarantine = useMemo(() => rows.filter(r => r.tree === 'legacy' && r.reachability === 'dead'), [rows]);
  const defects    = useMemo(() => rows.filter(r => (r.defects ?? []).length > 0), [rows]);
  const drift      = useMemo(() => rows.filter(r => r.tree === 'removed'), [rows]);
  const tabRows: Record<TabKey, RouteRow[]> = { backlog, quarantine, defects, drift };
  const counts = { backlog: backlog.length, quarantine: quarantine.length, defects: defects.length, drift: drift.length };

  async function onDecide(routePath: string, decision: string) {
    if (!decision) return;
    setBusy(routePath);
    try {
      await fetch('/api/governance/route-decision', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ route_path: routePath, decision }),
      });
      setRows(prev => prev.map(r => r.route_path === routePath ? { ...r, decision: decision as Decision } : r));
    } finally {
      setBusy(null);
    }
  }

  return (
    <div style={{ padding: '20px 24px 64px', background: '#FFFFFF', minHeight: '100vh' }}>
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 18, fontWeight: 700, color: '#1B1B1B', margin: '0 0 4px' }}>Route Canon</h1>
        {!loading && (
          <p style={{ fontSize: 11, color: '#5A5A5A', margin: 0 }}>
            {rows.length} routes · {quarantine.length} quarantine candidates · {defects.length} defects · {drift.length} drifted
          </p>
        )}
      </div>

      <div style={{ display: 'flex', borderBottom: '1px solid #E6DFCC', marginBottom: 16 }}>
        {(Object.keys(TAB_LABELS) as TabKey[]).map(t => (
          <button key={t} onClick={() => setTab(t)} style={{
            background: 'none', border: 'none',
            borderBottom: t === tab ? '2px solid #1F3A2E' : '2px solid transparent',
            padding: '8px 14px', fontSize: 12, fontWeight: t === tab ? 700 : 500,
            color: t === tab ? '#1B1B1B' : '#5A5A5A', cursor: 'pointer', marginBottom: -1,
          }}>
            {TAB_LABELS[t]}
            {!loading && (
              <span style={{
                marginLeft: 6, fontSize: 10, fontWeight: 600, padding: '1px 6px', borderRadius: 99,
                background: counts[t] > 0 ? '#F4EFE2' : '#FAFAF7',
                color: counts[t] > 0 ? '#5A3E1B' : '#8A8A8A',
              }}>{counts[t]}</span>
            )}
          </button>
        ))}
      </div>

      <p style={{ fontSize: 11, color: '#8A8A8A', margin: '0 0 14px' }}>{TAB_DESC[tab]}</p>

      {loading && <div style={{ padding: '40px 0', textAlign: 'center' as const, color: '#8A8A8A', fontSize: 13 }}>Loading route registry…</div>}
      {err    && <div style={{ padding: 12, background: '#FFEBEE', borderRadius: 4, color: '#B71C1C', fontSize: 12 }}>Error: {err}</div>}
      {!loading && !err && <RouteTable rows={tabRows[tab]} onDecide={onDecide} busy={busy} />}

      {!loading && (
        <div style={{ marginTop: 24, paddingTop: 16, borderTop: '1px solid #F0EBE0', display: 'flex', gap: 16, fontSize: 10, color: '#8A8A8A', flexWrap: 'wrap' as const }}>
          <span style={{ fontWeight: 700, color: '#1B1B1B' }}>route_canon_registry-v1</span>
          <span>Synced via <code style={{ fontFamily: 'monospace', fontSize: 9 }}>scripts/sync-route-registry.mjs</code></span>
          <span>Decisions stored in <code style={{ fontFamily: 'monospace', fontSize: 9 }}>governance.route_registry</code></span>
        </div>
      )}
    </div>
  );
}
