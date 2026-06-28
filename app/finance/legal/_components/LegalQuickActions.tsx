'use client';
// app/finance/legal/_components/LegalQuickActions.tsx
// Client island for the /finance/legal landing action bar:
//   1. Upload a doc       → /api/docs/upload-sign + /api/docs/ingest
//                           (full Triage Register flow; auto-classifies)
//   2. Drop to translate  → upload-sign + ingest → /api/legal/docs/translate
//   3. Drop to summarize  → same ingest → /api/legal/docs/summarize
// All three flows return inline results below the action area so the user
// doesn't lose context navigating away.

import { useState } from 'react';

type ActionMode = 'upload' | 'translate' | 'summarize';

interface IngestResult {
  ok: boolean;
  doc_id?: string;
  title?: string;
  error?: string;
}

async function uploadAndIngest(file: File): Promise<IngestResult> {
  // Step 1 — signed upload URL
  const sign = await fetch('/api/docs/upload-sign', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ file_name: file.name, file_size: file.size, mime: file.type }),
  }).then((r) => r.json());
  if (!sign?.ok) return { ok: false, error: sign?.error || 'sign failed' };

  // Step 2 — direct PUT to Supabase Storage
  const put = await fetch(sign.signed_url, { method: 'PUT', body: file, headers: { 'Content-Type': file.type || 'application/octet-stream' } });
  if (!put.ok) return { ok: false, error: `upload failed: ${put.status}` };

  // Step 3 — ingest (classification + dms.documents row)
  const fd = new FormData();
  fd.append('file_name', file.name);
  fd.append('staging_bucket', sign.staging_bucket);
  fd.append('staging_path', sign.staging_path);
  const ing = await fetch('/api/docs/ingest', { method: 'POST', body: fd });
  const j = await ing.json().catch(() => ({ ok: false, error: 'invalid ingest response' }));
  if (!ing.ok || !j.ok) return { ok: false, error: j?.error || `ingest failed: ${ing.status}` };
  return { ok: true, doc_id: j.doc_id, title: j.title };
}

export default function LegalQuickActions({ propertyId }: { propertyId: number }) {
  const [busy, setBusy] = useState<ActionMode | null>(null);
  const [dragOver, setDragOver] = useState<ActionMode | null>(null);
  const [result, setResult] = useState<{ mode: ActionMode; ok: boolean; text?: string; doc_id?: string; error?: string } | null>(null);

  async function handle(mode: ActionMode, file: File) {
    setBusy(mode);
    setResult(null);
    try {
      const up = await uploadAndIngest(file);
      if (!up.ok || !up.doc_id) { setResult({ mode, ok: false, error: up.error }); return; }

      if (mode === 'upload') {
        setResult({ mode, ok: true, doc_id: up.doc_id, text: up.title ?? file.name });
        return;
      }

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

  function onDrop(mode: ActionMode, e: React.DragEvent<HTMLLabelElement>) {
    e.preventDefault();
    setDragOver(null);
    const f = e.dataTransfer.files?.[0];
    if (f) handle(mode, f);
  }

  function onPick(mode: ActionMode, e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (f) handle(mode, f);
    e.target.value = '';
  }

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 10 }}>
        <DropTile
          mode="upload"
          icon="📤"
          title="Upload doc"
          hint="Classify + ingest"
          busy={busy === 'upload'}
          dragOver={dragOver === 'upload'}
          onPick={(e) => onPick('upload', e)}
          onDrop={(e) => onDrop('upload', e)}
          setDragOver={() => setDragOver('upload')}
          clearDragOver={() => setDragOver(null)}
        />
        <DropTile
          mode="translate"
          icon="🌐"
          title="Translate to English"
          hint="Drop Lao / Thai / fr / es"
          busy={busy === 'translate'}
          dragOver={dragOver === 'translate'}
          onPick={(e) => onPick('translate', e)}
          onDrop={(e) => onDrop('translate', e)}
          setDragOver={() => setDragOver('translate')}
          clearDragOver={() => setDragOver(null)}
        />
        <DropTile
          mode="summarize"
          icon="✍️"
          title="Summarize"
          hint="4–6 line counsel brief"
          busy={busy === 'summarize'}
          dragOver={dragOver === 'summarize'}
          onPick={(e) => onPick('summarize', e)}
          onDrop={(e) => onDrop('summarize', e)}
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
    </div>
  );
}

function DropTile({ mode, icon, title, hint, busy, dragOver, onPick, onDrop, setDragOver, clearDragOver }: {
  mode: ActionMode;
  icon: string; title: string; hint: string;
  busy: boolean; dragOver: boolean;
  onPick: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onDrop: (e: React.DragEvent<HTMLLabelElement>) => void;
  setDragOver: () => void; clearDragOver: () => void;
}) {
  return (
    <label
      onDragOver={(e) => { e.preventDefault(); setDragOver(); }}
      onDragLeave={clearDragOver}
      onDrop={onDrop}
      style={{
        position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        gap: 4, padding: 12, minHeight: 84,
        border: `2px dashed ${dragOver ? '#1B1B1B' : '#B8B8B8'}`,
        borderRadius: 6, cursor: busy ? 'wait' : 'pointer',
        background: dragOver ? '#FCFBF5' : '#FFFFFF', color: '#1B1B1B',
        transition: 'border-color 120ms',
      }}>
      <input type="file" hidden onChange={onPick} disabled={busy} />
      <div style={{ fontSize: 22, lineHeight: 1 }}>{busy ? '⏳' : icon}</div>
      <div style={{ fontWeight: 600, fontSize: 12 }}>{busy ? `Working…` : title}</div>
      <div style={{ fontSize: 10, color: '#5A5A5A' }}>{hint} · click or drop</div>
    </label>
  );
}
