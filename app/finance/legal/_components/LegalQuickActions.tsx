'use client';
// app/finance/legal/_components/LegalQuickActions.tsx
// PBS 2026-07-20 pm · rewrite:
//   1. Click-to-pick now uses explicit button + useRef<HTMLInputElement> (the
//      <label>+hidden-input pattern was silently swallowing clicks somewhere
//      up the DashboardPage grid tree). This fixes the "none of the boxes
//      work" bug reported on /finance/legal.
//   2. Upload doc tile opens a MODAL with multi-file dropzone + a per-file
//      mapping row (filename · title · doc_type · doc_subtype · remove) so
//      PBS can drop a folder-full at once and route each doc to a category
//      before commit. Prevents "I never find them again" — every uploaded
//      doc lands with its doc_type + doc_subtype set by the operator.
//   3. Translate + Summarize tiles keep single-file semantics (they need a
//      concrete file to hand to the AI step). Now bulletproof click handlers.

import { useRef, useState } from 'react';

type ActionMode = 'upload' | 'translate' | 'summarize';
type RowStatus = 'queued' | 'signing' | 'uploading' | 'ingesting' | 'done' | 'error';

interface UploadRow {
  id: string;
  file: File;
  title: string;
  doc_type: string;
  doc_subtype: string;
  status: RowStatus;
  doc_id?: string;
  error?: string;
}

// 24 allowed doc_types per the dms.documents check constraint. First entry
// is the default. Keep the labels short + operator-friendly.
const DOC_TYPES: { value: string; label: string }[] = [
  { value: 'legal',             label: 'Legal · contracts / cases' },
  { value: 'compliance',        label: 'Compliance · regulation / permits' },
  { value: 'insurance',         label: 'Insurance · policies / claims' },
  { value: 'sop',               label: 'SOP · standard procedures' },
  { value: 'qm',                label: 'QM · quality manual' },
  { value: 'brand',             label: 'Brand · guidelines / assets' },
  { value: 'template',          label: 'Template · forms' },
  { value: 'meeting_note',      label: 'Meeting note / memo' },
  { value: 'markdown',          label: 'Markdown · generic doc' },
  { value: 'kb_article',        label: 'KB article · knowledge base' },
  { value: 'vendor_doc',        label: 'Vendor doc' },
  { value: 'hr_doc',            label: 'HR · staff / payroll' },
  { value: 'guest_doc',         label: 'Guest doc' },
  { value: 'financial',         label: 'Financial · budget / invoice' },
  { value: 'recipe_doc',        label: 'Recipe' },
  { value: 'training_material', label: 'Training material' },
  { value: 'audit',             label: 'Audit / inspection' },
  { value: 'external_feed',     label: 'External feed' },
  { value: 'partner',           label: 'Partner · Hilton / SLH / vendor' },
  { value: 'presentation',      label: 'Presentation / deck' },
  { value: 'research',          label: 'Research / study' },
  { value: 'marketing',         label: 'Marketing / campaign' },
  { value: 'note',              label: 'Note' },
  { value: 'other',             label: 'Other' },
];

// -------------------------------------------------------------------------
//  Networking helpers
// -------------------------------------------------------------------------

async function signUpload(file: File): Promise<{ ok: boolean; staging_bucket?: string; staging_path?: string; signed_url?: string; error?: string }> {
  const r = await fetch('/api/docs/upload-sign', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ file_name: file.name, file_size: file.size, mime: file.type }),
  });
  const j = await r.json().catch(() => ({ ok: false, error: 'invalid sign response' }));
  return j;
}

async function ingest(payload: { staging_bucket: string; staging_path: string; file_name: string; mime: string; title?: string; doc_type?: string; doc_subtype?: string }): Promise<{ ok: boolean; doc_id?: string; error?: string }> {
  const r = await fetch('/api/docs/ingest', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const j = await r.json().catch(() => ({ ok: false, error: 'invalid ingest response' }));
  if (!r.ok || !j.ok) return { ok: false, error: j?.error || `ingest failed: ${r.status}` };
  return { ok: true, doc_id: j.doc?.doc_id ?? j.doc_id };
}

async function uploadOne(file: File, extra: { title?: string; doc_type?: string; doc_subtype?: string; onStatus?: (s: RowStatus) => void }): Promise<{ ok: boolean; doc_id?: string; error?: string }> {
  extra.onStatus?.('signing');
  const sign = await signUpload(file);
  if (!sign.ok || !sign.signed_url || !sign.staging_bucket || !sign.staging_path) {
    return { ok: false, error: sign.error || 'sign failed' };
  }
  extra.onStatus?.('uploading');
  const put = await fetch(sign.signed_url, { method: 'PUT', body: file, headers: { 'Content-Type': file.type || 'application/octet-stream' } });
  if (!put.ok) return { ok: false, error: `upload failed: ${put.status}` };
  extra.onStatus?.('ingesting');
  const ing = await ingest({
    staging_bucket: sign.staging_bucket,
    staging_path: sign.staging_path,
    file_name: file.name,
    mime: file.type,
    title: extra.title,
    doc_type: extra.doc_type,
    doc_subtype: extra.doc_subtype,
  });
  return ing;
}

// -------------------------------------------------------------------------
//  Multi-upload modal
// -------------------------------------------------------------------------

function MultiUploadModal({ onClose, onDone }: { onClose: () => void; onDone: (results: { ok: number; failed: number }) => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [rows, setRows] = useState<UploadRow[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const [busy, setBusy] = useState(false);

  const addFiles = (files: FileList | File[]) => {
    const arr = Array.from(files);
    setRows(prev => [
      ...prev,
      ...arr.map<UploadRow>(f => ({
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        file: f,
        title: f.name.replace(/\.[^.]+$/, ''),
        doc_type: DOC_TYPES[0].value,
        doc_subtype: '',
        status: 'queued',
      })),
    ]);
  };

  const patch = (id: string, p: Partial<UploadRow>) => setRows(prev => prev.map(r => r.id === id ? { ...r, ...p } : r));
  const remove = (id: string) => setRows(prev => prev.filter(r => r.id !== id));

  const uploadAll = async () => {
    if (rows.length === 0 || busy) return;
    setBusy(true);
    let ok = 0, failed = 0;
    for (const row of rows) {
      if (row.status === 'done') continue;
      const result = await uploadOne(row.file, {
        title: row.title.trim() || undefined,
        doc_type: row.doc_type,
        doc_subtype: row.doc_subtype.trim() || undefined,
        onStatus: (s) => patch(row.id, { status: s }),
      });
      if (result.ok) {
        patch(row.id, { status: 'done', doc_id: result.doc_id });
        ok++;
      } else {
        patch(row.id, { status: 'error', error: result.error });
        failed++;
      }
    }
    setBusy(false);
    onDone({ ok, failed });
  };

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 9999,
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
      }}>
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 'min(880px, 96vw)', maxHeight: '90vh', background: '#FFFFFF',
          border: '1px solid #E6DFCC', borderRadius: 10, display: 'flex', flexDirection: 'column',
          boxShadow: '0 20px 60px rgba(0,0,0,0.4)', overflow: 'hidden',
        }}>
        <header style={{ padding: '12px 18px', borderBottom: '1px solid #E6DFCC', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: 11, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#5A5A5A' }}>Bulk upload → doc registry</div>
            <div style={{ fontSize: 15, color: '#1B1B1B', fontWeight: 600 }}>Drop files, tag them, upload all</div>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{ padding: '6px 12px', fontSize: 12, background: '#FFFFFF', border: '1px solid #E6DFCC', borderRadius: 4, cursor: 'pointer' }}
          >Close ✕</button>
        </header>

        <div
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => { e.preventDefault(); setDragOver(false); if (e.dataTransfer.files?.length) addFiles(e.dataTransfer.files); }}
          style={{
            margin: 14, padding: 24,
            border: `2px dashed ${dragOver ? '#1B1B1B' : '#B8B8B8'}`,
            borderRadius: 6, background: dragOver ? '#FCFBF5' : '#FAFAF7',
            textAlign: 'center', color: '#1B1B1B',
          }}>
          <div style={{ fontSize: 24, lineHeight: 1, marginBottom: 8 }}>📥</div>
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>Drop files here</div>
          <div style={{ fontSize: 11, color: '#5A5A5A', marginBottom: 10 }}>PDF · DOCX · XLSX · images · anything up to 50 MB each</div>
          <input
            ref={inputRef}
            type="file"
            multiple
            style={{ display: 'none' }}
            onChange={(e) => { if (e.target.files?.length) addFiles(e.target.files); e.target.value = ''; }}
          />
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            style={{ padding: '8px 18px', fontSize: 12, fontWeight: 600, background: '#084838', color: '#FFFFFF', border: '1px solid #084838', borderRadius: 4, cursor: 'pointer' }}
          >Choose files…</button>
        </div>

        <div style={{ flex: 1, overflow: 'auto', padding: '0 14px' }}>
          {rows.length === 0 && (
            <div style={{ padding: 24, textAlign: 'center', fontSize: 12, color: '#8A8A8A' }}>
              No files yet — drop or choose above.
            </div>
          )}
          {rows.length > 0 && (
            <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: 0, fontSize: 12 }}>
              <thead>
                <tr style={{ background: '#F5F0E1', color: '#5A5A5A' }}>
                  <th style={th}>File</th>
                  <th style={th}>Title</th>
                  <th style={th}>Folder (doc_type)</th>
                  <th style={th}>Subtype</th>
                  <th style={{ ...th, width: 90 }}>Status</th>
                  <th style={{ ...th, width: 32 }}></th>
                </tr>
              </thead>
              <tbody>
                {rows.map(r => (
                  <tr key={r.id} style={{ borderTop: '1px solid #E6DFCC' }}>
                    <td style={td}>
                      <div style={{ fontWeight: 500, color: '#1B1B1B', wordBreak: 'break-all' }}>{r.file.name}</div>
                      <div style={{ fontSize: 10, color: '#8A8A8A', marginTop: 2 }}>{(r.file.size / 1024).toFixed(0)} KB · {r.file.type || 'unknown'}</div>
                    </td>
                    <td style={td}>
                      <input
                        value={r.title}
                        onChange={(e) => patch(r.id, { title: e.target.value })}
                        disabled={busy}
                        style={inp}
                      />
                    </td>
                    <td style={td}>
                      <select
                        value={r.doc_type}
                        onChange={(e) => patch(r.id, { doc_type: e.target.value })}
                        disabled={busy}
                        style={inp}
                      >
                        {DOC_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                      </select>
                    </td>
                    <td style={td}>
                      <input
                        value={r.doc_subtype}
                        onChange={(e) => patch(r.id, { doc_subtype: e.target.value })}
                        placeholder="(optional)"
                        disabled={busy}
                        style={inp}
                      />
                    </td>
                    <td style={{ ...td, textAlign: 'center' }}>
                      <StatusPill status={r.status} error={r.error} docId={r.doc_id} />
                    </td>
                    <td style={{ ...td, textAlign: 'center' }}>
                      {!busy && r.status !== 'done' && (
                        <button
                          type="button"
                          onClick={() => remove(r.id)}
                          title="Remove from queue"
                          style={{ background: 'transparent', border: 'none', color: '#B23A2E', cursor: 'pointer', fontSize: 14 }}
                        >×</button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <footer style={{ padding: '12px 18px', borderTop: '1px solid #E6DFCC', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#FAFAF7' }}>
          <div style={{ fontSize: 11, color: '#5A5A5A' }}>
            {rows.length} file{rows.length === 1 ? '' : 's'} queued
            {rows.filter(r => r.status === 'done').length > 0 && ` · ${rows.filter(r => r.status === 'done').length} done`}
            {rows.filter(r => r.status === 'error').length > 0 && ` · ${rows.filter(r => r.status === 'error').length} failed`}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              type="button"
              onClick={onClose}
              disabled={busy}
              style={{ padding: '8px 16px', fontSize: 12, background: '#FFFFFF', color: '#5A5A5A', border: '1px solid #E6DFCC', borderRadius: 4, cursor: busy ? 'wait' : 'pointer' }}
            >{rows.some(r => r.status === 'done') ? 'Close' : 'Cancel'}</button>
            <button
              type="button"
              onClick={uploadAll}
              disabled={busy || rows.length === 0 || rows.every(r => r.status === 'done')}
              style={{
                padding: '8px 20px', fontSize: 12, fontWeight: 600,
                background: busy || rows.length === 0 ? '#C8C0A6' : '#084838',
                color: '#FFFFFF',
                border: `1px solid ${busy || rows.length === 0 ? '#C8C0A6' : '#084838'}`,
                borderRadius: 4,
                cursor: busy || rows.length === 0 ? 'wait' : 'pointer',
              }}
            >{busy ? 'Uploading…' : `Upload all (${rows.filter(r => r.status !== 'done').length})`}</button>
          </div>
        </footer>
      </div>
    </div>
  );
}

function StatusPill({ status, error, docId }: { status: RowStatus; error?: string; docId?: string }) {
  const label = ({
    queued: 'Queued',
    signing: 'Signing…',
    uploading: 'Uploading…',
    ingesting: 'Classifying…',
    done: '✓ Done',
    error: '✗ Failed',
  })[status];
  const bg = ({
    queued: '#F5F0E1', signing: '#FBEFD9', uploading: '#FBEFD9', ingesting: '#FBEFD9',
    done: '#EBF1EE', error: '#FBE8E4',
  })[status];
  const fg = ({
    queued: '#5A5A5A', signing: '#B87F26', uploading: '#B87F26', ingesting: '#B87F26',
    done: '#1F5C2C', error: '#B23A2E',
  })[status];
  return (
    <span title={error || (docId ? `doc_id ${docId}` : undefined)}
      style={{ display: 'inline-block', padding: '2px 8px', borderRadius: 99, background: bg, color: fg, fontSize: 10, fontWeight: 600, whiteSpace: 'nowrap' }}>
      {label}
    </span>
  );
}

// -------------------------------------------------------------------------
//  Single-file tile (translate + summarize) — bulletproof click handlers
// -------------------------------------------------------------------------

function ActionTile({ mode, icon, title, hint, onFile, busy, dragOver, setDragOver, clearDragOver }: {
  mode: ActionMode;
  icon: string; title: string; hint: string;
  onFile: (file: File) => void;
  busy: boolean; dragOver: boolean;
  setDragOver: () => void; clearDragOver: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setDragOver(); }}
      onDragLeave={clearDragOver}
      onDrop={(e) => {
        e.preventDefault();
        clearDragOver();
        const f = e.dataTransfer.files?.[0];
        if (f) onFile(f);
      }}
      onClick={() => { if (!busy) inputRef.current?.click(); }}
      style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        gap: 4, padding: 12, minHeight: 84,
        border: `2px dashed ${dragOver ? '#1B1B1B' : '#B8B8B8'}`,
        borderRadius: 6, cursor: busy ? 'wait' : 'pointer',
        background: dragOver ? '#FCFBF5' : '#FFFFFF', color: '#1B1B1B',
        userSelect: 'none',
      }}>
      <input
        ref={inputRef}
        type="file"
        style={{ display: 'none' }}
        disabled={busy}
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onFile(f);
          e.target.value = '';
        }}
      />
      <div style={{ fontSize: 22, lineHeight: 1 }}>{busy ? '⏳' : icon}</div>
      <div style={{ fontWeight: 600, fontSize: 12 }}>{busy ? 'Working…' : title}</div>
      <div style={{ fontSize: 10, color: '#5A5A5A' }}>{hint} · click or drop</div>
    </div>
  );
}

// -------------------------------------------------------------------------
//  Main component
// -------------------------------------------------------------------------

export default function LegalQuickActions({ propertyId }: { propertyId: number }) {
  const [busy, setBusy] = useState<ActionMode | null>(null);
  const [dragOver, setDragOver] = useState<ActionMode | null>(null);
  const [result, setResult] = useState<{ mode: ActionMode; ok: boolean; text?: string; doc_id?: string; error?: string } | null>(null);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [batchToast, setBatchToast] = useState<{ ok: number; failed: number } | null>(null);

  async function handleSingle(mode: 'translate' | 'summarize', file: File) {
    setBusy(mode);
    setResult(null);
    try {
      const up = await uploadOne(file, {});
      if (!up.ok || !up.doc_id) { setResult({ mode, ok: false, error: up.error }); return; }
      const endpoint = mode === 'translate' ? '/api/legal/docs/translate' : '/api/legal/docs/summarize';
      const body = mode === 'translate' ? { doc_id: up.doc_id, to: 'en' } : { doc_id: up.doc_id };
      const r = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const j = await r.json().catch(() => ({ ok: false, error: 'invalid response' }));
      if (!r.ok || !j.ok) { setResult({ mode, ok: false, doc_id: up.doc_id, error: j?.error || `${r.status}` }); return; }
      const text = mode === 'translate' ? j.translation : j.summary;
      setResult({ mode, ok: true, doc_id: up.doc_id, text });
    } catch (e: any) {
      setResult({ mode, ok: false, error: e?.message ?? 'unknown error' });
    } finally {
      setBusy(null);
    }
  }

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 10 }}>
        {/* Upload doc — opens multi-file modal */}
        <div
          role="button"
          tabIndex={0}
          onClick={() => setUploadOpen(true)}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setUploadOpen(true); } }}
          style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            gap: 4, padding: 12, minHeight: 84,
            border: '2px dashed #B8B8B8', borderRadius: 6, cursor: 'pointer',
            background: '#FFFFFF', color: '#1B1B1B', userSelect: 'none',
          }}>
          <div style={{ fontSize: 22, lineHeight: 1 }}>📤</div>
          <div style={{ fontWeight: 600, fontSize: 12 }}>Upload doc</div>
          <div style={{ fontSize: 10, color: '#5A5A5A' }}>Multi-file · pick folder each · click to open</div>
        </div>

        <ActionTile
          mode="translate"
          icon="🌐"
          title="Translate to English"
          hint="Drop Lao / Thai / fr / es"
          busy={busy === 'translate'}
          dragOver={dragOver === 'translate'}
          onFile={(f) => handleSingle('translate', f)}
          setDragOver={() => setDragOver('translate')}
          clearDragOver={() => setDragOver(null)}
        />
        <ActionTile
          mode="summarize"
          icon="✍️"
          title="Summarize"
          hint="4–6 line counsel brief"
          busy={busy === 'summarize'}
          dragOver={dragOver === 'summarize'}
          onFile={(f) => handleSingle('summarize', f)}
          setDragOver={() => setDragOver('summarize')}
          clearDragOver={() => setDragOver(null)}
        />
        <a href={`/h/${propertyId}/it/cockpit/chat/legal_specialist`} style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          padding: 12, border: '1px solid #1B1B1B', borderRadius: 6,
          background: '#1B1B1B', color: '#FFFFFF', textDecoration: 'none', fontSize: 12,
        }}>
          💬 Chat with John (Lao counsel)
        </a>
      </div>

      {batchToast && (
        <div style={{
          marginTop: 10, padding: 10,
          background: batchToast.failed === 0 ? '#EBF1EE' : '#FBEFD9',
          color: batchToast.failed === 0 ? '#1F5C2C' : '#B87F26',
          border: '1px solid ' + (batchToast.failed === 0 ? '#B9E0C7' : '#F0DEB0'),
          borderRadius: 4, fontSize: 12,
        }}>
          Batch upload: <strong>{batchToast.ok} succeeded</strong>
          {batchToast.failed > 0 && <> · <strong style={{ color: '#B23A2E' }}>{batchToast.failed} failed</strong></>}
          {' '}· <a href="/finance/legal/docs" style={{ color: '#084838', fontWeight: 600 }}>open doc register →</a>
          <button type="button" onClick={() => setBatchToast(null)} style={{ marginLeft: 10, background: 'transparent', border: 'none', cursor: 'pointer', color: 'inherit', fontSize: 11 }}>dismiss</button>
        </div>
      )}

      {result && (
        <div style={{
          marginTop: 10, padding: 12,
          border: `1px solid ${result.ok ? '#1B1B1B' : '#C62828'}`,
          background: result.ok ? '#FCFBF5' : '#FDECEC',
          borderRadius: 4, fontSize: 12, color: '#1B1B1B',
        }}>
          <div style={{ fontWeight: 600, marginBottom: 6 }}>
            {result.ok ? '✓ done' : '✗ failed'} · {result.mode}
            {result.doc_id && (
              <a href={`/legal/docs/preview/${encodeURIComponent(result.doc_id)}`}
                 target="_blank" rel="noopener noreferrer"
                 style={{ marginLeft: 10, color: '#1B1B1B', fontSize: 11 }}>
                open doc →
              </a>
            )}
          </div>
          {result.error && <pre style={{ color: '#C62828', whiteSpace: 'pre-wrap', margin: 0, fontSize: 11 }}>{result.error}</pre>}
          {result.text && (
            <pre style={{ whiteSpace: 'pre-wrap', margin: 0, fontFamily: 'inherit', fontSize: 12, lineHeight: 1.4, maxHeight: 320, overflow: 'auto' }}>{result.text}</pre>
          )}
        </div>
      )}

      {uploadOpen && (
        <MultiUploadModal
          onClose={() => setUploadOpen(false)}
          onDone={(res) => setBatchToast(res)}
        />
      )}
    </div>
  );
}

const th: React.CSSProperties = { padding: '8px 6px', textAlign: 'left', fontWeight: 600, fontSize: 10, letterSpacing: '0.08em', textTransform: 'uppercase' };
const td: React.CSSProperties = { padding: '8px 6px', verticalAlign: 'top' };
const inp: React.CSSProperties = { width: '100%', padding: '6px 8px', fontSize: 12, background: '#FFFFFF', border: '1px solid #E6DFCC', borderRadius: 3, color: '#1B1B1B' };
