'use client';
// app/h/[property_id]/marketing/docs/LibraryClient.tsx
// PBS 2026-09-15 · marketing asset library, client side.
// Every row has Preview, Download and Dismiss. Dismiss removes the document from THIS surface only —
// it is not archived and not brain-excluded — and can be undone from the banner that appears.
import { useCallback, useEffect, useState } from 'react';

type Shelf = { shelf: string; label: string; sort_order: number; total: number;
               current_n: number; archived: number; newest_year: number | null; bytes: number };
type Asset = { doc_id: string; shelf: string; title: string | null; file_name: string | null;
               ext: string | null; doc_year: number | null; size_kb: number; status: string;
               folder: string | null; copies: number; preview_url: string; download_url: string };

const mute: React.CSSProperties = { opacity: 0.6 };
const row: React.CSSProperties = {
  display: 'flex', justifyContent: 'space-between', gap: 12, padding: '6px 0',
  borderBottom: '1px solid var(--hair, #E6DFCC)', fontSize: 12.5,
};
const pill: React.CSSProperties = {
  fontSize: 10.5, padding: '1px 6px', borderRadius: 4, border: '1px solid var(--hair, #E6DFCC)',
  color: 'var(--ink-mute, #5A5A5A)', textTransform: 'uppercase', letterSpacing: '0.04em',
  textDecoration: 'none', whiteSpace: 'nowrap',
};
const btn: React.CSSProperties = { ...pill, cursor: 'pointer', background: 'var(--paper, #FFFFFF)' };

function size(kb: number) { return kb >= 1024 ? `${Math.round(kb / 1024)} MB` : `${kb} kB`; }
function vol(bytes: number) {
  if (!bytes) return '—';
  return bytes >= 1048576 ? `${Math.round(bytes / 1048576)} MB` : `${Math.round(bytes / 1024)} kB`;
}

export default function LibraryClient({ propertyId }: { propertyId: number }) {
  const [shelves, setShelves] = useState<Shelf[]>([]);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [undo, setUndo] = useState<{ doc_id: string; title: string } | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/marketing/library?pid=${propertyId}`, { cache: 'no-store' });
      const json = await res.json();
      if (!json.ok) { setError(json.error ?? 'could not load the library'); return; }
      setShelves((json.shelves ?? []) as Shelf[]);
      setAssets((json.assets ?? []) as Asset[]);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'could not load the library');
    } finally { setLoading(false); }
  }, [propertyId]);

  useEffect(() => { void load(); }, [load]);

  async function dismiss(a: Asset) {
    setBusy(a.doc_id);
    try {
      const res = await fetch('/api/marketing/library', {
        method: 'DELETE', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ pid: propertyId, doc_id: a.doc_id, reason: 'dismissed from library' }),
      });
      const json = await res.json();
      if (json.ok) {
        setAssets((prev) => prev.filter((x) => x.doc_id !== a.doc_id));
        setUndo({ doc_id: a.doc_id, title: a.title || a.file_name || a.doc_id.slice(0, 8) });
      } else setError(json.error ?? 'dismiss failed');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'dismiss failed');
    } finally { setBusy(null); }
  }

  async function restore(docId: string) {
    setBusy(docId);
    try {
      const res = await fetch('/api/marketing/library', {
        method: 'PATCH', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ pid: propertyId, doc_id: docId }),
      });
      const json = await res.json();
      if (json.ok) { setUndo(null); await load(); }
      else setError(json.error ?? 'restore failed');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'restore failed');
    } finally { setBusy(null); }
  }

  if (loading) return <div style={{ ...mute, fontSize: 12.5 }}>Loading the library&hellip;</div>;
  if (error && assets.length === 0) return <div style={{ fontSize: 12.5 }}>{error}</div>;

  // Every shelf gets a card. The old hardcoded six silently hid the rest — including
  // Unsorted, which is the one a person most needs to see — and would have hidden any
  // new shelf (SLH, Hilton) the moment SQL started emitting it. fn_marketing_shelves
  // already returns them in sort_order, so the running order is the server's to decide.
  const essentials = shelves;
  const byShelf = new Map<string, Asset[]>();
  for (const a of assets) {
    const list = byShelf.get(a.shelf) ?? []; list.push(a); byShelf.set(a.shelf, list);
  }

  return (
    <div>
      {undo ? (
        <div style={{ ...row, borderBottom: 'none', background: 'var(--sand, #F3EFE2)', padding: '8px 10px', borderRadius: 6 }}>
          <span>Dismissed <strong>{undo.title}</strong> — it stays in the document register.</span>
          <button style={btn} disabled={busy === undo.doc_id} onClick={() => restore(undo.doc_id)}>Undo</button>
        </div>
      ) : null}
      {error ? <div style={{ fontSize: 12, marginBottom: 6 }}>{error}</div> : null}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(190px, 1fr))', gap: 10, marginBottom: 14 }}>
        {essentials.map((s) => (
          <a key={s.shelf} href={`#shelf-${s.shelf}`}
             style={{ border: '1px solid var(--hair, #E6DFCC)', borderRadius: 8, padding: '10px 12px',
                      textDecoration: 'none', color: 'var(--ink, #1B1B1B)', display: 'block' }}>
            <div style={{ fontSize: 13, fontWeight: 600 }}>{s.label}</div>
            <div style={{ ...mute, fontSize: 11.5, marginTop: 2 }}>
              {s.current_n} current{s.archived ? ` · ${s.archived} archived` : ''} · {vol(s.bytes)}
            </div>
          </a>
        ))}
      </div>

      {shelves.map((s) => {
        const items = byShelf.get(s.shelf) ?? [];
        const quiet = s.shelf === 'seo_exports' || s.shelf === 'unsorted';
        return (
          <div key={s.shelf} id={`shelf-${s.shelf}`} style={{ marginBottom: 18 }}>
            <div style={{ fontSize: 13.5, fontWeight: 600 }}>{s.label}</div>
            <div style={{ ...mute, fontSize: 11.5, marginBottom: 4 }}>
              {s.current_n} current{s.archived ? ` · ${s.archived} archived` : ''} · {vol(s.bytes)}
              {s.newest_year ? ` · newest ${s.newest_year}` : ''}
            </div>
            {items.length === 0 ? (
              <div style={{ ...mute, fontSize: 12.5 }}>Nothing on this shelf.</div>
            ) : (
              <details open={!quiet}>
                <summary style={{ cursor: 'pointer', fontSize: 12, ...mute }}>{items.length} files</summary>
                {items.map((a) => (
                  <div key={a.doc_id} style={row}>
                    <div style={{ minWidth: 0, flex: '1 1 auto' }}>
                      <a href={a.preview_url} target="_blank" rel="noreferrer"
                         style={{ textDecoration: 'underline', opacity: a.status === 'archived' ? 0.55 : 1 }}>
                        {a.title || a.file_name || a.doc_id.slice(0, 8)}
                      </a>
                      {a.folder ? <div style={{ ...mute, fontSize: 11 }}>{a.folder}</div> : null}
                    </div>
                    <div style={{ display: 'flex', gap: 6, alignItems: 'center', whiteSpace: 'nowrap' }}>
                      {a.status === 'archived' ? <span style={pill}>archived</span> : null}
                      {a.copies > 1 ? <span style={pill}>{a.copies} copies</span> : null}
                      {a.ext ? <span style={pill}>{a.ext}</span> : null}
                      <span style={{ ...mute, fontSize: 11.5, minWidth: 44, textAlign: 'right' }}>{a.doc_year ?? '—'}</span>
                      <span style={{ ...mute, fontSize: 11.5, minWidth: 58, textAlign: 'right' }}>{size(a.size_kb)}</span>
                      <a style={pill} href={a.preview_url} target="_blank" rel="noreferrer">preview</a>
                      <a style={pill} href={a.download_url}>download</a>
                      <button style={btn} disabled={busy === a.doc_id} onClick={() => dismiss(a)}>
                        {busy === a.doc_id ? '…' : 'dismiss'}
                      </button>
                    </div>
                  </div>
                ))}
              </details>
            )}
          </div>
        );
      })}
    </div>
  );
}
