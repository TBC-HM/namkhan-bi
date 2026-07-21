'use client';
// app/guest/newsletters/templates/link-catalog/_components/LinkCatalogClient.tsx
// PBS 2026-07-21 · Manage internal link catalog CRUD + website scrape button.

import { useCallback, useState, useTransition } from 'react';

const WHITE = '#FFFFFF';
const HAIR  = '#E6DFCC';
const INK   = '#1B1B1B';
const INK_S = '#5A5A5A';
const BRAND = '#084838';
const RED   = '#B03826';
const WARM  = '#F5F0E1';

export interface LinkRow {
  id: number;
  property_id: number;
  url: string;
  title: string | null;
  anchor_hint: string | null;
  section: string | null;
  description: string | null;
  active: boolean;
  is_pinned: boolean;
  last_verified_at: string | null;
  created_at: string;
  created_by: string | null;
}

interface Props {
  propertyId: number;
  initialRows: LinkRow[];
}

const SECTIONS = ['landing','retreat','spa','editorial','booking','accommodation','dining','experience','legal'];

export default function LinkCatalogClient({ propertyId, initialRows }: Props) {
  const [rows, setRows]         = useState<LinkRow[]>(initialRows);
  const [editing, setEditing]   = useState<LinkRow | null>(null);
  const [creatingNew, setCreatingNew] = useState(false);
  const [scrapeUrl, setScrapeUrl]     = useState('https://www.thenamkhan.com');
  const [scrapeBusy, setScrapeBusy]   = useState(false);
  const [msg, setMsg]           = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, startTransition] = useTransition();

  const refresh = useCallback(async () => {
    const r = await fetch('/api/marketing/link-catalog/upsert', { cache: 'no-store' });
    const j = await r.json();
    if (j?.ok && Array.isArray(j.rows)) setRows(j.rows);
  }, []);

  const onNew = () => {
    setEditing({
      id: 0, property_id: propertyId, url: '', title: '', anchor_hint: '',
      section: 'landing', description: '', active: true, is_pinned: false,
      last_verified_at: null, created_at: '', created_by: 'pbsbase@gmail.com',
    });
    setCreatingNew(true);
  };

  const onDelete = (r: LinkRow) => {
    if (r.is_pinned) { setMsg({ ok: false, text: 'Cannot delete pinned link.' }); return; }
    if (!confirm(`Delete "${r.title ?? r.url}"?`)) return;
    startTransition(async () => {
      const res = await fetch('/api/marketing/link-catalog/delete', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ id: r.id }),
      });
      const j = await res.json();
      if (j?.ok) { setMsg({ ok: true, text: 'Deleted' }); await refresh(); }
      else setMsg({ ok: false, text: j?.error ?? 'delete_failed' });
    });
  };

  const runScrape = () => {
    if (!scrapeUrl.trim()) { setMsg({ ok: false, text: 'Base URL required' }); return; }
    setScrapeBusy(true);
    (async () => {
      try {
        const r = await fetch('/api/marketing/link-catalog/scrape-website', {
          method: 'POST', headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ property_id: propertyId, base_url: scrapeUrl.trim() }),
        });
        const j = await r.json();
        if (j?.ok) {
          setMsg({ ok: true, text: `Discovered ${j.discovered ?? '?'} · inserted ${j.inserted ?? 0} · updated ${j.updated ?? 0} · skipped ${j.skipped ?? 0}` });
          await refresh();
        } else setMsg({ ok: false, text: j?.error ?? 'scrape_failed' });
      } finally { setScrapeBusy(false); }
    })();
  };

  return (
    <div style={{ background: WHITE, border: `1px solid ${HAIR}`, borderRadius: 4, padding: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 600, color: INK }}>Internal link catalog</div>
          <div style={{ fontSize: 11, color: INK_S }}>{rows.length} links · pinned rows are protected from delete and from scraper overwrites.</div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <input value={scrapeUrl} onChange={(e) => setScrapeUrl(e.target.value)} placeholder="https://www.thenamkhan.com" style={{ ...inputStyle, width: 260 }} />
          <button onClick={runScrape} disabled={scrapeBusy} style={secondaryBtn}>{scrapeBusy ? 'Scraping…' : 'Scrape website'}</button>
          <button onClick={onNew} style={primaryBtn}>+ New link</button>
        </div>
      </div>

      {msg && (
        <div style={{
          padding: 8, marginBottom: 12, borderRadius: 3, fontSize: 12,
          background: msg.ok ? '#EEF7F0' : '#FBEDE7', color: msg.ok ? BRAND : RED,
          border: `1px solid ${msg.ok ? BRAND : RED}`,
        }}>{msg.text}</div>
      )}

      <div style={{ overflow: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <thead>
            <tr style={{ background: '#FAFAF7', borderBottom: `1px solid ${HAIR}` }}>
              <th style={th}>Title</th>
              <th style={th}>Section</th>
              <th style={th}>URL</th>
              <th style={th}>Pinned</th>
              <th style={th}>Active</th>
              <th style={th}>Verified</th>
              <th style={{ ...th, textAlign: 'right', width: 200 }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr><td colSpan={7} style={{ padding: 24, textAlign: 'center', color: INK_S }}>No links yet. Add one or scrape the website.</td></tr>
            ) : rows.map((r) => (
              <tr key={r.id} style={{ borderBottom: `1px solid ${HAIR}`, opacity: r.active ? 1 : 0.6 }}>
                <td style={{ ...td, fontWeight: 600 }}>
                  {r.title ?? '—'}
                  {r.description && <div style={{ fontSize: 10, color: INK_S, marginTop: 2 }}>{r.description.slice(0, 140)}</div>}
                </td>
                <td style={td}><span style={sectionBadge}>{r.section ?? 'landing'}</span></td>
                <td style={{ ...td, fontFamily: 'ui-monospace, SFMono-Regular, monospace', fontSize: 10, color: INK_S, maxWidth: 300, wordBreak: 'break-all' }}>{r.url}</td>
                <td style={td}>{r.is_pinned ? 'YES' : ''}</td>
                <td style={td}>{r.active ? 'YES' : 'NO'}</td>
                <td style={{ ...td, color: INK_S, fontSize: 11 }}>{r.last_verified_at ? new Date(r.last_verified_at).toLocaleDateString('en-GB', { day:'2-digit', month:'short' }) : '—'}</td>
                <td style={{ ...td, textAlign: 'right' }}>
                  <button onClick={() => { setEditing(r); setCreatingNew(false); }} style={actionBtn}>Edit</button>
                  <button onClick={() => onDelete(r)} disabled={r.is_pinned || busy} style={{ ...actionBtn, color: r.is_pinned ? INK_S : RED, borderColor: r.is_pinned ? HAIR : RED, cursor: r.is_pinned ? 'not-allowed' : 'pointer' }}>Delete</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {editing && (
        <EditDrawer
          row={editing}
          isNew={creatingNew}
          onClose={() => { setEditing(null); setCreatingNew(false); }}
          onSaved={async () => { setEditing(null); setCreatingNew(false); await refresh(); }}
          onMsg={setMsg}
        />
      )}
    </div>
  );
}

function EditDrawer({
  row, isNew, onClose, onSaved, onMsg,
}: {
  row: LinkRow; isNew: boolean;
  onClose: () => void; onSaved: () => Promise<void>;
  onMsg: (m: { ok: boolean; text: string }) => void;
}) {
  const [url, setUrl]           = useState(row.url);
  const [title, setTitle]       = useState(row.title ?? '');
  const [anchor, setAnchor]     = useState(row.anchor_hint ?? '');
  const [section, setSection]   = useState(row.section ?? 'landing');
  const [description, setDesc]  = useState(row.description ?? '');
  const [active, setActive]     = useState(row.active);
  const [isPinned, setIsPinned] = useState(row.is_pinned);
  const [saving, setSaving]     = useState(false);

  const onSave = async () => {
    if (!url.trim()) { onMsg({ ok: false, text: 'url required' }); return; }
    setSaving(true);
    try {
      const res = await fetch('/api/marketing/link-catalog/upsert', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          id: isNew ? undefined : row.id,
          property_id: row.property_id,
          url: url.trim(), title, anchor_hint: anchor, section, description,
          active, is_pinned: isPinned,
        }),
      });
      const j = await res.json();
      if (j?.ok) { onMsg({ ok: true, text: isNew ? 'Link created' : 'Link saved' }); await onSaved(); }
      else onMsg({ ok: false, text: j?.error ?? 'save_failed' });
    } finally { setSaving(false); }
  };

  return (
    <div style={backdropStyle} onClick={onClose}>
      <div style={drawerStyle} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: INK }}>{isNew ? 'New link' : `Edit link #${row.id}`}</div>
          <button onClick={onClose} style={closeBtn}>×</button>
        </div>
        <div style={{ display: 'grid', gap: 10 }}>
          <Field label="URL"><input value={url} onChange={(e) => setUrl(e.target.value)} style={{ ...inputStyle, fontFamily: 'ui-monospace, SFMono-Regular, monospace' }} /></Field>
          <Field label="Title (shown to composer)"><input value={title} onChange={(e) => setTitle(e.target.value)} style={inputStyle} /></Field>
          <Field label="Anchor hint (suggested link text)"><input value={anchor} onChange={(e) => setAnchor(e.target.value)} style={inputStyle} /></Field>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <Field label="Section">
              <select value={section} onChange={(e) => setSection(e.target.value)} style={selectStyle}>
                {SECTIONS.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </Field>
            <Field label="Active">
              <select value={active ? '1' : '0'} onChange={(e) => setActive(e.target.value === '1')} style={selectStyle}>
                <option value="1">Yes</option><option value="0">No</option>
              </select>
            </Field>
          </div>
          <Field label="Description"><textarea value={description} onChange={(e) => setDesc(e.target.value)} rows={2} style={inputStyle} /></Field>
          <label style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 11, color: INK_S }}>
            <input type="checkbox" checked={isPinned} onChange={(e) => setIsPinned(e.target.checked)} />
            Pinned (protected from delete and from scraper overwrites)
          </label>
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
          <button onClick={onClose} style={secondaryBtn}>Cancel</button>
          <button onClick={onSave} disabled={saving} style={primaryBtn}>{saving ? 'Saving…' : 'Save link'}</button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <span style={{ fontSize: 11, color: INK_S, fontWeight: 500 }}>{label}</span>
      {children}
    </label>
  );
}

// styles
const th: React.CSSProperties = { textAlign: 'left', padding: '8px 10px', fontSize: 11, fontWeight: 600, color: INK_S, textTransform: 'uppercase', letterSpacing: 0.4 };
const td: React.CSSProperties = { padding: '8px 10px', verticalAlign: 'middle', color: INK };
const inputStyle: React.CSSProperties = { width: '100%', padding: '6px 8px', border: `1px solid ${HAIR}`, borderRadius: 3, background: WHITE, color: INK, fontSize: 12, boxSizing: 'border-box', fontFamily: 'inherit' };
const selectStyle: React.CSSProperties = { padding: '4px 6px', border: `1px solid ${HAIR}`, borderRadius: 3, background: WHITE, color: INK, fontSize: 11 };
const primaryBtn: React.CSSProperties = { padding: '6px 12px', background: BRAND, color: WHITE, border: 'none', borderRadius: 3, cursor: 'pointer', fontSize: 12, fontWeight: 600 };
const secondaryBtn: React.CSSProperties = { padding: '6px 10px', background: WHITE, color: INK, border: `1px solid ${HAIR}`, borderRadius: 3, cursor: 'pointer', fontSize: 11 };
const actionBtn: React.CSSProperties = { padding: '4px 8px', background: WHITE, color: INK, border: `1px solid ${HAIR}`, borderRadius: 3, cursor: 'pointer', fontSize: 11, marginLeft: 4 };
const closeBtn: React.CSSProperties = { background: 'transparent', border: 'none', fontSize: 20, cursor: 'pointer', color: INK_S, padding: 0, width: 24, height: 24, lineHeight: '20px' };
const backdropStyle: React.CSSProperties = { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)', zIndex: 100, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', overflowY: 'auto', paddingTop: 40, paddingBottom: 40 };
const drawerStyle: React.CSSProperties = { background: WHITE, border: `1px solid ${HAIR}`, borderRadius: 4, padding: 20, width: '92%', maxWidth: 640, boxShadow: '0 8px 32px rgba(0,0,0,0.15)' };
const sectionBadge: React.CSSProperties = { display: 'inline-block', padding: '2px 8px', borderRadius: 10, background: WARM, color: INK, fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.3 };
