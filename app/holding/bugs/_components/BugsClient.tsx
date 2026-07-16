'use client';
// app/holding/bugs/_components/BugsClient.tsx
// Filters + table + per-row CTAs (Acknowledge / Start / Done / Dismiss / Copy for agent).

import { useMemo, useState } from 'react';

export interface BugRow {
  id: number;
  dept_slug: string | null;
  body: string | null;
  status: string | null;
  fix_link: string | null;
  fix_label: string | null;
  created_by: string | null;
  page_url: string | null;
  viewport: string | null;
  user_agent: string | null;
  reporter_user_id: string | null;
  property_id: string | null;
  notes: string | null;
  created_at: string;
  acked_at: string | null;
  started_at: string | null;
  done_at: string | null;
  updated_at: string | null;
}

const T = {
  paper: '#FFFFFF', hairline: '#E6DFCC', warm: '#F5F0E1',
  ink: '#1B1B1B', inkSoft: '#5A5A5A', inkMute: '#8A8A8A',
  green: '#084838', red: '#B04A2F', amber: '#B48A3A',
};

type StatusKey = 'open' | 'acknowledged' | 'in_progress' | 'done' | 'dismissed';

function statusOf(r: BugRow): StatusKey {
  if (r.status === 'dismissed') return 'dismissed';
  if (r.done_at) return 'done';
  if (r.started_at) return 'in_progress';
  if (r.acked_at) return 'acknowledged';
  return 'open';
}

const STATUS_LABEL: Record<StatusKey, string> = {
  open: 'Open', acknowledged: 'Acked', in_progress: 'In progress',
  done: 'Done', dismissed: 'Dismissed',
};

const STATUS_TONE: Record<StatusKey, { bg: string; fg: string }> = {
  open:         { bg: '#FDECE4', fg: T.red },
  acknowledged: { bg: '#F0EAD8', fg: T.amber },
  in_progress:  { bg: '#EAF1EE', fg: T.green },
  done:         { bg: '#EAF1EE', fg: T.green },
  dismissed:    { bg: T.warm,    fg: T.inkMute },
};

function relTime(iso: string): string {
  const d = new Date(iso).getTime();
  const s = Math.round((Date.now() - d) / 1000);
  if (s < 60) return s + 's ago';
  if (s < 3600) return Math.round(s / 60) + 'm ago';
  if (s < 86400) return Math.round(s / 3600) + 'h ago';
  return Math.round(s / 86400) + 'd ago';
}

function normalizeRoute(url: string | null): string {
  if (!url) return '/';
  try {
    const u = new URL(url);
    return u.pathname
      .replace(/\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, '/[id]')
      .replace(/\/\d{4,}/g, '/[id]');
  } catch { return url; }
}

function likelyFiles(url: string | null): string[] {
  const route = normalizeRoute(url);
  if (route === '/') return [];
  const seg = route.split('/').filter(Boolean)[0] ?? '';
  if (!seg) return [];
  return [`app/${seg}/**`, `components/${seg}/**`, `lib/${seg}*.ts`];
}

function agentPayload(r: BugRow): Record<string, unknown> {
  return {
    task_type: 'bug_fix',
    bug_id: r.id,
    created_at: r.created_at,
    reporter: r.created_by ?? r.reporter_user_id ?? 'unknown',
    page_url: r.page_url,
    route_path: normalizeRoute(r.page_url),
    viewport: r.viewport,
    user_agent: r.user_agent,
    body: r.body ?? '',
    notes: r.notes ?? '',
    context_hints: {
      likely_files: likelyFiles(r.page_url),
      dept_slug: r.dept_slug,
      property_id: r.property_id,
    },
    action_required: 'diagnose_and_fix',
    success_criteria: 'reproduce bug, ship fix on main, curl-verify page returns 200/307, add before/after evidence in commit message',
  };
}

export default function BugsClient({ initialRows }: { initialRows: BugRow[] }) {
  const [rows, setRows] = useState<BugRow[]>(initialRows);
  const [busy, setBusy] = useState<number | null>(null);
  const [flash, setFlash] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusKey | 'all'>('all');
  const [deptFilter, setDeptFilter] = useState<string>('all');
  const [urlQuery, setUrlQuery] = useState<string>('');
  const [expanded, setExpanded] = useState<Set<number>>(new Set());

  const depts = useMemo(() => {
    const s = new Set<string>();
    for (const r of rows) if (r.dept_slug) s.add(r.dept_slug);
    return Array.from(s).sort();
  }, [rows]);

  const filtered = useMemo(() => {
    return rows.filter((r) => {
      if (statusFilter !== 'all' && statusOf(r) !== statusFilter) return false;
      if (deptFilter !== 'all' && r.dept_slug !== deptFilter) return false;
      if (urlQuery && !(r.page_url ?? '').toLowerCase().includes(urlQuery.toLowerCase())) return false;
      return true;
    });
  }, [rows, statusFilter, deptFilter, urlQuery]);

  async function del(id: number) {
    if (!confirm('Delete this bug row permanently?')) return;
    setBusy(id);
    try {
      const r = await fetch(`/api/cockpit/bugs/${id}`, { method: 'DELETE' });
      if (r.ok) {
        setRows((prev) => prev.filter((x) => x.id !== id));
        setFlash(`Deleted #${id}`);
      } else {
        setFlash(`Delete failed: ${r.status}`);
      }
    } finally {
      setBusy(null);
      setTimeout(() => setFlash(null), 2500);
    }
  }

  async function act(id: number, action: 'acknowledge' | 'start' | 'done' | 'dismiss') {
    setBusy(id);
    try {
      const r = await fetch(`/api/cockpit/bugs/${id}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      if (r.ok) {
        const j = await r.json();
        setRows((prev) => prev.map((x) => x.id === id ? { ...x, ...j.row } : x));
        setFlash(`Marked ${action} · #${id}`);
      } else {
        setFlash(`Failed: ${r.status}`);
      }
    } finally {
      setBusy(null);
      setTimeout(() => setFlash(null), 2500);
    }
  }

  async function copyForAgent(r: BugRow) {
    const payload = agentPayload(r);
    try {
      await navigator.clipboard.writeText(JSON.stringify(payload, null, 2));
      setFlash(`Copied agent task · #${r.id}`);
    } catch {
      setFlash('Clipboard blocked');
    }
    setTimeout(() => setFlash(null), 2500);
  }

  function toggle(id: number) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  return (
    <div>
      {/* Filters */}
      <div style={{ background: T.paper, border: `1px solid ${T.hairline}`, borderRadius: 8, padding: 12, marginBottom: 16, display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center' }}>
        <div style={{ display: 'flex', gap: 4 }}>
          {(['all', 'open', 'acknowledged', 'in_progress', 'done', 'dismissed'] as const).map((s) => (
            <button key={s} onClick={() => setStatusFilter(s)} style={{
              border: `1px solid ${statusFilter === s ? T.green : T.hairline}`,
              background: statusFilter === s ? T.green : T.paper,
              color: statusFilter === s ? '#FFF' : T.ink,
              padding: '5px 10px', borderRadius: 4, fontSize: 11, cursor: 'pointer',
              textTransform: 'capitalize',
            }}>{s === 'all' ? 'All' : STATUS_LABEL[s]}</button>
          ))}
        </div>
        <select value={deptFilter} onChange={(e) => setDeptFilter(e.target.value)} style={{
          padding: '5px 8px', border: `1px solid ${T.hairline}`, borderRadius: 4, fontSize: 12, background: T.paper, color: T.ink,
        }}>
          <option value="all">All depts</option>
          {depts.map((d) => <option key={d} value={d}>{d}</option>)}
        </select>
        <input type="text" placeholder="Filter by page URL…" value={urlQuery} onChange={(e) => setUrlQuery(e.target.value)} style={{
          flex: 1, minWidth: 200, padding: '5px 10px', border: `1px solid ${T.hairline}`, borderRadius: 4, fontSize: 12, background: T.paper, color: T.ink,
        }} />
        <div style={{ fontSize: 11, color: T.inkSoft }}>{filtered.length} shown</div>
      </div>

      {/* Table */}
      <div style={{ background: T.paper, border: `1px solid ${T.hairline}`, borderRadius: 8, overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <thead>
            <tr style={{ background: T.warm }}>
              {['When', 'Body', 'Page', 'Reporter', 'Dept', 'Status', 'CTAs'].map((h) => (
                <th key={h} style={{
                  padding: '8px 10px', textAlign: 'left', fontSize: 10, textTransform: 'uppercase',
                  letterSpacing: '.08em', color: T.inkSoft, fontWeight: 600, borderBottom: `1px solid ${T.hairline}`,
                }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr><td colSpan={7} style={{ padding: 40, textAlign: 'center', color: T.inkSoft }}>No bugs match the current filter.</td></tr>
            ) : filtered.map((r) => {
              const s = statusOf(r);
              const tone = STATUS_TONE[s];
              const isExpanded = expanded.has(r.id);
              return (
                <>
                  <tr key={r.id} style={{ borderBottom: `1px solid ${T.hairline}` }}>
                    <td style={{ padding: '10px', color: T.inkSoft, whiteSpace: 'nowrap' }} title={r.created_at}>{relTime(r.created_at)}</td>
                    <td style={{ padding: '10px', maxWidth: 380 }}>
                      <button onClick={() => toggle(r.id)} style={{ background: 'none', border: 0, cursor: 'pointer', textAlign: 'left', padding: 0, color: T.ink, fontSize: 12 }}>
                        <span style={{ display: '-webkit-box', WebkitLineClamp: isExpanded ? undefined : 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                          {r.body ?? '(empty body)'}
                        </span>
                      </button>
                    </td>
                    <td style={{ padding: '10px', maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {r.page_url ? <a href={r.page_url} target="_blank" rel="noopener" style={{ color: T.green, textDecoration: 'underline', fontSize: 11 }}>{normalizeRoute(r.page_url)}</a> : '—'}
                    </td>
                    <td style={{ padding: '10px', color: T.inkSoft, fontSize: 11 }}>{r.created_by ?? '—'}</td>
                    <td style={{ padding: '10px', color: T.inkSoft }}>{r.dept_slug ?? '—'}</td>
                    <td style={{ padding: '10px' }}>
                      <span style={{ background: tone.bg, color: tone.fg, padding: '3px 8px', borderRadius: 3, fontSize: 10, fontWeight: 600, letterSpacing: '.05em', textTransform: 'uppercase' }}>{STATUS_LABEL[s]}</span>
                    </td>
                    <td style={{ padding: '10px', whiteSpace: 'nowrap' }}>
                      {s === 'open' && <Btn onClick={() => act(r.id, 'acknowledge')} disabled={busy === r.id}>Ack</Btn>}
                      {s === 'acknowledged' && <Btn onClick={() => act(r.id, 'start')} disabled={busy === r.id}>Start</Btn>}
                      {s === 'in_progress' && <Btn onClick={() => act(r.id, 'done')} disabled={busy === r.id} tone="green">Done</Btn>}
                      {s !== 'dismissed' && s !== 'done' && <Btn onClick={() => act(r.id, 'dismiss')} disabled={busy === r.id} tone="red">Dismiss</Btn>}
                      <Btn onClick={() => del(r.id)} disabled={busy === r.id} tone="red">🗑</Btn>
                      <Btn onClick={() => copyForAgent(r)} tone="ghost">📋 Agent</Btn>
                    </td>
                  </tr>
                  {isExpanded && (
                    <tr key={r.id + '-x'}>
                      <td colSpan={7} style={{ background: T.warm, padding: '12px 14px', borderBottom: `1px solid ${T.hairline}` }}>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12, fontSize: 11 }}>
                          <div><b>Full body:</b><br/><span style={{ whiteSpace: 'pre-wrap' }}>{r.body ?? '—'}</span></div>
                          <div><b>Notes:</b><br/><span style={{ whiteSpace: 'pre-wrap' }}>{r.notes ?? '—'}</span></div>
                          <div><b>Viewport:</b> {r.viewport ?? '—'}<br/><b>UA:</b> <span style={{ fontFamily: 'monospace', fontSize: 10 }}>{(r.user_agent ?? '').slice(0, 140)}</span></div>
                          <div>
                            <b>Timeline:</b><br/>
                            <span style={{ color: T.inkSoft }}>Created: {r.created_at}</span><br/>
                            {r.acked_at && <>Acked: {r.acked_at}<br/></>}
                            {r.started_at && <>Started: {r.started_at}<br/></>}
                            {r.done_at && <>Done: {r.done_at}</>}
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </>
              );
            })}
          </tbody>
        </table>
      </div>

      {flash && (
        <div style={{
          position: 'fixed', bottom: 24, right: 24, background: T.ink, color: '#FFF',
          padding: '10px 16px', borderRadius: 6, fontSize: 12, fontWeight: 600, boxShadow: '0 6px 20px rgba(0,0,0,.2)', zIndex: 100,
        }}>{flash}</div>
      )}
    </div>
  );
}

function Btn({ children, onClick, disabled, tone }: { children: React.ReactNode; onClick: () => void; disabled?: boolean; tone?: 'green' | 'red' | 'ghost' }) {
  const bg = tone === 'green' ? T.green : tone === 'red' ? T.paper : T.paper;
  const fg = tone === 'green' ? '#FFF' : tone === 'red' ? T.red : T.ink;
  const border = tone === 'green' ? T.green : tone === 'red' ? T.red : T.hairline;
  return (
    <button onClick={onClick} disabled={disabled} style={{
      background: bg, color: fg, border: `1px solid ${border}`,
      padding: '4px 8px', borderRadius: 3, fontSize: 10, fontWeight: 600,
      cursor: disabled ? 'wait' : 'pointer', marginRight: 4,
      opacity: disabled ? 0.5 : 1,
    }}>{children}</button>
  );
}
