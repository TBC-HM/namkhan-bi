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

import { useEffect, useRef, useState } from 'react';

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

function MultiUploadModal({ onClose, onDone, initialFiles }: { onClose: () => void; onDone: (results: { ok: number; failed: number }) => void; initialFiles?: File[] }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [rows, setRows] = useState<UploadRow[]>([]);
  // Pre-populate from drag-and-drop on the tile
  useEffect(() => {
    if (initialFiles && initialFiles.length > 0) addFiles(initialFiles);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const [dragOver, setDragOver] = useState(false);
  const [busy, setBusy] = useState(false);

  function addFiles(files: File[]) {
    const newRows: UploadRow[] = files.map(f => ({
      id: Math.random().toString(36).slice(2),
      file: f,
      title: f.name.replace(/\.[^.]+$/, ''),
      doc_type: DOC_TYPES[0].value, // default = legal
      doc_subtype: '',
      status: 'queued',
    }));
    setRows(prev => [...prev, ...newRows]);
  }

  function updateRow(id: string, patch: Partial<UploadRow>) {
    setRows(prev => prev.map(r => r.id === id ? { ...r, ...patch } : r));
  }

  function removeRow(id: string) {
    setRows(prev => prev.filter(r => r.id !== id));
  }

  async function doUpload() {
    if (busy) return;
    setBusy(true);
    let ok = 0; let failed = 0;
    for (const row of rows) {
      if (row.status === 'done' || row.status === 'error') continue;
      try {
        updateRow(row.id, { status: 'signing' });
        const res = await uploadOne(row.file, {
          title: row.title,
          doc_type: row.doc_type,
          doc_subtype: row.doc_subtype || undefined,
          onStatus: (s) => updateRow(row.id, { status: s }),
        });
        if (res.ok) {
          updateRow(row.id, { status: 'done', doc_id: res.doc_id });
          ok++;
        } else {
          updateRow(row.id, { status: 'error', error: res.error });
          failed++;
        }
      } catch (e: any) {
        updateRow(row.id, { status: 'error', error: e?.message ?? 'unknown error' });
        failed++;
      }
    }
    setBusy(false);
    onDone({ ok, failed });
  }

  const allDone = rows.length > 0 && rows.every(r => r.status === 'done' || r.status === 'error');

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }}>
      <div style={{ background: '#FFF', borderRadius: 8, boxShadow: '0 4px 12px rgba(0,0,0,0.15)', maxWidth: 900, width: '90%', maxHeight: '80vh', display: 'flex', flexDirection: 'column' }}>
        {/* Header */}
        <div style={{ borderBottom: '1px solid #E0E0E0', padding: '14px 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ fontSize: 15, fontWeight: 600, color: '#1B1B1B' }}>Upload documents</div>
          <button onClick={onClose} style={{ border: 'none', background: 'transparent', fontSize: 20, cursor: 'pointer', color: '#5A5A5A' }}>×</button>
        </div>

        {/* Body: dropzone + table */}
        <div style={{ flex: 1, overflowY: 'auto', padding: 18 }}>
          {/* Dropzone */}
          <div
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => { e.preventDefault(); setDragOver(false); addFiles(Array.from(e.dataTransfer.files)); }}
            onClick={() => inputRef.current?.click()}
            style={{
              border: `2px dashed ${dragOver ? '#084838' : '#E6DFCC'}`,
              borderRadius: 6,
              padding: '20px 16px',
              textAlign: 'center',
              cursor: 'pointer',
              background: dragOver ? '#E8F1EE' : '#F4EFE2',
              marginBottom: 16,
              transition: 'all .15s',
            }}
          >
            <div style={{ fontSize: 24, marginBottom: 4 }}>📄</div>
            <div style={{ fontSize: 12, color: '#1B1B1B' }}>Drag & drop files here, or click to browse</div>
            <div style={{ fontSize: 10, color: '#5A5A5A', marginTop: 2 }}>PDF · DOCX · XLSX · TXT · and more</div>
            <input ref={inputRef} type="file" accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.ods" multiple style={{ display: 'none' }}
              onChange={(e) => addFiles(Array.from(e.target.files ?? []))} />
          </div>

          {/* Table */}
          {rows.length > 0 && (
            <div style={{ border: '1px solid #E0E0E0', borderRadius: 6, overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead>
                  <tr style={{ background: '#F4EFE2', borderBottom: '1px solid #E0E0E0' }}>
                    <th style={{ padding: '8px 10px', textAlign: 'left', fontWeight: 600 }}>File</th>
                    <th style={{ padding: '8px 10px', textAlign: 'left', fontWeight: 600 }}>Title</th>
                    <th style={{ padding: '8px 10px', textAlign: 'left', fontWeight: 600 }}>Doc type</th>
                    <th style={{ padding: '8px 10px', textAlign: 'left', fontWeight: 600 }}>Subtype</th>
                    <th style={{ padding: '8px 10px', textAlign: 'center', fontWeight: 600 }}>Status</th>
                    <th style={{ padding: '8px 10px', textAlign: 'center', fontWeight: 600, width: 50 }}></th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map(r => (
                    <tr key={r.id} style={{ borderBottom: '1px solid #E0E0E0' }}>
                      <td style={{ padding: '8px 10px', fontSize: 11, color: '#5A5A5A', maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={r.file.name}>{r.file.name}</td>
                      <td style={{ padding: '8px 10px' }}>
                        <input
                          type="text"
                          value={r.title}
                          onChange={(e) => updateRow(r.id, { title: e.target.value })}
                          disabled={r.status !== 'queued'}
                          style={{ width: '100%', border: '1px solid #E0E0E0', borderRadius: 3, padding: '4px 6px', fontSize: 12 }}
                        />
                      </td>
                      <td style={{ padding: '8px 10px' }}>
                        <select
                          value={r.doc_type}
                          onChange={(e) => updateRow(r.id, { doc_type: e.target.value })}
                          disabled={r.status !== 'queued'}
                          style={{ width: '100%', border: '1px solid #E0E0E0', borderRadius: 3, padding: '4px 6px', fontSize: 11 }}
                        >
                          {DOC_TYPES.map(dt => <option key={dt.value} value={dt.value}>{dt.label}</option>)}
                        </select>
                      </td>
                      <td style={{ padding: '8px 10px' }}>
                        <input
                          type="text"
                          value={r.doc_subtype}
                          onChange={(e) => updateRow(r.id, { doc_subtype: e.target.value })}
                          disabled={r.status !== 'queued'}
                          placeholder="(optional)"
                          style={{ width: '100%', border: '1px solid #E0E0E0', borderRadius: 3, padding: '4px 6px', fontSize: 12 }}
                        />
                      </td>
                      <td style={{ padding: '8px 10px', textAlign: 'center', fontSize: 11 }}>
                        {r.status === 'queued' && '⏳'}
                        {r.status === 'signing' && '🔑'}
                        {r.status === 'uploading' && '⬆️'}
                        {r.status === 'ingesting' && '🧠'}
                        {r.status === 'done' && <span style={{ color: '#0E7A4B' }}>✓</span>}
                        {r.status === 'error' && <span style={{ color: '#B03826', fontSize: 9 }} title={r.error}>✗ {r.error}</span>}
                      </td>
                      <td style={{ padding: '8px 10px', textAlign: 'center' }}>
                        {r.status === 'queued' && (
                          <button onClick={() => removeRow(r.id)} style={{ border: 'none', background: 'transparent', fontSize: 14, cursor: 'pointer', color: '#B03826' }}>×</button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ borderTop: '1px solid #E0E0E0', padding: '12px 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ fontSize: 11, color: '#5A5A5A' }}>
            {rows.length === 0 && 'No files yet — drop or browse to add'}
            {rows.length > 0 && !allDone && `${rows.length} file${rows.length === 1 ? '' : 's'} queued`}
            {allDone && `${rows.filter(r => r.status === 'done').length} uploaded · ${rows.filter(r => r.status === 'error').length} failed`}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            {!allDone && (
              <>
                <button onClick={onClose} disabled={busy} style={{ padding: '6px 12px', fontSize: 12, border: '1px solid #E0E0E0', borderRadius: 4, background: '#FFF', cursor: busy ? 'not-allowed' : 'pointer', opacity: busy ? 0.5 : 1 }}>Cancel</button>
                <button onClick={doUpload} disabled={busy || rows.length === 0} style={{ padding: '6px 12px', fontSize: 12, border: 'none', borderRadius: 4, background: '#084838', color: '#FFF', cursor: (busy || rows.length === 0) ? 'not-allowed' : 'pointer', opacity: (busy || rows.length === 0) ? 0.5 : 1 }}>
                  {busy ? 'Uploading…' : 'Upload all'}
                </button>
              </>
            )}
            {allDone && (
              <button onClick={onClose} style={{ padding: '6px 12px', fontSize: 12, border: 'none', borderRadius: 4, background: '#084838', color: '#FFF', cursor: 'pointer' }}>Done</button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// -------------------------------------------------------------------------
//  Main component
// -------------------------------------------------------------------------

export default function LegalQuickActions() {
  const translateInput = useRef<HTMLInputElement>(null);
  const summarizeInput = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState<ActionMode | null>(null);
  const [result, setResult] = useState<{ mode: ActionMode; ok: boolean; doc_id?: string; text?: string; error?: string } | null>(null);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [tileDragOver, setTileDragOver] = useState(false);
  const [tileDragFiles, setTileDragFiles] = useState<File[]>([]);

  async function handleSingle(mode: 'translate' | 'summarize', file: File) {
    setBusy(mode);
    setResult(null);
    try {
      const up = await uploadOne(file, { doc_type: 'legal', title: file.name.replace(/\.[^.]+$/, '') });
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
          onDragOver={(e) => { e.preventDefault(); setTileDragOver(true); }}
          onDragLeave={() => setTileDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setTileDragOver(false);
            const files = Array.from(e.dataTransfer.files);
            setTileDragFiles(files);
            setUploadOpen(true);
          }}
          style={{
            border: `2px solid ${tileDragOver ? '#084838' : '#E6DFCC'}`,
            borderRadius: 6,
            padding: 16,
            background: tileDragOver ? '#E8F1EE' : '#FFFFFF',
            cursor: 'pointer',
            transition: 'all .15s',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            textAlign: 'center',
            minHeight: 120,
          }}
        >
          <div style={{ fontSize: 32, marginBottom: 8 }}>📄</div>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#1B1B1B', marginBottom: 4 }}>Upload doc</div>
          <div style={{ fontSize: 11, color: '#5A5A5A' }}>Multi-file upload with doc-type mapping</div>
        </div>

        {/* Translate doc */}
        <div
          role="button"
          tabIndex={0}
          onClick={() => translateInput.current?.click()}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); translateInput.current?.click(); } }}
          style={{
            border: '2px solid #E6DFCC',
            borderRadius: 6,
            padding: 16,
            background: '#FFFFFF',
            cursor: busy === 'translate' ? 'not-allowed' : 'pointer',
            opacity: busy === 'translate' ? 0.6 : 1,
            transition: 'all .15s',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            textAlign: 'center',
            minHeight: 120,
          }}
        >
          <div style={{ fontSize: 32, marginBottom: 8 }}>🌐</div>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#1B1B1B', marginBottom: 4 }}>Translate</div>
          <div style={{ fontSize: 11, color: '#5A5A5A' }}>Lao → EN with Claude</div>
          <input
            ref={translateInput}
            type="file"
            accept=".pdf,.doc,.docx"
            style={{ display: 'none' }}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleSingle('translate', file);
              e.target.value = '';
            }}
          />
        </div>

        {/* Summarize doc */}
        <div
          role="button"
          tabIndex={0}
          onClick={() => summarizeInput.current?.click()}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); summarizeInput.current?.click(); } }}
          style={{
            border: '2px solid #E6DFCC',
            borderRadius: 6,
            padding: 16,
            background: '#FFFFFF',
            cursor: busy === 'summarize' ? 'not-allowed' : 'pointer',
            opacity: busy === 'summarize' ? 0.6 : 1,
            transition: 'all .15s',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            textAlign: 'center',
            minHeight: 120,
          }}
        >
          <div style={{ fontSize: 32, marginBottom: 8 }}>📝</div>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#1B1B1B', marginBottom: 4 }}>Summarize</div>
          <div style={{ fontSize: 11, color: '#5A5A5A' }}>4-6 line summary with Claude</div>
          <input
            ref={summarizeInput}
            type="file"
            accept=".pdf,.doc,.docx"
            style={{ display: 'none' }}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleSingle('summarize', file);
              e.target.value = '';
            }}
          />
        </div>
      </div>

      {/* Result banner */}
      {result && (
        <div style={{
          marginTop: 16,
          padding: 12,
          borderRadius: 6,
          background: result.ok ? '#E8F1EE' : '#F8E8E6',
          border: `1px solid ${result.ok ? '#0E7A4B' : '#B03826'}`,
        }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: result.ok ? '#0E7A4B' : '#B03826', marginBottom: 4 }}>
            {result.ok ? `${result.mode === 'translate' ? 'Translation' : 'Summary'} complete` : 'Error'}
          </div>
          {result.ok && result.text && (
            <div style={{ fontSize: 11, color: '#1B1B1B', lineHeight: 1.5, maxHeight: 120, overflowY: 'auto', whiteSpace: 'pre-wrap' }}>
              {result.text}
            </div>
          )}
          {!result.ok && result.error && (
            <div style={{ fontSize: 11, color: '#5A5A5A' }}>{result.error}</div>
          )}
          {result.doc_id && (
            <div style={{ fontSize: 10, color: '#5A5A5A', marginTop: 6 }}>
              Doc ID: <code style={{ background: '#FFF', padding: '1px 4px', borderRadius: 2 }}>{result.doc_id}</code>
            </div>
          )}
        </div>
      )}

      {uploadOpen && (
        <MultiUploadModal
          onClose={() => { setUploadOpen(false); setTileDragFiles([]); }}
          onDone={(res) => {
            setUploadOpen(false);
            setTileDragFiles([]);
            // Optionally show a toast here
          }}
          initialFiles={tileDragFiles.length > 0 ? tileDragFiles : undefined}
        />
      )}
    </div>
  );
}
