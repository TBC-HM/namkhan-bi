'use client';
// app/h/[property_id]/finance/legal/docs/_components/DocsTableClient.tsx
// Client-side glue for the Document Triage Register.
// - URL-param-driven sort/filter/page (server re-renders on every change).
// - Inline remap (doc_type, doc_subtype, status, doc_date, expiry_date, signed,
//   reference_number, sensitivity, importance, project) → fn_doc_remap.
// - Row actions: Archive, Restore, Delete permanently (guarded purge surfaces
//   raised message), Add to case, Add to collection, +Tag.
//
// B&W header law per claude_md §0.9 (#FFF bg, 2px solid #000 bottom, #000 700).
// Opted out of the global dark-th theme via className="data-table" (yesterday's
// fix to styles/globals.css).

import { useRouter, usePathname } from 'next/navigation';
import { useMemo, useState, useTransition } from 'react';
import { supabase } from '@/lib/supabase';

interface VocabRow { doc_type: string; subtype_slug: string; label: string | null; time_model: string | null }
interface DocRow {
  doc_id: string; property_id: number; title: string | null; title_lo: string | null;
  file_name: string | null; doc_type: string | null; doc_subtype: string | null;
  subtype_label: string | null; time_model: string | null; status: string | null;
  is_archived: boolean | null; sensitivity: string | null; importance: string | null;
  signed: boolean | null; signed_at: string | null; doc_date: string | null;
  expiry_date: string | null; uploaded_at: string | null; last_updated_at: string | null;
  reference_number: string | null; language: string | null; has_file: boolean | null;
  mime: string | null; file_size_bytes: number | null; page_count: number | null;
  version: number | null; is_current_version: boolean | null;
  tags: string[] | null; project: string | null; matter: string | null;
  case_refs: string[] | null; n_collections: number | null;
  collection_names: string[] | null;
  retention_until: string | null; needs_review: boolean | null; needs_review_reason: string | null;
  author: string | null;
  file_type: string | null;
  summary: string | null;   // per-doc note shown as hover tooltip
}
interface QueryState {
  q: string; family: string; subtype: string; matter: string; status: string;
  caseF: string; collF: string; tagF: string;
  nr: boolean; exp: boolean;
  sort: string; dir: 'asc' | 'desc' | '';
  page: number;
}
interface Props {
  propertyId: number;
  rows: DocRow[];
  vocab: VocabRow[];
  families: string[];
  matters: string[];
  statuses: string[];
  caseRefs: string[];        // existing case_refs for the autocomplete picker
  collectionNames: string[]; // existing collection names
  tagList: string[];         // existing tags (distinct)
  authorList: string[];      // existing authors (vocab + in-use)
  query: QueryState;
  totalRows: number;
  totalPages: number;
  pageSize: number;
}

const INK         = '#1B1B1B';
const INK_SOFT    = '#5A5A5A';
const HAIRLINE    = '#E0E0E0';
const PAPER       = '#FFFFFF';
const REVIEW_TINT = '#FFF8F0';

// Brief §3 + PBS 2026-06-28: sortable columns + labels in display order.
// Collections & Tags are arrays — not sortable server-side; render-only.
// Doc date is pulled up next to Title so it lives beside the title visibly,
// distinct from Uploaded (separate column near the end).
const COLUMNS: { key: string; label: string; align?: 'left' | 'right' | 'center'; sortable?: boolean }[] = [
  { key: 'title',            label: 'Title' },
  { key: 'doc_date',         label: 'Doc date',     align: 'right' },
  { key: 'author',           label: 'Author' },
  { key: 'doc_type',         label: 'Family' },
  { key: 'doc_subtype',      label: 'Subtype' },
  { key: 'file_type',        label: 'File type' },
  { key: 'status',           label: 'Status' },
  { key: 'matter',           label: 'Matter' },
  { key: 'collection_names', label: 'Collections', sortable: false },
  { key: 'tags',             label: 'Tags',        sortable: false },
  { key: 'expiry_date',      label: 'Expiry',       align: 'right' },
  { key: 'signed',           label: 'Signed',       align: 'center' },
  { key: 'sensitivity',      label: 'Sens.' },
  { key: 'importance',       label: 'Imp.' },
  { key: 'uploaded_at',      label: 'Uploaded',     align: 'right' },
  { key: 'last_updated_at',  label: 'Updated',      align: 'right' },
  { key: '__actions',        label: 'Actions',      align: 'right', sortable: false },
];

const STATUS_OPTIONS      = ['draft', 'active', 'expired', 'superseded', 'archived'];
const SENSITIVITY_OPTIONS = ['public', 'internal', 'confidential', 'restricted'];
const IMPORTANCE_OPTIONS  = ['low', 'standard', 'high', 'critical'];

function fmtDate(s: string | null): string {
  if (!s) return '—';
  return s.length >= 10 ? s.slice(0, 10) : s;
}
function fmtBool(b: boolean | null): string {
  if (b === true) return '✓'; if (b === false) return '·'; return '—';
}

export default function DocsTableClient({
  propertyId, rows, vocab, families, matters, statuses,
  caseRefs, collectionNames, tagList, authorList,
  query, totalRows, totalPages, pageSize,
}: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const [pending, startTransition] = useTransition();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Per-row picker state: which row has which picker open, and the typed value.
  const [picker, setPicker] = useState<{ docId: string; kind: 'case' | 'collection' | 'tag'; value: string } | null>(null);
  // Multi-select state — set of selected doc_ids across this page only.
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkBusy, setBulkBusy] = useState(false);
  const allOnPage = useMemo(() => rows.map((r) => r.doc_id), [rows]);
  const allSelected = allOnPage.length > 0 && allOnPage.every((id) => selected.has(id));
  const someSelected = allOnPage.some((id) => selected.has(id));

  // Group vocab by doc_type so the row subtype dropdown is filtered cheaply.
  const vocabByType = useMemo(() => {
    const m = new Map<string, VocabRow[]>();
    for (const r of vocab) {
      const k = r.doc_type;
      if (!m.has(k)) m.set(k, []);
      m.get(k)!.push(r);
    }
    return m;
  }, [vocab]);

  // --- URL navigation helpers -------------------------------------------
  function pushParams(patch: Partial<Record<string, string | null>>) {
    const sp = new URLSearchParams();
    const base: Record<string, string> = {
      q: query.q, family: query.family, subtype: query.subtype,
      matter: query.matter, status: query.status,
      case: query.caseF, coll: query.collF, tag: query.tagF,
      nr: query.nr ? '1' : '0',
      exp: query.exp ? '1' : '',
      sort: query.sort, dir: query.dir,
      page: String(query.page),
    };
    const merged = { ...base, ...patch };
    for (const [k, v] of Object.entries(merged)) {
      if (v != null && v !== '') sp.set(k, String(v));
    }
    // Reset to page 1 unless the patch explicitly set a page.
    if (!('page' in patch)) sp.set('page', '1');
    startTransition(() => router.push(`${pathname}?${sp.toString()}`));
  }

  function toggleSort(col: string) {
    if (query.sort !== col) return pushParams({ sort: col, dir: 'asc' });
    if (query.dir  === 'asc')  return pushParams({ sort: col, dir: 'desc' });
    return pushParams({ sort: '', dir: '' });
  }

  // --- RPC helpers ------------------------------------------------------
  async function callRpc(name: string, args: Record<string, unknown>): Promise<boolean> {
    setError(null);
    const { error: e } = await supabase.rpc(name, args);
    if (e) {
      setError(`${name}: ${e.message}`);
      return false;
    }
    startTransition(() => router.refresh());
    return true;
  }

  // --- Row action handlers ----------------------------------------------
  async function onArchive(doc_id: string) {
    const reason = window.prompt('Archive reason? (optional)') ?? null;
    await callRpc('fn_doc_archive', { p_doc_id: doc_id, p_reason: reason });
  }
  async function onUnarchive(doc_id: string) {
    await callRpc('fn_doc_unarchive', { p_doc_id: doc_id, p_status: 'active' });
  }
  async function onPurge(doc_id: string) {
    if (!window.confirm('Permanently DELETE this archived doc? Blocks if any external reference still points at it.')) return;
    await callRpc('fn_doc_purge', { p_doc_id: doc_id });
  }
  async function commitPicker() {
    if (!picker) return;
    const v = picker.value.trim();
    if (!v) { setPicker(null); return; }
    let ok = false;
    if (picker.kind === 'case')       ok = await callRpc('fn_doc_link_case',        { p_doc_id: picker.docId, p_case_ref: v, p_doc_role: 'evidence', p_title: null });
    if (picker.kind === 'collection') ok = await callRpc('fn_doc_link_collection',  { p_doc_id: picker.docId, p_collection_name: v });
    if (picker.kind === 'tag')        ok = await callRpc('fn_doc_tag',              { p_doc_id: picker.docId, p_tag: v, p_add: true });
    if (ok) setPicker(null);
  }
  function openPicker(docId: string, kind: 'case' | 'collection' | 'tag') {
    setPicker({ docId, kind, value: '' });
  }

  // --- Multi-select helpers --------------------------------------------
  function toggleRow(docId: string, on?: boolean) {
    setSelected((cur) => {
      const next = new Set(cur);
      const willAdd = on ?? !next.has(docId);
      if (willAdd) next.add(docId); else next.delete(docId);
      return next;
    });
  }
  function toggleAllOnPage(on: boolean) {
    setSelected((cur) => {
      const next = new Set(cur);
      for (const id of allOnPage) {
        if (on) next.add(id); else next.delete(id);
      }
      return next;
    });
  }
  function clearSelection() { setSelected(new Set()); }

  // --- File actions per row --------------------------------------------
  function fileHref(docId: string, mode: 'download' | 'preview') {
    // Download path 302s to a Supabase signed URL with attachment disposition.
    // Preview path is a Next page that picks the right inline viewer per MIME
    // (PDF + image native, Office via view.officeapps.live.com); without the
    // wrapper page, browsers download anything they can't render natively.
    if (mode === 'preview') return `/legal/docs/preview/${encodeURIComponent(docId)}`;
    return `/api/legal/docs/file/${encodeURIComponent(docId)}?mode=download`;
  }
  function openInTab(href: string) {
    window.open(href, '_blank', 'noopener,noreferrer');
  }
  function downloadOne(docId: string) {
    // Same-tab navigation triggers the browser's download dialogue cleanly.
    window.location.href = fileHref(docId, 'download');
  }

  // --- Bulk actions on the selected set ---------------------------------
  async function bulkDownload() {
    if (!selected.size) return;
    setBulkBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/legal/docs/bulk-download', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ doc_ids: Array.from(selected) }),
      });
      if (!res.ok) {
        const detail = await res.json().catch(() => ({}));
        throw new Error(detail?.error ?? `bulk download failed (${res.status})`);
      }
      const blob = await res.blob();
      const cd   = res.headers.get('content-disposition') ?? '';
      const fn   = /filename="([^"]+)"/.exec(cd)?.[1] ?? 'legal-docs.zip';
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement('a');
      a.href = url; a.download = fn; document.body.appendChild(a); a.click();
      a.remove(); URL.revokeObjectURL(url);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBulkBusy(false);
    }
  }
  // --- Bulk edit: apply a single field across every selected doc -------
  // Fires fn_doc_remap (or fn_doc_link_case / link_collection / tag) once per
  // selected doc_id in parallel. Refreshes the page after the last write.
  type BulkField = 'family' | 'subtype' | 'status' | 'sensitivity' | 'importance'
                 | 'matter_case' | 'matter_project' | 'author' | 'collection' | 'tag';
  const [bulkField, setBulkField] = useState<BulkField | ''>('');
  const [bulkValue, setBulkValue] = useState<string>('');

  async function bulkApply() {
    if (!selected.size || !bulkField) return;
    setBulkBusy(true); setError(null);
    const ids = Array.from(selected);
    try {
      const calls = ids.map(async (id) => {
        switch (bulkField) {
          case 'family':         return supabase.rpc('fn_doc_remap', { p_doc_id: id, p_doc_type: bulkValue });
          case 'subtype':        return supabase.rpc('fn_doc_remap', { p_doc_id: id, p_doc_subtype: bulkValue });
          case 'status':         return supabase.rpc('fn_doc_remap', { p_doc_id: id, p_status: bulkValue });
          case 'sensitivity':    return supabase.rpc('fn_doc_remap', { p_doc_id: id, p_sensitivity: bulkValue });
          case 'importance':     return supabase.rpc('fn_doc_remap', { p_doc_id: id, p_importance: bulkValue });
          case 'author':         return supabase.rpc('fn_doc_remap', { p_doc_id: id, p_author: bulkValue });
          case 'matter_project': return supabase.rpc('fn_doc_remap', { p_doc_id: id, p_project: bulkValue });
          case 'matter_case':    return supabase.rpc('fn_doc_link_case',       { p_doc_id: id, p_case_ref: bulkValue, p_doc_role: 'evidence', p_title: null });
          case 'collection':     return supabase.rpc('fn_doc_link_collection', { p_doc_id: id, p_collection_name: bulkValue });
          case 'tag':            return supabase.rpc('fn_doc_tag',             { p_doc_id: id, p_tag: bulkValue, p_add: true });
        }
      });
      const results = await Promise.all(calls);
      const failed = results.filter((r: any) => r?.error).map((r: any) => r.error.message);
      if (failed.length) {
        setError(`${failed.length} of ${ids.length} writes failed: ${failed[0]}${failed.length>1 ? ` (+${failed.length-1} more)` : ''}`);
      }
      // Refresh regardless — even partial writes need the new state on screen.
      startTransition(() => router.refresh());
      setBulkValue('');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBulkBusy(false);
    }
  }

  function bulkMailto() {
    if (!selected.size) return;
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    const rowsById = new Map(rows.map((r) => [r.doc_id, r]));
    const lines: string[] = ['Documents from the Namkhan register:', ''];
    for (const id of selected) {
      const r = rowsById.get(id);
      const name = r?.file_name?.trim() || r?.title?.trim() || id;
      lines.push(`• ${name}`);
      lines.push(`  ${origin}${fileHref(id, 'download')}`);
      lines.push('');
    }
    const subject = `Documents from Namkhan · ${selected.size} file${selected.size === 1 ? '' : 's'}`;
    const href = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(lines.join('\n'))}`;
    window.location.href = href;
  }
  async function onRemap(doc_id: string, patch: Record<string, unknown>) {
    const args: Record<string, unknown> = { p_doc_id: doc_id };
    if ('doc_type'   in patch) args.p_doc_type    = patch.doc_type;
    if ('doc_subtype'in patch) args.p_doc_subtype = patch.doc_subtype;
    if ('status'     in patch) args.p_status      = patch.status;
    if ('doc_date'   in patch) args.p_doc_date    = patch.doc_date;
    if ('expiry'     in patch) args.p_expiry      = patch.expiry;
    if ('signed'     in patch) args.p_signed      = patch.signed;
    if ('reference'  in patch) args.p_reference   = patch.reference;
    if ('sensitivity'in patch) args.p_sensitivity = patch.sensitivity;
    if ('importance' in patch) args.p_importance  = patch.importance;
    if ('project'    in patch) args.p_project     = patch.project;
    const ok = await callRpc('fn_doc_remap', args);
    if (ok) setEditingId(null);
  }

  // --- Render -----------------------------------------------------------
  return (
    <div>
      {/* Bulk action toolbar — shown only when at least one row is selected. */}
      {selected.size > 0 && (
        <div style={{
          display: 'flex', flexDirection: 'column', gap: 8, padding: '8px 12px',
          background: '#F4EFE2', border: `1px solid ${INK}`, borderRadius: 4,
          marginBottom: 8, fontSize: 11, color: INK,
        }}>
          {/* Row 1: file actions */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <strong>{selected.size} selected</strong>
            <button onClick={bulkDownload} disabled={bulkBusy}
              style={{ padding: '4px 10px', border: `1px solid ${INK}`, borderRadius: 3,
                       background: INK, color: PAPER, fontSize: 11, cursor: bulkBusy ? 'wait' : 'pointer' }}>
              {bulkBusy ? 'Working…' : '⤓ Download ZIP'}
            </button>
            <button onClick={bulkMailto}
              style={{ padding: '4px 10px', border: `1px solid ${INK}`, borderRadius: 3,
                       background: PAPER, color: INK, fontSize: 11, cursor: 'pointer' }}>
              ✉ Mail to…
            </button>
            <button onClick={clearSelection}
              style={{ padding: '4px 10px', border: `1px solid ${HAIRLINE}`, borderRadius: 3,
                       background: PAPER, color: INK_SOFT, fontSize: 11, cursor: 'pointer' }}>
              Clear
            </button>
            <span style={{ marginLeft: 'auto', color: INK_SOFT, fontSize: 11 }}>
              ZIP contains bytes verbatim · mail composes a draft with download links
            </span>
          </div>

          {/* Row 2: bulk-edit — pick a field, set a value, Apply to all selected.
              Each path fires fn_doc_remap / link_case / link_collection / tag once per row in parallel. */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.06em', color: INK_SOFT }}>Bulk edit</span>
            <select value={bulkField} onChange={(e) => { setBulkField(e.target.value as any); setBulkValue(''); }}
              style={{ ...selectStyle, fontSize: 11 }}>
              <option value="">— pick field —</option>
              <option value="family">Set Family (doc_type)</option>
              <option value="subtype">Set Subtype</option>
              <option value="status">Set Status</option>
              <option value="sensitivity">Set Sensitivity</option>
              <option value="importance">Set Importance</option>
              <option value="author">Set Author</option>
              <option value="matter_project">Set Project (matter)</option>
              <option value="matter_case">Link to Case (matter)</option>
              <option value="collection">Add to Collection</option>
              <option value="tag">Add Tag</option>
            </select>

            {/* Value editor — context-sensitive per chosen field. */}
            {bulkField === 'family' && (
              <select value={bulkValue} onChange={(e) => setBulkValue(e.target.value)} style={selectStyle}>
                <option value="">— value —</option>
                {families.map((f) => <option key={f} value={f}>{f}</option>)}
              </select>
            )}
            {bulkField === 'subtype' && (
              <select value={bulkValue} onChange={(e) => setBulkValue(e.target.value)} style={selectStyle}>
                <option value="">— value —</option>
                {vocab.map((v) => (
                  <option key={`${v.doc_type}·${v.subtype_slug}`} value={v.subtype_slug}>
                    {v.label || v.subtype_slug} · {v.doc_type}
                  </option>
                ))}
              </select>
            )}
            {bulkField === 'status' && (
              <select value={bulkValue} onChange={(e) => setBulkValue(e.target.value)} style={selectStyle}>
                <option value="">— value —</option>
                {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            )}
            {bulkField === 'sensitivity' && (
              <select value={bulkValue} onChange={(e) => setBulkValue(e.target.value)} style={selectStyle}>
                <option value="">— value —</option>
                {SENSITIVITY_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            )}
            {bulkField === 'importance' && (
              <select value={bulkValue} onChange={(e) => setBulkValue(e.target.value)} style={selectStyle}>
                <option value="">— value —</option>
                {IMPORTANCE_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            )}
            {(bulkField === 'author' || bulkField === 'matter_project' || bulkField === 'matter_case' || bulkField === 'collection' || bulkField === 'tag') && (
              <>
                <input list={`dl-bulk-${bulkField}`} value={bulkValue}
                  onChange={(e) => setBulkValue(e.target.value)}
                  placeholder={
                    bulkField === 'author'         ? 'author / company / ministry' :
                    bulkField === 'matter_project' ? 'project name (existing or new)' :
                    bulkField === 'matter_case'    ? 'case_ref (existing or new)' :
                    bulkField === 'collection'     ? 'collection name (existing or new)' :
                                                     'tag (existing or new)'
                  }
                  style={{ padding: '4px 8px', border: `1px solid ${HAIRLINE}`, borderRadius: 3, fontSize: 11, minWidth: 180 }} />
                <datalist id={`dl-bulk-${bulkField}`}>
                  {(bulkField === 'author' ? authorList :
                    bulkField === 'matter_project' ? matters :
                    bulkField === 'matter_case' ? caseRefs :
                    bulkField === 'collection' ? collectionNames :
                    tagList).map((v) => <option key={v} value={v} />)}
                </datalist>
              </>
            )}

            <button onClick={bulkApply} disabled={!bulkField || !bulkValue.trim() || bulkBusy}
              style={{ padding: '4px 12px', border: `1px solid ${INK}`, borderRadius: 3,
                       background: !bulkField || !bulkValue.trim() ? '#888' : INK,
                       color: PAPER, fontSize: 11,
                       cursor: !bulkField || !bulkValue.trim() ? 'not-allowed' : 'pointer' }}>
              Apply to {selected.size}
            </button>
          </div>
        </div>
      )}

      {/* Filter bar */}
      <div style={{
        display: 'flex', flexWrap: 'wrap', gap: 8, padding: '8px 0 12px 0',
        borderBottom: `1px solid ${HAIRLINE}`, marginBottom: 8,
        fontSize: 11, color: INK,
      }}>
        <input
          type="search"
          placeholder="Search title / reference"
          defaultValue={query.q}
          onKeyDown={(e) => { if (e.key === 'Enter') pushParams({ q: (e.target as HTMLInputElement).value, page: '1' }); }}
          style={{ padding: '4px 8px', border: `1px solid ${HAIRLINE}`, borderRadius: 3, minWidth: 200, fontSize: 11 }}
        />
        <select value={query.family}
          onChange={(e) => pushParams({ family: e.target.value, subtype: '' })}
          style={selectStyle}>
          <option value="">All families</option>
          {families.map((f) => <option key={f} value={f}>{f}</option>)}
        </select>
        {/* Subtype dropdown — narrows to the selected family's vocab when one is set.
            When family = all, shows the platform-wide vocab. */}
        <select value={query.subtype}
          onChange={(e) => pushParams({ subtype: e.target.value })}
          title={query.family ? `Subtypes for ${query.family}` : 'All subtypes (across families)'}
          style={selectStyle}>
          <option value="">All subtypes</option>
          {(query.family ? vocab.filter((v) => v.doc_type === query.family) : vocab)
            .map((v) => (
              <option key={`${v.doc_type}·${v.subtype_slug}`} value={v.subtype_slug}>
                {v.label || v.subtype_slug}{!query.family ? ` · ${v.doc_type}` : ''}
              </option>
            ))}
        </select>
        <select value={query.matter} onChange={(e) => pushParams({ matter: e.target.value })}
          style={selectStyle}>
          <option value="">All matters</option>
          {matters.map((m) => <option key={m} value={m}>{m}</option>)}
        </select>
        <select value={query.status} onChange={(e) => pushParams({ status: e.target.value })}
          style={selectStyle}>
          <option value="">All statuses</option>
          {statuses.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        {/* Array-membership filters — server uses .contains() on text[] cols. */}
        <select value={query.caseF} onChange={(e) => pushParams({ case: e.target.value })}
          style={selectStyle}
          title="Filter to docs linked to this case">
          <option value="">All cases</option>
          {caseRefs.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <select value={query.collF} onChange={(e) => pushParams({ coll: e.target.value })}
          style={selectStyle}
          title="Filter to docs in this collection">
          <option value="">All collections</option>
          {collectionNames.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <select value={query.tagF} onChange={(e) => pushParams({ tag: e.target.value })}
          style={selectStyle}
          title="Filter to docs carrying this tag">
          <option value="">All tags</option>
          {tagList.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
        <label style={pillStyle(query.nr)}>
          <input type="checkbox" checked={query.nr} onChange={(e) => pushParams({ nr: e.target.checked ? '1' : '0' })}
            style={{ marginRight: 6 }} />
          Needs review
        </label>
        <label style={pillStyle(query.exp)}>
          <input type="checkbox" checked={query.exp} onChange={(e) => pushParams({ exp: e.target.checked ? '1' : '' })}
            style={{ marginRight: 6 }} />
          Expiring ≤ 90d
        </label>
        <span style={{ marginLeft: 'auto', color: INK_SOFT }}>
          {totalRows.toLocaleString('en-US')} matching · page {query.page} / {totalPages}
        </span>
      </div>

      {error && (
        <div style={{
          background: '#FBEAEA', color: '#C62828', padding: '6px 10px',
          border: '1px solid #C62828', borderRadius: 3, marginBottom: 8, fontSize: 11,
        }}>
          {error}
        </div>
      )}

      {/* The register table */}
      <div style={{ overflowX: 'auto', border: `1px solid ${HAIRLINE}`, borderRadius: 4, background: PAPER }}>
        <table className="data-table" style={{
          width: '100%', borderCollapse: 'separate', borderSpacing: 0,
          fontFamily: 'inherit', fontSize: 11, background: PAPER, lineHeight: 1.3,
        }}>
          <thead>
            <tr>
              <th style={{
                padding: '8px 10px', textAlign: 'center', background: PAPER,
                borderBottom: '2px solid #000', width: 28, fontSize: 10,
              }}>
                <input type="checkbox"
                  aria-label="Select all on page"
                  ref={(el) => { if (el) el.indeterminate = someSelected && !allSelected; }}
                  checked={allSelected}
                  onChange={(e) => toggleAllOnPage(e.target.checked)}
                />
              </th>
              {COLUMNS.map((c) => {
                const active = query.sort === c.key;
                const arrow = !active ? '' : query.dir === 'asc' ? ' ▲' : ' ▼';
                const sortable = c.sortable !== false;
                return (
                  <th key={c.key} style={{
                    padding: '8px 10px',
                    textAlign: c.align ?? 'left',
                    color: INK,
                    fontWeight: 700,
                    fontSize: 10,
                    letterSpacing: '0.06em',
                    textTransform: 'uppercase',
                    background: PAPER,
                    borderBottom: '2px solid #000',
                    whiteSpace: 'nowrap',
                    cursor: sortable ? 'pointer' : 'default',
                    userSelect: 'none',
                  }}
                  onClick={() => sortable && toggleSort(c.key)}>
                    {c.label}{arrow}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr><td colSpan={COLUMNS.length + 1} style={{ padding: '24px 12px', color: INK_SOFT, textAlign: 'center', fontStyle: 'italic' }}>
                No documents match this filter.
              </td></tr>
            )}
            {rows.map((r) => {
              const isEditing = editingId === r.doc_id;
              const tint = r.needs_review ? REVIEW_TINT : PAPER;
              const subtypesForType = (r.doc_type && vocabByType.get(r.doc_type)) || [];
              return (
                <tr key={r.doc_id} style={{ background: tint, borderBottom: `1px solid ${HAIRLINE}` }}>
                  <td style={{ ...tdStyle, textAlign: 'center', width: 28 }}>
                    <input type="checkbox"
                      aria-label={`Select ${r.title ?? r.file_name ?? r.doc_id}`}
                      checked={selected.has(r.doc_id)}
                      onChange={(e) => toggleRow(r.doc_id, e.target.checked)}
                    />
                  </td>
                  {/* TITLE — editable title + file_name in Edit mode; star + tooltip when summary set. */}
                  <td style={tdStyle}>
                    {isEditing ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 220 }}>
                        <input
                          type="text"
                          defaultValue={r.title ?? ''}
                          placeholder="Title"
                          onBlur={(e) => e.target.value !== (r.title ?? '') && onRemap(r.doc_id, { title: e.target.value || null })}
                          style={{ ...inlineInput, fontWeight: 500 }}
                        />
                        <input
                          type="text"
                          defaultValue={r.file_name ?? ''}
                          placeholder="file_name.ext"
                          onBlur={(e) => e.target.value !== (r.file_name ?? '') && onRemap(r.doc_id, { file_name: e.target.value || null })}
                          style={{ ...inlineInput, fontSize: 10, color: INK_SOFT, fontFamily: 'monospace' }}
                        />
                        <textarea
                          defaultValue={r.summary ?? ''}
                          placeholder="note (hover to read later)"
                          rows={2}
                          onBlur={(e) => e.target.value !== (r.summary ?? '') && onRemap(r.doc_id, { summary: e.target.value || null })}
                          style={{ ...inlineInput, resize: 'vertical', minHeight: 32, fontSize: 10 }}
                        />
                      </div>
                    ) : (
                      <div>
                        <div style={{ fontWeight: 500, color: INK, display: 'flex', alignItems: 'center', gap: 4 }}>
                          <span>{r.title || r.file_name || '—'}</span>
                          {r.summary && (
                            <span
                              title={r.summary}
                              aria-label={`Note: ${r.summary}`}
                              style={{ cursor: 'help', color: '#B8860B', fontSize: 12, lineHeight: 1 }}
                            >★</span>
                          )}
                        </div>
                        {r.file_name && r.file_name !== r.title && (
                          <div style={{ fontSize: 10, color: INK_SOFT, marginTop: 2, fontFamily: 'monospace' }} title={r.file_name}>
                            {r.file_name.length > 60 ? r.file_name.slice(0, 57) + '…' : r.file_name}
                          </div>
                        )}
                        {r.needs_review && (
                          <div style={{ fontSize: 10, color: '#B8542A', marginTop: 2 }}>
                            needs review · {r.needs_review_reason}
                          </div>
                        )}
                      </div>
                    )}
                  </td>
                  {/* DOC DATE — promoted next to Title; editable in Edit mode. */}
                  <td style={{ ...tdStyle, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                    {isEditing ? (
                      <input type="date" defaultValue={r.doc_date ?? ''}
                        onBlur={(e) => e.target.value !== (r.doc_date ?? '') && onRemap(r.doc_id, { doc_date: e.target.value || null })}
                        style={inlineInput} />
                    ) : fmtDate(r.doc_date)}
                  </td>
                  {/* AUTHOR — free text with datalist autocomplete from authorList. */}
                  <td style={tdStyle}>
                    {isEditing ? (
                      <>
                        <input list={`dl-authors-${r.doc_id}`}
                          defaultValue={r.author ?? ''}
                          placeholder="author / company / ministry"
                          onBlur={(e) => e.target.value !== (r.author ?? '') && onRemap(r.doc_id, { author: e.target.value || null })}
                          style={{ ...inlineInput, minWidth: 140 }} />
                        <datalist id={`dl-authors-${r.doc_id}`}>
                          {authorList.map((a) => <option key={a} value={a} />)}
                        </datalist>
                      </>
                    ) : (r.author ?? '—')}
                  </td>
                  {/* FAMILY */}
                  <td style={tdStyle}>
                    {isEditing ? (
                      <select defaultValue={r.doc_type ?? ''}
                        onChange={(e) => onRemap(r.doc_id, { doc_type: e.target.value })}
                        style={inlineSelect}>
                        {families.map((f) => <option key={f} value={f}>{f}</option>)}
                      </select>
                    ) : (r.doc_type ?? '—')}
                  </td>
                  {/* SUBTYPE */}
                  <td style={tdStyle}>
                    {isEditing ? (
                      <select defaultValue={r.doc_subtype ?? ''}
                        onChange={(e) => onRemap(r.doc_id, { doc_subtype: e.target.value })}
                        style={inlineSelect}>
                        <option value="">(none)</option>
                        {subtypesForType.map((v) => (
                          <option key={v.subtype_slug} value={v.subtype_slug}>{v.label || v.subtype_slug}</option>
                        ))}
                      </select>
                    ) : (r.subtype_label || r.doc_subtype || '—')}
                  </td>
                  {/* FILE TYPE — derived; not editable. */}
                  <td style={tdStyle}>
                    <span style={{
                      display: 'inline-block', padding: '1px 6px',
                      border: `1px solid ${HAIRLINE}`, borderRadius: 8,
                      background: '#F8F8F8', fontSize: 10, color: INK,
                    }}>{r.file_type ?? 'other'}</span>
                  </td>
                  {/* STATUS */}
                  <td style={tdStyle}>
                    {isEditing ? (
                      <select defaultValue={r.status ?? ''}
                        onChange={(e) => onRemap(r.doc_id, { status: e.target.value })}
                        style={inlineSelect}>
                        {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
                      </select>
                    ) : (r.status ?? '—')}
                  </td>
                  {/* MATTER — editable: pick existing case OR existing/new project.
                      Display: when both case_refs AND project exist, show both so
                      project changes are visible even when a case is linked. */}
                  <td style={tdStyle}>
                    {isEditing ? (
                      <MatterEditor row={r} caseRefs={caseRefs} matters={matters}
                        onLinkCase={(ref) => callRpc('fn_doc_link_case', { p_doc_id: r.doc_id, p_case_ref: ref, p_doc_role: 'evidence', p_title: null })}
                        onSetProject={(proj) => onRemap(r.doc_id, { project: proj })} />
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                        {(r.case_refs ?? []).length > 0 && (
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                            {(r.case_refs ?? []).map((cr) => (
                              <span key={cr} style={{
                                display: 'inline-block', padding: '1px 6px',
                                border: `1px solid ${HAIRLINE}`, borderRadius: 8,
                                background: '#F8F8F8', fontSize: 10, color: INK,
                              }}>case: {cr}</span>
                            ))}
                          </div>
                        )}
                        {r.project && (
                          <span style={{
                            display: 'inline-block', padding: '1px 6px',
                            border: `1px solid ${HAIRLINE}`, borderRadius: 8,
                            background: '#F8F8F8', fontSize: 10, color: INK,
                            alignSelf: 'flex-start',
                          }}>project: {r.project}</span>
                        )}
                        {!(r.case_refs ?? []).length && !r.project && <span style={{ color: INK_SOFT }}>—</span>}
                      </div>
                    )}
                  </td>
                  {/* COLLECTIONS */}
                  <td style={tdStyle}>
                    <ChipList
                      items={r.collection_names ?? []}
                      isEditing={isEditing}
                      onRemove={(name) => callRpc('fn_doc_unlink_collection', { p_doc_id: r.doc_id, p_collection_name: name })}
                      onAddClick={() => openPicker(r.doc_id, 'collection')}
                    />
                  </td>
                  {/* TAGS */}
                  <td style={tdStyle}>
                    <ChipList
                      items={r.tags ?? []}
                      isEditing={isEditing}
                      onRemove={(tag) => callRpc('fn_doc_tag', { p_doc_id: r.doc_id, p_tag: tag, p_add: false })}
                      onAddClick={() => openPicker(r.doc_id, 'tag')}
                    />
                  </td>
                  {/* EXPIRY */}
                  <td style={{ ...tdStyle, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                    {isEditing ? (
                      <input type="date" defaultValue={r.expiry_date ?? ''}
                        onBlur={(e) => e.target.value !== (r.expiry_date ?? '') && onRemap(r.doc_id, { expiry: e.target.value || null })}
                        style={inlineInput} />
                    ) : fmtDate(r.expiry_date)}
                  </td>
                  {/* SIGNED */}
                  <td style={{ ...tdStyle, textAlign: 'center' }}>
                    {isEditing ? (
                      <input type="checkbox" defaultChecked={!!r.signed}
                        onChange={(e) => onRemap(r.doc_id, { signed: e.target.checked })} />
                    ) : fmtBool(r.signed)}
                  </td>
                  {/* SENS */}
                  <td style={tdStyle}>
                    {isEditing ? (
                      <select defaultValue={r.sensitivity ?? ''}
                        onChange={(e) => onRemap(r.doc_id, { sensitivity: e.target.value })}
                        style={inlineSelect}>
                        {SENSITIVITY_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
                      </select>
                    ) : (r.sensitivity ?? '—')}
                  </td>
                  {/* IMP */}
                  <td style={tdStyle}>
                    {isEditing ? (
                      <select defaultValue={r.importance ?? ''}
                        onChange={(e) => onRemap(r.doc_id, { importance: e.target.value })}
                        style={inlineSelect}>
                        {IMPORTANCE_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
                      </select>
                    ) : (r.importance ?? '—')}
                  </td>
                  <td style={{ ...tdStyle, textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: INK_SOFT }}>{fmtDate(r.uploaded_at)}</td>
                  <td style={{ ...tdStyle, textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: INK_SOFT }}>{fmtDate(r.last_updated_at)}</td>
                  <td style={{ ...tdStyle, textAlign: 'right', whiteSpace: 'nowrap' }}>
                    {r.has_file && (
                      <>
                        <button onClick={() => openInTab(fileHref(r.doc_id, 'preview'))}
                          title="Open inline (new tab)" style={actionBtn()}>👁 Preview</button>
                        <button onClick={() => downloadOne(r.doc_id)}
                          title="Save the original file" style={actionBtn()}>⤓ Download</button>
                      </>
                    )}
                    <button
                      onClick={() => {
                        if (isEditing) {
                          setEditingId(null);
                          // Done also closes any picker open on THIS row so the row collapses
                          // cleanly. If PBS typed in a picker but didn't click Link / Add new,
                          // the picker just dismisses — no implicit writes.
                          if (picker?.docId === r.doc_id) setPicker(null);
                        } else {
                          setEditingId(r.doc_id);
                        }
                      }}
                      style={actionBtn(isEditing)}>
                      {isEditing ? 'Done' : 'Edit'}
                    </button>
                    {!r.is_archived && (
                      <>
                        <button onClick={() => openPicker(r.doc_id, 'case')}       style={actionBtn(picker?.docId === r.doc_id && picker.kind === 'case')}>+ Case</button>
                        <button onClick={() => openPicker(r.doc_id, 'collection')} style={actionBtn(picker?.docId === r.doc_id && picker.kind === 'collection')}>+ Coll.</button>
                        <button onClick={() => openPicker(r.doc_id, 'tag')}        style={actionBtn(picker?.docId === r.doc_id && picker.kind === 'tag')}>+ Tag</button>
                        <button onClick={() => onArchive(r.doc_id)} style={actionBtn()}>Archive</button>
                      </>
                    )}
                    {r.is_archived && (
                      <>
                        <button onClick={() => onUnarchive(r.doc_id)} style={actionBtn()}>Restore</button>
                        <button onClick={() => onPurge(r.doc_id)} style={{ ...actionBtn(), color: '#C62828', borderColor: '#C62828' }}>Delete</button>
                      </>
                    )}
                  </td>
                </tr>
              );
            }).flatMap((rowEl, idx) => {
              const r = rows[idx];
              if (picker?.docId !== r.doc_id) return [rowEl];
              const existing = picker.kind === 'case' ? caseRefs : picker.kind === 'collection' ? collectionNames : tagList;
              const listId = `dl-${picker.kind}-${r.doc_id}`;
              const placeholder =
                picker.kind === 'case'       ? 'pick existing case_ref, or type a new one'  :
                picker.kind === 'collection' ? 'pick existing collection, or type new'      :
                                               'pick existing tag, or type new';
              const showAddNew = picker.value.trim() && !existing.includes(picker.value.trim());
              return [
                rowEl,
                <tr key={`${r.doc_id}-picker`} style={{ background: '#FAFAFA', borderBottom: `1px solid ${HAIRLINE}` }}>
                  <td colSpan={COLUMNS.length + 1} style={{ padding: '8px 10px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11, color: INK }}>
                      <strong style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                        link {picker.kind} →
                      </strong>
                      <input
                        list={listId}
                        autoFocus
                        type="text"
                        value={picker.value}
                        placeholder={placeholder}
                        onChange={(e) => setPicker({ ...picker, value: e.target.value })}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') { e.preventDefault(); commitPicker(); }
                          if (e.key === 'Escape') { setPicker(null); }
                        }}
                        style={{ flex: 1, padding: '4px 8px', border: `1px solid ${HAIRLINE}`, borderRadius: 3, fontSize: 11 }}
                      />
                      <datalist id={listId}>
                        {existing.map((opt) => <option key={opt} value={opt} />)}
                      </datalist>
                      <button onClick={commitPicker}
                        style={{ padding: '4px 10px', border: `1px solid ${INK}`, borderRadius: 3,
                                 background: showAddNew ? '#2E7D32' : INK, color: PAPER, fontSize: 11, cursor: 'pointer' }}>
                        {showAddNew ? `+ Add new "${picker.value.trim()}"` : 'Link'}
                      </button>
                      <button onClick={() => setPicker(null)}
                        style={{ padding: '4px 8px', border: `1px solid ${HAIRLINE}`, borderRadius: 3,
                                 background: PAPER, color: INK_SOFT, fontSize: 11, cursor: 'pointer' }}>
                        Cancel
                      </button>
                    </div>
                    <div style={{ fontSize: 10, color: INK_SOFT, marginTop: 4 }}>
                      {existing.length} existing {picker.kind}{existing.length === 1 ? '' : picker.kind === 'case' ? 's' : 's'} — type to filter, Enter to confirm.
                    </div>
                  </td>
                </tr>,
              ];
            })}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '10px 0', fontSize: 11, color: INK }}>
        <button disabled={query.page <= 1 || pending}
          onClick={() => pushParams({ page: String(Math.max(1, query.page - 1)) })}
          style={pageBtn(query.page <= 1)}>
          ← Prev
        </button>
        <span style={{ color: INK_SOFT }}>
          rows {(query.page - 1) * pageSize + 1}–{Math.min(query.page * pageSize, totalRows)} of {totalRows.toLocaleString('en-US')}
        </span>
        <button disabled={query.page >= totalPages || pending}
          onClick={() => pushParams({ page: String(Math.min(totalPages, query.page + 1)) })}
          style={pageBtn(query.page >= totalPages)}>
          Next →
        </button>
        {pending && <span style={{ color: INK_SOFT, marginLeft: 8 }}>loading…</span>}
      </div>
    </div>
  );
}

const tdStyle: React.CSSProperties = {
  padding: '6px 10px', verticalAlign: 'top',
  borderBottom: `1px solid ${HAIRLINE}`,
  color: INK,
};
const selectStyle: React.CSSProperties = {
  padding: '4px 6px', border: `1px solid ${HAIRLINE}`, borderRadius: 3, fontSize: 11, background: PAPER, color: INK,
};
const inlineSelect: React.CSSProperties = { ...selectStyle, fontSize: 11 };
const inlineInput: React.CSSProperties = {
  padding: '3px 6px', border: `1px solid ${HAIRLINE}`, borderRadius: 3, fontSize: 11, background: PAPER, color: INK,
};
function pillStyle(active: boolean): React.CSSProperties {
  return {
    display: 'inline-flex', alignItems: 'center', padding: '4px 8px',
    border: `1px solid ${active ? INK : HAIRLINE}`, borderRadius: 3,
    fontSize: 11, color: INK, background: active ? '#F4EFE2' : PAPER, cursor: 'pointer',
  };
}
function actionBtn(active = false): React.CSSProperties {
  return {
    padding: '3px 8px', marginLeft: 4, border: `1px solid ${active ? INK : HAIRLINE}`,
    borderRadius: 3, background: active ? INK : PAPER, color: active ? PAPER : INK,
    fontSize: 10, cursor: 'pointer',
  };
}
function pageBtn(disabled: boolean): React.CSSProperties {
  return {
    padding: '4px 10px', border: `1px solid ${HAIRLINE}`, borderRadius: 3,
    background: PAPER, color: disabled ? INK_SOFT : INK,
    cursor: disabled ? 'not-allowed' : 'pointer', fontSize: 11,
  };
}

// ── ChipList ─────────────────────────────────────────────────────────────────
// Render an array of strings as small chips. In edit mode each chip shows a ×
// button to unlink, plus a trailing "+" button to open the row's picker.
function ChipList({ items, isEditing, onRemove, onAddClick }: {
  items: string[]; isEditing: boolean;
  onRemove: (item: string) => unknown;
  onAddClick: () => void;
}) {
  if (!items.length && !isEditing) return <span style={{ color: INK_SOFT }}>—</span>;
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, alignItems: 'center' }}>
      {items.map((it) => (
        <span key={it} style={{
          display: 'inline-flex', alignItems: 'center', gap: 4,
          padding: '2px 6px', border: `1px solid ${HAIRLINE}`, borderRadius: 10,
          background: '#F8F8F8', fontSize: 10, color: INK,
        }}>
          {it}
          {isEditing && (
            <button onClick={() => onRemove(it)}
              aria-label={`Unlink ${it}`}
              style={{
                appearance: 'none', background: 'transparent', border: 'none',
                color: '#C62828', cursor: 'pointer', fontSize: 11, lineHeight: 1, padding: 0,
              }}>×</button>
          )}
        </span>
      ))}
      {isEditing && (
        <button onClick={onAddClick}
          aria-label="Add"
          style={{
            padding: '2px 6px', border: `1px dashed ${INK_SOFT}`, borderRadius: 10,
            background: PAPER, color: INK_SOFT, fontSize: 10, cursor: 'pointer',
          }}>+</button>
      )}
    </div>
  );
}

// ── MatterEditor ─────────────────────────────────────────────────────────────
// Two-path matter editor: either link an existing case (autocomplete from
// caseRefs, falls through to fn_doc_link_case which auto-creates new ones), or
// set the free-text project (autocomplete from existing matters). Surface both
// at once so PBS can pick the right path without thinking about the underlying
// data model.
function MatterEditor({ row, caseRefs, matters, onLinkCase, onSetProject }: {
  row: DocRow; caseRefs: string[]; matters: string[];
  onLinkCase: (ref: string) => unknown;
  onSetProject: (project: string) => unknown;
}) {
  const [caseV, setCaseV] = useState('');
  const [projV, setProjV] = useState(row.project ?? '');
  const linkedCases = row.case_refs ?? [];
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 200 }}>
      {linkedCases.length > 0 && (
        <div style={{ fontSize: 10, color: INK_SOFT }}>
          linked: {linkedCases.map((cr) => <code key={cr} style={{ marginRight: 4 }}>{cr}</code>)}
        </div>
      )}
      <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
        <input list={`matter-cases-${row.doc_id}`}
          placeholder="link case…"
          value={caseV}
          onChange={(e) => setCaseV(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              const v = caseV.trim(); if (!v) return;
              onLinkCase(v); setCaseV('');
            }
          }}
          style={{ ...inlineInput, flex: 1, minWidth: 80, fontSize: 10 }} />
        <datalist id={`matter-cases-${row.doc_id}`}>
          {caseRefs.map((c) => <option key={c} value={c} />)}
        </datalist>
      </div>
      <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
        <input list={`matter-projs-${row.doc_id}`}
          placeholder="or set project…"
          value={projV}
          onChange={(e) => setProjV(e.target.value)}
          onBlur={(e) => {
            const v = e.target.value.trim();
            if (v !== (row.project ?? '')) onSetProject(v);
          }}
          onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
          style={{ ...inlineInput, flex: 1, minWidth: 80, fontSize: 10 }} />
        <datalist id={`matter-projs-${row.doc_id}`}>
          {matters.map((m) => <option key={m} value={m} />)}
        </datalist>
      </div>
    </div>
  );
}
