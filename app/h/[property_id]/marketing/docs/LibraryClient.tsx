'use client';
// app/h/[property_id]/marketing/docs/LibraryClient.tsx
// Marketing asset library, client side.
//
// PBS 2026-09-15: "this page UI makes no sense, better make dropdowns on top, this endless
// scrolling is inefficient". The first version rendered EVERY shelf inline, one after another —
// 23 shelves and 278 files meant scrolling past everything to reach anything. This version is a
// filter bar over ONE flat table: pick a shelf, a year, a file type, or type a name.
//
// Theme: property-scoped pages must use the --tbl-* tokens. The previous version used --hair /
// --ink / --paper / --sand, which fall through to Namkhan globals and render black-on-black on
// Donna's cream palette (.claude/rules/frontend.md).
import { useCallback, useEffect, useMemo, useState } from 'react';

type Shelf = { shelf: string; label: string; sort_order: number; total: number;
               current_n: number; archived: number; newest_year: number | null; bytes: number };
type Asset = { doc_id: string; shelf: string; title: string | null; file_name: string | null;
               ext: string | null; doc_year: number | null; size_kb: number; status: string;
               folder: string | null; copies: number;
               created_at: string | null; updated_at: string | null;
               preview_url: string; download_url: string };

type SortKey = 'title' | 'ext' | 'doc_year' | 'created_at' | 'updated_at' | 'size_kb';

const BORDER = '1px solid var(--tbl-border, #E6DFCC)';
const mute: React.CSSProperties = { color: 'var(--tbl-fg-mute, #5A5A5A)' };
const pill: React.CSSProperties = {
  fontSize: 10.5, padding: '1px 6px', borderRadius: 4, border: BORDER,
  color: 'var(--tbl-fg-mute, #5A5A5A)', textTransform: 'uppercase', letterSpacing: '0.04em',
  textDecoration: 'none', whiteSpace: 'nowrap', display: 'inline-block',
};
const btn: React.CSSProperties = { ...pill, cursor: 'pointer', background: 'var(--tbl-bg-elev, #FFFFFF)' };
const field: React.CSSProperties = {
  fontSize: 12.5, padding: '5px 8px', borderRadius: 5, border: BORDER,
  background: 'var(--tbl-bg-elev, #FFFFFF)', color: 'var(--tbl-fg, #1B1B1B)', fontFamily: 'inherit',
};
const th: React.CSSProperties = {
  textAlign: 'left', padding: '7px 8px', fontSize: 10, fontWeight: 700, letterSpacing: '0.06em',
  textTransform: 'uppercase', color: 'var(--tbl-fg-mute, #5A5A5A)',
  borderBottom: '1px solid var(--tbl-border-strong, #D8CFB4)', whiteSpace: 'nowrap', cursor: 'pointer',
};
const td: React.CSSProperties = {
  padding: '7px 8px', fontSize: 12.5, borderBottom: BORDER,
  color: 'var(--tbl-fg, #1B1B1B)', verticalAlign: 'top',
};

function size(kb: number) { return kb >= 1024 ? `${Math.round(kb / 1024)} MB` : `${kb} kB`; }
function vol(bytes: number) {
  if (!bytes) return '—';
  return bytes >= 1048576 ? `${Math.round(bytes / 1048576)} MB` : `${Math.round(bytes / 1024)} kB`;
}
/** ISO date only — deterministic, no locale drift between server and client. */
function day(ts: string | null) { return ts ? ts.slice(0, 10) : '—'; }

export default function LibraryClient({ propertyId }: { propertyId: number }) {
  const [shelves, setShelves] = useState<Shelf[]>([]);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [undo, setUndo] = useState<{ doc_id: string; title: string } | null>(null);

  const [shelf, setShelf] = useState('');
  const [year, setYear] = useState('');
  const [ext, setExt] = useState('');
  const [q, setQ] = useState('');
  const [sort, setSort] = useState<SortKey>('updated_at');
  const [desc, setDesc] = useState(true);

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

  const labelOf = useMemo(() => {
    const m = new Map(shelves.map((s) => [s.shelf, s.label]));
    return (k: string) => m.get(k) ?? k;
  }, [shelves]);

  const years = useMemo(
    () => Array.from(new Set(assets.map((a) => a.doc_year).filter((y): y is number => !!y))).sort((a, b) => b - a),
    [assets]);
  const exts = useMemo(
    () => Array.from(new Set(assets.map((a) => a.ext).filter((e): e is string => !!e))).sort(),
    [assets]);

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const out = assets.filter((a) =>
      (!shelf || a.shelf === shelf) &&
      (!year || String(a.doc_year) === year) &&
      (!ext || a.ext === ext) &&
      (!needle ||
        (a.title ?? '').toLowerCase().includes(needle) ||
        (a.file_name ?? '').toLowerCase().includes(needle) ||
        (a.folder ?? '').toLowerCase().includes(needle)));
    const dir = desc ? -1 : 1;
    return [...out].sort((x, y2) => {
      const av = x[sort] ?? '', bv = y2[sort] ?? '';
      if (av === bv) return (x.title ?? '').localeCompare(y2.title ?? '');
      return av > bv ? dir : -dir;
    });
  }, [assets, shelf, year, ext, q, sort, desc]);

  function head(key: SortKey, text: string, extra?: React.CSSProperties) {
    const on = sort === key;
    return (
      <th style={{ ...th, ...extra, color: on ? 'var(--tbl-fg, #1B1B1B)' : th.color }}
          onClick={() => { if (on) setDesc(!desc); else { setSort(key); setDesc(true); } }}>
        {text}{on ? (desc ? ' ↓' : ' ↑') : ''}
      </th>
    );
  }

  if (loading) return <div style={{ ...mute, fontSize: 12.5 }}>Loading the library&hellip;</div>;
  if (error && assets.length === 0) return <div style={{ fontSize: 12.5 }}>{error}</div>;

  const active = shelves.find((s) => s.shelf === shelf);

  return (
    <div style={{ color: 'var(--tbl-fg, #1B1B1B)' }}>
      {undo ? (
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center',
                      background: 'var(--tbl-bg-elev, #FFFFFF)', border: BORDER, borderRadius: 6,
                      padding: '8px 10px', marginBottom: 10, fontSize: 12.5 }}>
          <span>Dismissed <strong>{undo.title}</strong> — it stays in the document register.</span>
          <button style={btn} disabled={busy === undo.doc_id} onClick={() => restore(undo.doc_id)}>Undo</button>
        </div>
      ) : null}
      {error ? <div style={{ fontSize: 12, marginBottom: 6 }}>{error}</div> : null}

      {/* Filter bar — replaces 23 inline shelf sections. */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginBottom: 10 }}>
        <select style={field} value={shelf} onChange={(e) => setShelf(e.target.value)}>
          <option value="">All shelves ({assets.length})</option>
          {shelves.map((s) => (
            <option key={s.shelf} value={s.shelf}>{s.label} ({s.current_n})</option>
          ))}
        </select>

        <select style={field} value={year} onChange={(e) => setYear(e.target.value)}>
          <option value="">Any year</option>
          {years.map((y) => <option key={y} value={String(y)}>{y}</option>)}
        </select>

        <select style={field} value={ext} onChange={(e) => setExt(e.target.value)}>
          <option value="">Any file type</option>
          {exts.map((x) => <option key={x} value={x}>{x.toUpperCase()}</option>)}
        </select>

        <input style={{ ...field, minWidth: 210 }} value={q} placeholder="Search name or folder…"
               onChange={(e) => setQ(e.target.value)} />

        {(shelf || year || ext || q) ? (
          <button style={btn} onClick={() => { setShelf(''); setYear(''); setExt(''); setQ(''); }}>
            Clear
          </button>
        ) : null}

        <span style={{ ...mute, fontSize: 11.5, marginLeft: 'auto' }}>
          {rows.length} of {assets.length} files
          {active ? ` · ${active.label}: ${vol(active.bytes)}${active.archived ? ` · ${active.archived} archived (hidden)` : ''}` : ''}
        </span>
      </div>

      {rows.length === 0 ? (
        <div style={{ ...mute, fontSize: 12.5, padding: '14px 0' }}>Nothing matches these filters.</div>
      ) : (
        <div style={{ overflowX: 'auto', border: BORDER, borderRadius: 8 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                {head('title', 'Document')}
                {!shelf ? <th style={{ ...th, cursor: 'default' }}>Shelf</th> : null}
                {head('ext', 'Type')}
                {head('doc_year', 'Year', { textAlign: 'right' })}
                {head('created_at', 'Created')}
                {head('updated_at', 'Last edit')}
                {head('size_kb', 'Size', { textAlign: 'right' })}
                <th style={{ ...th, cursor: 'default' }} />
              </tr>
            </thead>
            <tbody>
              {rows.map((a) => (
                <tr key={a.doc_id}>
                  <td style={{ ...td, minWidth: 260 }}>
                    <a href={a.preview_url} target="_blank" rel="noreferrer"
                       style={{ textDecoration: 'underline', color: 'var(--tbl-fg, #1B1B1B)' }}>
                      {a.title || a.file_name || a.doc_id.slice(0, 8)}
                    </a>
                    {a.copies > 1 ? <span style={{ ...pill, marginLeft: 6 }}>{a.copies} copies</span> : null}
                    {a.folder ? <div style={{ ...mute, fontSize: 11 }}>{a.folder}</div> : null}
                  </td>
                  {!shelf ? <td style={{ ...td, ...mute, fontSize: 11.5, whiteSpace: 'nowrap' }}>{labelOf(a.shelf)}</td> : null}
                  <td style={td}><span style={pill}>{a.ext ?? '—'}</span></td>
                  <td style={{ ...td, textAlign: 'right', ...mute, fontSize: 11.5 }}>{a.doc_year ?? '—'}</td>
                  <td style={{ ...td, ...mute, fontSize: 11.5, whiteSpace: 'nowrap' }}>{day(a.created_at)}</td>
                  <td style={{ ...td, ...mute, fontSize: 11.5, whiteSpace: 'nowrap' }}>{day(a.updated_at)}</td>
                  <td style={{ ...td, textAlign: 'right', ...mute, fontSize: 11.5, whiteSpace: 'nowrap' }}>{size(a.size_kb)}</td>
                  <td style={{ ...td, whiteSpace: 'nowrap', textAlign: 'right' }}>
                    <a style={pill} href={a.preview_url} target="_blank" rel="noreferrer">preview</a>{' '}
                    <a style={pill} href={a.download_url}>download</a>{' '}
                    <button style={btn} disabled={busy === a.doc_id} onClick={() => dismiss(a)}>
                      {busy === a.doc_id ? '…' : 'dismiss'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
