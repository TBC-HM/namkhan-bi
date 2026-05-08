'use client';

// components/nav/NDButton.tsx
// New-Deployments button for the top bar.
// Polls /api/cockpit/deployments-feed every 30s, opens a dropdown of recent
// deployments + completed tickets, with per-row Approve / Comment / Delete.
// Dismiss-all + New buttons up top. Restored 2026-05-08 after working tree
// rollback dropped the original.

import { useEffect, useState, useCallback } from 'react';

interface FeedRow {
  id: number;
  kind: string;
  title: string;
  url?: string | null;
  branch?: string | null;
  pr_number?: number | null;
  ticket_id?: number | null;
  is_new: boolean;
  created_at?: string;
  age_label?: string;
}

const FLASH_KEYFRAMES = `
@keyframes nd-flash {
  0%,49% { opacity: 1; }
  50%,100% { opacity: 0.35; }
}`;

export default function NDButton() {
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<FeedRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [composeOpen, setComposeOpen] = useState(false);
  const [composeText, setComposeText] = useState('');

  const refresh = useCallback(async () => {
    try {
      setLoading(true);
      const r = await fetch('/api/cockpit/deployments-feed?limit=30', { cache: 'no-store' });
      const j = await r.json();
      setRows(Array.isArray(j?.items) ? j.items : (Array.isArray(j) ? j : []));
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    refresh();
    const t = setInterval(refresh, 30_000);
    return () => clearInterval(t);
  }, [refresh]);

  const newCount = rows.filter((r) => r.is_new).length;

  async function approve(r: FeedRow) {
    const body = { id: r.id, pr_number: r.pr_number ?? null, ticket_id: r.ticket_id ?? null };
    setRows((rs) => rs.filter((x) => x.id !== r.id)); // optimistic
    try { await fetch('/api/cockpit/deployments/approve', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }); }
    catch { refresh(); }
  }
  async function comment(r: FeedRow) {
    const body = prompt('Comment:');
    if (!body) return;
    setRows((rs) => rs.filter((x) => x.id !== r.id));
    try {
      await fetch('/api/cockpit/deployments/comment', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: r.id, pr_number: r.pr_number ?? null, ticket_id: r.ticket_id ?? null, body }),
      });
    } catch { refresh(); }
  }
  async function del(r: FeedRow) {
    if (!confirm('Delete this notification (and close PR if any)?')) return;
    setRows((rs) => rs.filter((x) => x.id !== r.id));
    try {
      await fetch('/api/cockpit/deployments/delete', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: r.id, pr_number: r.pr_number ?? null }),
      });
    } catch { refresh(); }
  }
  async function dismissAll() {
    setRows([]);
    try { await fetch('/api/cockpit/deployments/dismiss-all', { method: 'POST' }); }
    catch { refresh(); }
  }
  async function postNew() {
    const text = composeText.trim();
    if (!text) return;
    setComposeText('');
    setComposeOpen(false);
    try {
      await fetch('/api/cockpit/deployments/new', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      });
    } catch { /* ignore */ }
    refresh();
  }

  return (
    <div style={{ position: 'relative' }}>
      <style dangerouslySetInnerHTML={{ __html: FLASH_KEYFRAMES }} />
      <button
        onClick={() => setOpen((o) => !o)}
        style={{
          position: 'relative',
          padding: '6px 12px',
          background: 'rgba(255,255,255,0.06)',
          color: '#fff',
          border: '1.5px solid rgba(255,255,255,0.7)',
          borderRadius: 4,
          fontSize: 12,
          letterSpacing: '0.16em',
          fontFamily: 'Menlo, monospace',
          textTransform: 'uppercase',
          cursor: 'pointer',
        }}
        title="New deployments"
      >
        ND
        {newCount > 0 && (
          <span
            style={{
              position: 'absolute',
              top: -4, right: -4,
              minWidth: 16, height: 16,
              padding: '0 4px',
              background: '#a8854a',
              color: '#fff',
              fontSize: 10,
              borderRadius: 8,
              animation: 'nd-flash 0.9s linear infinite',
              fontFamily: 'Menlo, monospace',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              lineHeight: 1,
            }}
          >
            {newCount}
          </span>
        )}
      </button>

      {open && (
        <div
          style={{
            position: 'absolute',
            right: 0, top: 'calc(100% + 8px)',
            width: 460, maxHeight: 540, overflowY: 'auto',
            background: '#0e0e0c',
            border: '1px solid rgba(168,133,74,0.4)',
            borderRadius: 6,
            padding: 10,
            zIndex: 9999,
            boxShadow: '0 12px 40px rgba(0,0,0,0.5)',
            color: '#f5efe3',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <div style={{ fontSize: 11, letterSpacing: '0.16em', textTransform: 'uppercase', color: '#a8854a', fontFamily: 'Menlo, monospace' }}>
              NEW DEPLOYMENTS · {rows.length}
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              <button onClick={() => setComposeOpen((o) => !o)} style={btnStyle()}>+ New</button>
              <button onClick={dismissAll} style={btnStyle()}>✕ Dismiss all</button>
              <button onClick={refresh} style={btnStyle()} disabled={loading}>↻</button>
            </div>
          </div>

          {composeOpen && (
            <div style={{ marginBottom: 10, padding: 8, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(168,133,74,0.25)', borderRadius: 4 }}>
              <textarea
                value={composeText}
                onChange={(e) => setComposeText(e.target.value)}
                placeholder="Describe what you want shipped…"
                rows={3}
                style={{ width: '100%', background: '#000', color: '#f5efe3', border: '1px solid #444', borderRadius: 3, padding: 6, fontFamily: 'inherit', fontSize: 13, resize: 'vertical' }}
              />
              <div style={{ display: 'flex', gap: 6, marginTop: 6, justifyContent: 'flex-end' }}>
                <button onClick={() => setComposeOpen(false)} style={btnStyle()}>Cancel</button>
                <button onClick={postNew} style={{ ...btnStyle(), background: '#a8854a', color: '#000' }}>Send</button>
              </div>
            </div>
          )}

          {rows.length === 0 && !loading && (
            <div style={{ fontSize: 13, color: '#888', padding: '20px 8px', textAlign: 'center' }}>
              All quiet.
            </div>
          )}

          {rows.map((r) => (
            <div
              key={r.id}
              style={{
                padding: 10,
                marginBottom: 6,
                background: r.is_new ? 'rgba(168,133,74,0.08)' : 'rgba(255,255,255,0.02)',
                border: '1px solid rgba(168,133,74,0.18)',
                borderRadius: 4,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, color: '#f5efe3', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {r.is_new && <span style={{ color: '#a8854a', fontWeight: 700, marginRight: 6, animation: 'nd-flash 0.9s linear infinite' }}>NEW</span>}
                    {r.title}
                  </div>
                  <div style={{ fontSize: 10, color: '#888', fontFamily: 'Menlo, monospace', marginTop: 2 }}>
                    {[r.kind, r.branch, r.pr_number ? `PR #${r.pr_number}` : null, r.ticket_id ? `Ticket #${r.ticket_id}` : null, r.age_label]
                      .filter(Boolean).join(' · ')}
                  </div>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 4, marginTop: 6, flexWrap: 'wrap' }}>
                {r.url && <a href={r.url} target="_blank" rel="noreferrer" style={{ ...btnStyle(), textDecoration: 'none' }}>Open</a>}
                {r.ticket_id && <a href={`/cockpit/tasks/${r.ticket_id}`} style={{ ...btnStyle(), textDecoration: 'none' }}>Ticket</a>}
                <button onClick={() => approve(r)} style={btnStyle()}>Approve</button>
                <button onClick={() => comment(r)} style={btnStyle()}>Comment</button>
                <button onClick={() => del(r)} style={{ ...btnStyle(), color: '#c25' }}>Delete</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function btnStyle(): React.CSSProperties {
  return {
    padding: '4px 8px',
    background: 'rgba(255,255,255,0.06)',
    color: '#f5efe3',
    border: '1px solid rgba(168,133,74,0.4)',
    borderRadius: 3,
    fontSize: 11,
    fontFamily: 'Menlo, monospace',
    cursor: 'pointer',
  };
}
