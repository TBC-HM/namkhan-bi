'use client';
// app/marketing/subscribers/_components/SubscribersClient.tsx
// PBS 2026-07-16 — Subscribers directory + import panels + bulk actions.
// Every write goes through /api/marketing/subscribers/* which calls a
// SECURITY DEFINER RPC (fn_subscriber_*). No direct writes from client.
// Paper-white per Namkhan token burn (var(--paper-warm) is DARK).

import { useCallback, useMemo, useState, useTransition } from 'react';

export interface SubscriberRow {
  id: number;
  email: string;
  name: string | null;
  tags: string[] | null;
  source: string;
  opted_in_at: string | null;
  unsubscribed_at: string | null;
  bounced_at: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  is_active: boolean;
}

export interface ScrapeEventRow {
  id: number;
  url: string;
  title: string | null;
  target: 'lead' | 'subscriber';
  tags: string[] | null;
  emails_found: string[] | null;
  summary: string | null;
  lead_id: number | null;
  subscriber_ids: number[] | null;
  created_at: string;
}

export interface GmailContactRow {
  email: string;
  display_name: string | null;
  message_count: number;
  domain: string;
  last_seen_at: string | null;
  is_internal: boolean;
}

type SortKey = 'email' | 'name' | 'source' | 'created_at' | 'updated_at' | 'opted_in_at';

const HAIRLINE = '#E6DFCC';
const INK = '#1B1B1B';
const INK_SOFT = '#5A5A5A';
const BRAND = '#084838';
const RED = '#B04A2F';
const PAPER = '#FFFFFF';
const WARM = '#F5F0E1';

const PAGE_SIZE = 50;

const cellStyle: React.CSSProperties = {
  padding: '6px 8px',
  fontSize: 12,
  color: INK,
  borderBottom: '1px solid ' + HAIRLINE,
  verticalAlign: 'top',
  textAlign: 'left',
};
const headStyle: React.CSSProperties = {
  padding: '8px',
  fontSize: 11,
  fontWeight: 600,
  color: INK_SOFT,
  background: PAPER,
  borderBottom: '1px solid ' + HAIRLINE,
  textAlign: 'left',
  cursor: 'pointer',
  userSelect: 'none',
};
const buttonBase: React.CSSProperties = {
  fontSize: 11,
  padding: '6px 10px',
  borderRadius: 4,
  border: '1px solid ' + HAIRLINE,
  background: PAPER,
  color: INK,
  cursor: 'pointer',
};
const buttonPrimary: React.CSSProperties = {
  ...buttonBase,
  background: BRAND,
  color: PAPER,
  border: '1px solid ' + BRAND,
};
const buttonDanger: React.CSSProperties = {
  ...buttonBase,
  color: RED,
  border: '1px solid ' + RED,
};

function fmtDate(d: string | null): string {
  if (!d) return '—';
  try { return new Date(d).toISOString().slice(0, 10); } catch { return '—'; }
}

function fmtDT(d: string | null): string {
  if (!d) return '—';
  try {
    const dd = new Date(d);
    return dd.toISOString().slice(0, 10) + ' ' + dd.toISOString().slice(11, 16);
  } catch { return '—'; }
}

// Escape a CSV cell.
function csvCell(v: unknown): string {
  const s = v == null ? '' : String(v);
  if (/[",\n]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
  return s;
}

export default function SubscribersClient({
  initialSubscribers,
  gmailCandidates,
  scrapeEvents,
}: {
  initialSubscribers: SubscriberRow[];
  gmailCandidates: GmailContactRow[];
  scrapeEvents: ScrapeEventRow[];
}) {
  const [subs, setSubs] = useState<SubscriberRow[]>(initialSubscribers);
  const [query, setQuery] = useState('');
  const [tagFilter, setTagFilter] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'pending' | 'unsub' | 'bounced'>('all');
  const [sortKey, setSortKey] = useState<SortKey>('created_at');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [page, setPage] = useState(0);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [importOpen, setImportOpen] = useState(false);
  const [tab, setTab] = useState<'gmail' | 'csv' | 'manual' | 'scrape'>('gmail');
  const [busy, startTransition] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const [optInModal, setOptInModal] = useState(false);
  const [optInList, setOptInList] = useState<{id:number; email:string; name:string|null; token:string}[]>([]);

  const allTags = useMemo(() => {
    const c: Record<string, number> = {};
    for (const s of subs) for (const t of s.tags ?? []) c[t] = (c[t] ?? 0) + 1;
    return Object.entries(c).sort((a, b) => b[1] - a[1]);
  }, [subs]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    let rows = subs.slice();
    if (statusFilter === 'active')  rows = rows.filter((r) => !!r.opted_in_at && !r.unsubscribed_at);
    if (statusFilter === 'pending') rows = rows.filter((r) => !r.opted_in_at && !r.unsubscribed_at);
    if (statusFilter === 'unsub')   rows = rows.filter((r) => !!r.unsubscribed_at);
    if (statusFilter === 'bounced') rows = rows.filter((r) => !!r.bounced_at);
    if (tagFilter) rows = rows.filter((r) => (r.tags ?? []).includes(tagFilter));
    if (q) rows = rows.filter((r) =>
      r.email.toLowerCase().includes(q)
      || (r.name ?? '').toLowerCase().includes(q)
      || (r.source ?? '').toLowerCase().includes(q)
      || (r.tags ?? []).some((t) => t.toLowerCase().includes(q))
    );
    rows.sort((a, b) => {
      let av: string | number = ''; let bv: string | number = '';
      const k = sortKey;
      if (k === 'email' || k === 'source') { av = a[k] ?? ''; bv = b[k] ?? ''; }
      else if (k === 'name') { av = a.name ?? ''; bv = b.name ?? ''; }
      else { av = a[k] ?? ''; bv = b[k] ?? ''; }
      if (av < bv) return sortDir === 'asc' ? -1 : 1;
      if (av > bv) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });
    return rows;
  }, [subs, query, tagFilter, statusFilter, sortKey, sortDir]);

  const paged = useMemo(
    () => filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE),
    [filtered, page]
  );
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));

  function toggleSort(k: SortKey) {
    if (k === sortKey) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else { setSortKey(k); setSortDir(k === 'created_at' || k === 'updated_at' || k === 'opted_in_at' ? 'desc' : 'asc'); }
  }

  function toggleRow(id: number) {
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id); else n.add(id);
      return n;
    });
  }
  function toggleAllVisible() {
    const visible = paged.map((r) => r.id);
    const allSel = visible.every((id) => selected.has(id));
    setSelected((s) => {
      const n = new Set(s);
      if (allSel) visible.forEach((id) => n.delete(id));
      else visible.forEach((id) => n.add(id));
      return n;
    });
  }

  // ─── row actions ────────────────────────────────────────────────
  const doUnsub = useCallback(async (id: number) => {
    if (!confirm('Unsubscribe this contact?')) return;
    startTransition(async () => {
      const r = await fetch('/api/marketing/subscribers/update', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ id, action: 'unsubscribe' }),
      });
      const j = await r.json().catch(() => ({}));
      if (j.ok) {
        setSubs((prev) => prev.map((s) => s.id === id ? { ...s, unsubscribed_at: new Date().toISOString(), is_active: false } : s));
      } else {
        setMsg('Unsubscribe failed: ' + (j.error ?? 'unknown'));
      }
    });
  }, []);

  const doSetTags = useCallback(async (id: number, tags: string[]) => {
    startTransition(async () => {
      const r = await fetch('/api/marketing/subscribers/update', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ id, action: 'set_tags', tags }),
      });
      const j = await r.json().catch(() => ({}));
      if (j.ok) setSubs((prev) => prev.map((s) => s.id === id ? { ...s, tags } : s));
      else setMsg('Tag update failed');
    });
  }, []);

  // ─── bulk actions ───────────────────────────────────────────────
  const doBulk = useCallback(async (action: 'delete' | 'add_tag' | 'remove_tag' | 'unsubscribe', tag?: string) => {
    const ids = Array.from(selected);
    if (!ids.length) return;
    if (action === 'delete' && !confirm('Delete ' + ids.length + ' subscribers? This cannot be undone.')) return;
    if (action === 'unsubscribe' && !confirm('Unsubscribe ' + ids.length + ' contacts?')) return;
    startTransition(async () => {
      const r = await fetch('/api/marketing/subscribers/bulk', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ ids, action, tag }),
      });
      const j = await r.json().catch(() => ({}));
      if (!j.ok) { setMsg('Bulk failed: ' + (j.error ?? 'unknown')); return; }
      if (action === 'delete') {
        setSubs((prev) => prev.filter((s) => !selected.has(s.id)));
        setSelected(new Set());
      } else if (action === 'add_tag' && tag) {
        setSubs((prev) => prev.map((s) => selected.has(s.id) ? { ...s, tags: Array.from(new Set([...(s.tags ?? []), tag])) } : s));
      } else if (action === 'remove_tag' && tag) {
        setSubs((prev) => prev.map((s) => selected.has(s.id) ? { ...s, tags: (s.tags ?? []).filter((t) => t !== tag) } : s));
      } else if (action === 'unsubscribe') {
        setSubs((prev) => prev.map((s) => selected.has(s.id) ? { ...s, unsubscribed_at: new Date().toISOString(), is_active: false } : s));
        setSelected(new Set());
      }
      setMsg('Done: ' + j.affected + ' affected');
    });
  }, [selected]);

  function exportSelected() {
    const rows = selected.size > 0 ? subs.filter((s) => selected.has(s.id)) : filtered;
    const headers = ['email','name','tags','source','opted_in_at','unsubscribed_at','bounced_at','created_at','notes'];
    const lines = [headers.join(',')];
    for (const r of rows) {
      lines.push([
        csvCell(r.email), csvCell(r.name), csvCell((r.tags ?? []).join('|')),
        csvCell(r.source), csvCell(r.opted_in_at), csvCell(r.unsubscribed_at),
        csvCell(r.bounced_at), csvCell(r.created_at), csvCell(r.notes),
      ].join(','));
    }
    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'namkhan-subscribers-' + new Date().toISOString().slice(0,10) + '.csv';
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  // ─── opt-in campaign ────────────────────────────────────────────
  async function openOptInModal() {
    const pending = subs.filter((s) => !s.opted_in_at && !s.unsubscribed_at).map((s) => s.id);
    if (!pending.length) { alert('No pending subscribers to confirm.'); return; }
    const r = await fetch('/api/marketing/subscribers/issue-tokens', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ ids: pending }),
    });
    const j = await r.json().catch(() => ({}));
    if (!j.ok) { alert('Token issue failed: ' + (j.error ?? 'unknown')); return; }
    setOptInList(j.tokens ?? []);
    setOptInModal(true);
  }

  async function sendOptInBatch() {
    if (!optInList.length) return;
    if (!confirm('Send opt-in email to ' + optInList.length + ' contacts via your Gmail?')) return;
    startTransition(async () => {
      const r = await fetch('/api/marketing/subscribers/send-opt-in', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ tokens: optInList }),
      });
      const j = await r.json().catch(() => ({}));
      if (j.ok) {
        setMsg('Sent ' + (j.sent ?? 0) + ' opt-in emails · ' + (j.failed ?? 0) + ' failed');
        setOptInModal(false);
      } else {
        alert('Send failed: ' + (j.error ?? 'unknown'));
      }
    });
  }

  const pendingCount = subs.filter((s) => !s.opted_in_at && !s.unsubscribed_at).length;

  return (
    <div style={{ display: 'grid', gap: 12 }}>
      {msg && (
        <div style={{ padding: '6px 10px', fontSize: 11, color: BRAND, background: PAPER, border: '1px solid ' + HAIRLINE, borderRadius: 4 }}>
          {msg} <button onClick={() => setMsg(null)} style={{ ...buttonBase, marginLeft: 8, padding: '2px 6px' }}>dismiss</button>
        </div>
      )}

      {/* Action bar: search + status + opt-in button + import toggle */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center', background: PAPER, padding: 8, border: '1px solid ' + HAIRLINE, borderRadius: 4 }}>
        <input
          type="search"
          placeholder="search email / name / tag"
          value={query}
          onChange={(e) => { setQuery(e.target.value); setPage(0); }}
          style={{ flex: '1 1 240px', fontSize: 12, padding: '6px 8px', border: '1px solid ' + HAIRLINE, borderRadius: 4, background: PAPER, color: INK }}
        />
        <select
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value as typeof statusFilter); setPage(0); }}
          style={{ fontSize: 12, padding: '6px 8px', border: '1px solid ' + HAIRLINE, borderRadius: 4, background: PAPER, color: INK }}
        >
          <option value="all">All ({subs.length})</option>
          <option value="active">Active ({subs.filter((s) => !!s.opted_in_at && !s.unsubscribed_at).length})</option>
          <option value="pending">Pending ({pendingCount})</option>
          <option value="unsub">Unsubscribed ({subs.filter((s) => !!s.unsubscribed_at).length})</option>
          <option value="bounced">Bounced ({subs.filter((s) => !!s.bounced_at).length})</option>
        </select>
        <button
          onClick={openOptInModal}
          disabled={pendingCount === 0}
          style={{ ...buttonPrimary, opacity: pendingCount === 0 ? 0.5 : 1 }}
        >
          Send opt-in email to {pendingCount} unconfirmed
        </button>
        <button onClick={() => setImportOpen((o) => !o)} style={buttonBase}>
          {importOpen ? 'Close import' : 'Import ▾'}
        </button>
        <a
          href="/marketing/subscribers/bookmarklet"
          style={{ ...buttonBase, textDecoration: 'none' }}
        >
          Bookmarklet
        </a>
      </div>

      {/* Segments panel */}
      {allTags.length > 0 && (
        <div style={{ background: PAPER, padding: 8, border: '1px solid ' + HAIRLINE, borderRadius: 4 }}>
          <div style={{ fontSize: 11, color: INK_SOFT, marginBottom: 6 }}>Segments · click to filter</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            <button
              onClick={() => { setTagFilter(null); setPage(0); }}
              style={{
                ...buttonBase,
                background: tagFilter === null ? BRAND : PAPER,
                color: tagFilter === null ? PAPER : INK,
                border: '1px solid ' + (tagFilter === null ? BRAND : HAIRLINE),
              }}
            >
              all
            </button>
            {allTags.map(([t, c]) => (
              <button
                key={t}
                onClick={() => { setTagFilter(t === tagFilter ? null : t); setPage(0); }}
                style={{
                  ...buttonBase,
                  background: tagFilter === t ? BRAND : PAPER,
                  color: tagFilter === t ? PAPER : INK,
                  border: '1px solid ' + (tagFilter === t ? BRAND : HAIRLINE),
                }}
              >
                {t} · {c}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Import panel */}
      {importOpen && (
        <ImportPanel
          tab={tab} setTab={setTab}
          gmailCandidates={gmailCandidates}
          scrapeEvents={scrapeEvents}
          onImported={(rows) => {
            setSubs((prev) => {
              const byId = new Map(prev.map((r) => [r.id, r]));
              for (const r of rows) byId.set(r.id, r);
              return Array.from(byId.values()).sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
            });
            setMsg('Imported ' + rows.length + ' rows');
          }}
        />
      )}

      {/* Bulk action bar (only when selection) */}
      {selected.size > 0 && (
        <div style={{ display: 'flex', gap: 6, alignItems: 'center', background: WARM, padding: 8, border: '1px solid ' + HAIRLINE, borderRadius: 4, fontSize: 12 }}>
          <strong>{selected.size}</strong> selected
          <BulkTagAction onAdd={(t) => doBulk('add_tag', t)} onRemove={(t) => doBulk('remove_tag', t)} />
          <button onClick={exportSelected} style={buttonBase}>Export CSV</button>
          <button onClick={() => doBulk('unsubscribe')} style={buttonBase}>Unsubscribe</button>
          <button onClick={() => doBulk('delete')} style={buttonDanger}>Delete</button>
          <button onClick={() => setSelected(new Set())} style={{ ...buttonBase, marginLeft: 'auto' }}>Clear</button>
        </div>
      )}

      {/* Table */}
      <div style={{ background: PAPER, border: '1px solid ' + HAIRLINE, borderRadius: 4, overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', background: PAPER }}>
          <thead>
            <tr>
              <th style={{ ...headStyle, width: 30 }}>
                <input type="checkbox"
                  checked={paged.length > 0 && paged.every((r) => selected.has(r.id))}
                  onChange={toggleAllVisible}
                />
              </th>
              <th style={headStyle} onClick={() => toggleSort('email')}>email {sortKey === 'email' ? (sortDir === 'asc' ? '↑' : '↓') : ''}</th>
              <th style={headStyle} onClick={() => toggleSort('name')}>name {sortKey === 'name' ? (sortDir === 'asc' ? '↑' : '↓') : ''}</th>
              <th style={headStyle}>tags</th>
              <th style={headStyle} onClick={() => toggleSort('opted_in_at')}>opted in? {sortKey === 'opted_in_at' ? (sortDir === 'asc' ? '↑' : '↓') : ''}</th>
              <th style={headStyle} onClick={() => toggleSort('source')}>source {sortKey === 'source' ? (sortDir === 'asc' ? '↑' : '↓') : ''}</th>
              <th style={headStyle} onClick={() => toggleSort('created_at')}>added {sortKey === 'created_at' ? (sortDir === 'asc' ? '↑' : '↓') : ''}</th>
              <th style={headStyle} onClick={() => toggleSort('updated_at')}>last activity {sortKey === 'updated_at' ? (sortDir === 'asc' ? '↑' : '↓') : ''}</th>
              <th style={{ ...headStyle, width: 40 }}></th>
            </tr>
          </thead>
          <tbody>
            {paged.map((r) => (
              <SubscriberRowView
                key={r.id}
                row={r}
                selected={selected.has(r.id)}
                onToggle={() => toggleRow(r.id)}
                onUnsub={() => doUnsub(r.id)}
                onSetTags={(tags) => doSetTags(r.id, tags)}
              />
            ))}
            {paged.length === 0 && (
              <tr><td colSpan={9} style={{ ...cellStyle, textAlign: 'center', color: INK_SOFT, padding: 20 }}>
                {subs.length === 0 ? 'No subscribers yet. Use the Import panel above.' : 'No rows match the filters.'}
              </td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div style={{ display: 'flex', gap: 6, alignItems: 'center', justifyContent: 'flex-end', fontSize: 11, color: INK_SOFT }}>
          <span>{filtered.length.toLocaleString()} rows · page {page + 1} of {totalPages}</span>
          <button onClick={() => setPage((p) => Math.max(0, p - 1))} disabled={page === 0} style={buttonBase}>‹ prev</button>
          <button onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1} style={buttonBase}>next ›</button>
        </div>
      )}

      {/* Opt-in modal */}
      {optInModal && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 9999,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <div style={{ background: PAPER, padding: 20, borderRadius: 6, maxWidth: 620, width: '90%', maxHeight: '80vh', overflow: 'auto', border: '1px solid ' + HAIRLINE }}>
            <h3 style={{ margin: '0 0 12px 0', fontSize: 14, color: INK }}>Send opt-in email to {optInList.length} unconfirmed</h3>
            <p style={{ fontSize: 12, color: INK_SOFT, margin: '0 0 12px 0' }}>
              Each recipient will get a personalised email with a one-click magic link to confirm.
              Once they click, <code>opted_in_at</code> is set to now and they become eligible for future campaigns.
              Sender = your connected Gmail account.
            </p>
            <div style={{ maxHeight: 260, overflow: 'auto', border: '1px solid ' + HAIRLINE, borderRadius: 4, marginBottom: 12 }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
                <thead>
                  <tr><th style={headStyle}>email</th><th style={headStyle}>name</th></tr>
                </thead>
                <tbody>
                  {optInList.slice(0, 100).map((t) => (
                    <tr key={t.id}><td style={cellStyle}>{t.email}</td><td style={cellStyle}>{t.name ?? '—'}</td></tr>
                  ))}
                  {optInList.length > 100 && (
                    <tr><td colSpan={2} style={{ ...cellStyle, color: INK_SOFT, textAlign: 'center' }}>… and {optInList.length - 100} more</td></tr>
                  )}
                </tbody>
              </table>
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button onClick={() => setOptInModal(false)} style={buttonBase} disabled={busy}>Cancel</button>
              <button onClick={sendOptInBatch} style={buttonPrimary} disabled={busy}>{busy ? 'Sending…' : 'Send ' + optInList.length + ' emails'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── row view with inline editable tag chips ─────────────────────────
function SubscriberRowView({
  row, selected, onToggle, onUnsub, onSetTags,
}: {
  row: SubscriberRow;
  selected: boolean;
  onToggle: () => void;
  onUnsub: () => void;
  onSetTags: (tags: string[]) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState((row.tags ?? []).join(', '));

  function commit() {
    const arr = draft.split(',').map((s) => s.trim()).filter(Boolean);
    onSetTags(arr);
    setEditing(false);
  }

  const optedIn = !!row.opted_in_at;
  const unsub = !!row.unsubscribed_at;

  return (
    <tr style={{ background: selected ? '#F9F5EA' : PAPER, opacity: unsub ? 0.55 : 1 }}>
      <td style={cellStyle}>
        <input type="checkbox" checked={selected} onChange={onToggle} />
      </td>
      <td style={cellStyle}>
        <div style={{ fontFamily: 'monospace', fontSize: 11 }}>{row.email}</div>
        {row.bounced_at && <div style={{ fontSize: 10, color: RED }}>bounced</div>}
      </td>
      <td style={cellStyle}>{row.name ?? '—'}</td>
      <td style={{ ...cellStyle, minWidth: 160 }}>
        {editing ? (
          <div style={{ display: 'flex', gap: 4 }}>
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') setEditing(false); }}
              autoFocus
              style={{ flex: 1, fontSize: 11, padding: '2px 4px', border: '1px solid ' + HAIRLINE, background: PAPER, color: INK }}
            />
            <button onClick={commit} style={{ ...buttonBase, padding: '2px 6px' }}>✓</button>
          </div>
        ) : (
          <div onClick={() => setEditing(true)} style={{ cursor: 'pointer', minHeight: 18, display: 'flex', flexWrap: 'wrap', gap: 3 }}>
            {(row.tags ?? []).length === 0 && <span style={{ color: INK_SOFT, fontSize: 10 }}>+ add tag</span>}
            {(row.tags ?? []).map((t) => (
              <span key={t} style={{ fontSize: 10, padding: '1px 6px', background: WARM, border: '1px solid ' + HAIRLINE, borderRadius: 10, color: INK }}>{t}</span>
            ))}
          </div>
        )}
      </td>
      <td style={cellStyle}>
        {unsub ? <span style={{ color: INK_SOFT }}>—</span>
          : optedIn ? <span style={{ color: BRAND }}>✓ yes</span>
          : <span style={{ color: RED }}>· pending</span>}
      </td>
      <td style={cellStyle}><span style={{ fontSize: 10, color: INK_SOFT }}>{row.source}</span></td>
      <td style={cellStyle}>{fmtDate(row.created_at)}</td>
      <td style={cellStyle}>{fmtDate(row.updated_at)}</td>
      <td style={cellStyle}>
        {!unsub && (
          <button onClick={onUnsub} title="Unsubscribe" style={{ ...buttonBase, padding: '2px 6px', color: RED, border: '1px solid ' + HAIRLINE }}>×</button>
        )}
      </td>
    </tr>
  );
}

// ─── bulk tag helper ──────────────────────────────────────────────────
function BulkTagAction({
  onAdd, onRemove,
}: { onAdd: (t: string) => void; onRemove: (t: string) => void }) {
  const [t, setT] = useState('');
  return (
    <>
      <input
        placeholder="tag"
        value={t}
        onChange={(e) => setT(e.target.value)}
        style={{ fontSize: 11, padding: '4px 6px', border: '1px solid ' + HAIRLINE, background: PAPER, color: INK, width: 100 }}
      />
      <button onClick={() => { if (t.trim()) { onAdd(t.trim()); setT(''); } }} style={buttonBase}>+ tag</button>
      <button onClick={() => { if (t.trim()) { onRemove(t.trim()); setT(''); } }} style={buttonBase}>− tag</button>
    </>
  );
}

// ─── import panel with 4 tabs ────────────────────────────────────────
function ImportPanel({
  tab, setTab, gmailCandidates, scrapeEvents, onImported,
}: {
  tab: 'gmail' | 'csv' | 'manual' | 'scrape';
  setTab: (t: 'gmail' | 'csv' | 'manual' | 'scrape') => void;
  gmailCandidates: GmailContactRow[];
  scrapeEvents: ScrapeEventRow[];
  onImported: (rows: SubscriberRow[]) => void;
}) {
  const TABS: Array<{ k: 'gmail' | 'csv' | 'manual' | 'scrape'; label: string }> = [
    { k: 'gmail',  label: 'From Gmail contacts' },
    { k: 'csv',    label: 'From CSV' },
    { k: 'manual', label: 'Manual add' },
    { k: 'scrape', label: 'From web scrape' },
  ];

  async function submit(rows: Array<{ email: string; name?: string; tags?: string[] }>, source: string, tags: string[] = []) {
    if (!rows.length) return { ok: false, reason: 'no_rows' };
    const r = await fetch('/api/marketing/subscribers/import', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ rows, source, tags }),
    });
    const j = await r.json().catch(() => ({}));
    if (j.ok) onImported(j.new_rows ?? []);
    return j;
  }

  return (
    <div style={{ background: PAPER, border: '1px solid ' + HAIRLINE, borderRadius: 4 }}>
      <div style={{ display: 'flex', borderBottom: '1px solid ' + HAIRLINE }}>
        {TABS.map((t) => (
          <button
            key={t.k}
            onClick={() => setTab(t.k)}
            style={{
              fontSize: 11, padding: '8px 12px', border: 'none',
              background: tab === t.k ? WARM : PAPER,
              color: tab === t.k ? INK : INK_SOFT,
              borderBottom: tab === t.k ? '2px solid ' + BRAND : 'none',
              cursor: 'pointer',
            }}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div style={{ padding: 12 }}>
        {tab === 'gmail'  && <GmailImportTab candidates={gmailCandidates} submit={submit} />}
        {tab === 'csv'    && <CsvImportTab submit={submit} />}
        {tab === 'manual' && <ManualAddTab submit={submit} />}
        {tab === 'scrape' && <ScrapeListTab events={scrapeEvents} submit={submit} />}
      </div>
    </div>
  );
}

// ─── Gmail import tab ────────────────────────────────────────────
function GmailImportTab({
  candidates, submit,
}: {
  candidates: GmailContactRow[];
  submit: (rows: Array<{email:string;name?:string;tags?:string[]}>, source: string, tags?: string[]) => Promise<{ok?:boolean; error?:string; inserted?:number; updated?:number}>;
}) {
  const [minCount, setMinCount] = useState(2);
  const [domain, setDomain] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const d = domain.trim().toLowerCase();
    return candidates.filter((c) =>
      c.message_count >= minCount
      && (d === '' || c.domain.toLowerCase().includes(d))
    );
  }, [candidates, minCount, domain]);

  async function importSelected() {
    const rows = filtered
      .filter((c) => selected.has(c.email))
      .map((c) => ({ email: c.email, name: c.display_name ?? undefined }));
    if (!rows.length) { setMsg('Select at least one row'); return; }
    setBusy(true);
    const r = await submit(rows, 'gmail_extract', ['from_gmail']);
    setBusy(false);
    if (r.ok) { setMsg(`Imported ${r.inserted ?? 0} new · ${r.updated ?? 0} updated`); setSelected(new Set()); }
    else setMsg('Import failed: ' + (r.error ?? 'unknown'));
  }

  return (
    <div>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8, flexWrap: 'wrap' }}>
        <label style={{ fontSize: 11, color: INK_SOFT }}>min messages
          <input type="number" min={1} value={minCount} onChange={(e) => setMinCount(Number(e.target.value) || 1)}
            style={{ fontSize: 11, padding: '4px 6px', marginLeft: 4, width: 60, border: '1px solid ' + HAIRLINE, background: PAPER, color: INK }} />
        </label>
        <label style={{ fontSize: 11, color: INK_SOFT }}>domain contains
          <input value={domain} onChange={(e) => setDomain(e.target.value)}
            style={{ fontSize: 11, padding: '4px 6px', marginLeft: 4, width: 140, border: '1px solid ' + HAIRLINE, background: PAPER, color: INK }} />
        </label>
        <button onClick={() => setSelected(new Set(filtered.map((c) => c.email)))} style={buttonBase}>select all ({filtered.length})</button>
        <button onClick={() => setSelected(new Set())} style={buttonBase}>clear</button>
        <button onClick={importSelected} disabled={busy || selected.size === 0} style={buttonPrimary}>
          {busy ? 'Importing…' : 'Import ' + selected.size + ' selected'}
        </button>
      </div>
      {msg && <div style={{ fontSize: 11, color: BRAND, marginBottom: 8 }}>{msg}</div>}
      <div style={{ maxHeight: 320, overflow: 'auto', border: '1px solid ' + HAIRLINE, borderRadius: 4 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11, background: PAPER }}>
          <thead>
            <tr>
              <th style={{ ...headStyle, width: 30 }}></th>
              <th style={headStyle}>email</th>
              <th style={headStyle}>name</th>
              <th style={headStyle}>domain</th>
              <th style={headStyle}>msgs</th>
              <th style={headStyle}>last seen</th>
            </tr>
          </thead>
          <tbody>
            {filtered.slice(0, 200).map((c) => (
              <tr key={c.email}>
                <td style={cellStyle}>
                  <input type="checkbox" checked={selected.has(c.email)} onChange={() => {
                    setSelected((s) => { const n = new Set(s); if (n.has(c.email)) n.delete(c.email); else n.add(c.email); return n; });
                  }} />
                </td>
                <td style={cellStyle}><span style={{ fontFamily: 'monospace' }}>{c.email}</span></td>
                <td style={cellStyle}>{c.display_name ?? '—'}</td>
                <td style={cellStyle}>{c.domain}</td>
                <td style={cellStyle}>{c.message_count}</td>
                <td style={cellStyle}>{fmtDate(c.last_seen_at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── CSV import tab ──────────────────────────────────────────────
function CsvImportTab({ submit }: { submit: (rows: Array<{email:string;name?:string;tags?:string[]}>, source: string) => Promise<{ok?:boolean; error?:string; inserted?:number; updated?:number}>; }) {
  const [text, setText] = useState('');
  const [preview, setPreview] = useState<Array<{email:string;name?:string;tags?:string[]}>>([]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  function parse() {
    const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    if (!lines.length) { setPreview([]); return; }
    const header = lines[0].toLowerCase().split(',').map((s) => s.trim());
    const emailIdx = header.indexOf('email');
    const nameIdx  = header.indexOf('name');
    const tagsIdx  = header.indexOf('tags');
    const start = emailIdx >= 0 ? 1 : 0;
    const rows: Array<{email:string;name?:string;tags?:string[]}> = [];
    for (let i = start; i < lines.length; i++) {
      const cols = lines[i].split(',').map((s) => s.trim());
      const email = emailIdx >= 0 ? cols[emailIdx] : cols[0];
      if (!email || !email.includes('@')) continue;
      const name = nameIdx >= 0 ? cols[nameIdx] : undefined;
      const tags = tagsIdx >= 0 && cols[tagsIdx] ? cols[tagsIdx].split('|').map((s) => s.trim()).filter(Boolean) : undefined;
      rows.push({ email, name, tags });
    }
    setPreview(rows);
  }

  async function fileChosen(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    const t = await f.text();
    setText(t);
  }

  async function commit() {
    if (!preview.length) return;
    setBusy(true);
    const r = await submit(preview, 'csv_upload');
    setBusy(false);
    if (r.ok) { setMsg(`Imported ${r.inserted ?? 0} new · ${r.updated ?? 0} updated`); setPreview([]); setText(''); }
    else setMsg('Import failed: ' + (r.error ?? 'unknown'));
  }

  return (
    <div>
      <div style={{ fontSize: 11, color: INK_SOFT, marginBottom: 6 }}>
        Header row: <code>email,name,tags</code> · tags pipe-separated (e.g. <code>vip|dmc</code>).
      </div>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="email,name,tags&#10;jane@company.com,Jane Doe,vip"
        rows={6}
        style={{ width: '100%', fontFamily: 'monospace', fontSize: 11, padding: 8, border: '1px solid ' + HAIRLINE, borderRadius: 4, background: PAPER, color: INK, resize: 'vertical' }}
      />
      <div style={{ display: 'flex', gap: 8, marginTop: 6, alignItems: 'center' }}>
        <input type="file" accept=".csv,text/csv" onChange={fileChosen} style={{ fontSize: 11 }} />
        <button onClick={parse} style={buttonBase}>Preview</button>
        <button onClick={commit} disabled={busy || preview.length === 0} style={buttonPrimary}>{busy ? 'Importing…' : 'Import ' + preview.length + ' rows'}</button>
      </div>
      {msg && <div style={{ fontSize: 11, color: BRAND, marginTop: 6 }}>{msg}</div>}
      {preview.length > 0 && (
        <div style={{ marginTop: 8, maxHeight: 200, overflow: 'auto', border: '1px solid ' + HAIRLINE, borderRadius: 4 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
            <thead>
              <tr><th style={headStyle}>email</th><th style={headStyle}>name</th><th style={headStyle}>tags</th></tr>
            </thead>
            <tbody>
              {preview.slice(0, 50).map((r, i) => (
                <tr key={i}><td style={cellStyle}>{r.email}</td><td style={cellStyle}>{r.name ?? '—'}</td><td style={cellStyle}>{(r.tags ?? []).join(', ')}</td></tr>
              ))}
              {preview.length > 50 && <tr><td colSpan={3} style={{ ...cellStyle, color: INK_SOFT, textAlign: 'center' }}>… {preview.length - 50} more</td></tr>}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─── Manual add tab ───────────────────────────────────────────────
function ManualAddTab({ submit }: { submit: (rows: Array<{email:string;name?:string;tags?:string[]}>, source: string) => Promise<{ok?:boolean; error?:string; inserted?:number; updated?:number}>; }) {
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [tags, setTags] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function add() {
    if (!email || !email.includes('@')) { setMsg('valid email required'); return; }
    setBusy(true);
    const r = await submit([{ email: email.trim(), name: name.trim() || undefined, tags: tags.split(',').map((s) => s.trim()).filter(Boolean) }], 'manual');
    setBusy(false);
    if (r.ok) { setMsg('Added.'); setEmail(''); setName(''); setTags(''); }
    else setMsg('Failed: ' + (r.error ?? 'unknown'));
  }

  const input: React.CSSProperties = { fontSize: 12, padding: '6px 8px', border: '1px solid ' + HAIRLINE, borderRadius: 4, background: PAPER, color: INK, width: '100%' };

  return (
    <div style={{ display: 'grid', gap: 8, maxWidth: 480 }}>
      <label style={{ fontSize: 11, color: INK_SOFT }}>email
        <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="jane@company.com" style={input} />
      </label>
      <label style={{ fontSize: 11, color: INK_SOFT }}>name
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Jane Doe" style={input} />
      </label>
      <label style={{ fontSize: 11, color: INK_SOFT }}>tags · comma-separated
        <input value={tags} onChange={(e) => setTags(e.target.value)} placeholder="vip, wedding" style={input} />
      </label>
      <div>
        <button onClick={add} disabled={busy} style={buttonPrimary}>{busy ? 'Adding…' : 'Add subscriber'}</button>
      </div>
      {msg && <div style={{ fontSize: 11, color: BRAND }}>{msg}</div>}
    </div>
  );
}

// ─── Web scrape list tab ──────────────────────────────────────────
function ScrapeListTab({
  events, submit,
}: {
  events: ScrapeEventRow[];
  submit: (rows: Array<{email:string;name?:string;tags?:string[]}>, source: string, tags?: string[]) => Promise<{ok?:boolean; error?:string; inserted?:number; updated?:number}>;
}) {
  const [msg, setMsg] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);

  async function importAll(ev: ScrapeEventRow) {
    if (!ev.emails_found?.length) return;
    setBusyId(ev.id);
    const rows = ev.emails_found.map((e) => ({ email: e }));
    const tags = ['from_scrape', ...(ev.tags ?? [])];
    const r = await submit(rows, 'web_scrape', tags);
    setBusyId(null);
    if (r.ok) setMsg(`Imported ${r.inserted ?? 0} new · ${r.updated ?? 0} updated from ${ev.title ?? ev.url}`);
    else setMsg('Import failed: ' + (r.error ?? 'unknown'));
  }

  if (!events.length) {
    return (
      <div style={{ fontSize: 12, color: INK_SOFT, padding: 8 }}>
        No web scrapes yet. Install the <a href="/marketing/subscribers/bookmarklet" style={{ color: BRAND }}>bookmarklet</a> to capture contacts from any site.
      </div>
    );
  }

  return (
    <div>
      {msg && <div style={{ fontSize: 11, color: BRAND, marginBottom: 8 }}>{msg}</div>}
      <div style={{ display: 'grid', gap: 6 }}>
        {events.map((ev) => (
          <div key={ev.id} style={{ padding: 8, border: '1px solid ' + HAIRLINE, borderRadius: 4, background: PAPER }}>
            <div style={{ display: 'flex', gap: 8, alignItems: 'baseline' }}>
              <a href={ev.url} target="_blank" rel="noreferrer" style={{ fontSize: 12, color: BRAND, fontWeight: 600, textDecoration: 'none', flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {ev.title ?? ev.url}
              </a>
              <span style={{ fontSize: 10, color: INK_SOFT }}>{fmtDT(ev.created_at)}</span>
              <span style={{ fontSize: 10, padding: '1px 6px', background: WARM, border: '1px solid ' + HAIRLINE, borderRadius: 10 }}>
                {ev.target}
              </span>
            </div>
            {ev.summary && <div style={{ fontSize: 11, color: INK_SOFT, marginTop: 4 }}>{ev.summary}</div>}
            <div style={{ display: 'flex', gap: 4, alignItems: 'center', marginTop: 6, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 10, color: INK_SOFT }}>{ev.emails_found?.length ?? 0} emails:</span>
              {(ev.emails_found ?? []).slice(0, 6).map((e) => (
                <span key={e} style={{ fontFamily: 'monospace', fontSize: 10, padding: '1px 4px', background: WARM, borderRadius: 2 }}>{e}</span>
              ))}
              {(ev.emails_found?.length ?? 0) > 6 && (
                <span style={{ fontSize: 10, color: INK_SOFT }}>+ {(ev.emails_found?.length ?? 0) - 6} more</span>
              )}
            </div>
            {(ev.emails_found?.length ?? 0) > 0 && (
              <button
                onClick={() => importAll(ev)}
                disabled={busyId === ev.id}
                style={{ ...buttonBase, marginTop: 6 }}
              >
                {busyId === ev.id ? 'Importing…' : `Add all ${ev.emails_found?.length ?? 0} to subscribers`}
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
