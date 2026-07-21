'use client';
// app/marketing/audience/_components/LeadDropbox.tsx
// PBS 2026-07-21 · Compact upload-new-leads dropbox above KPI tiles.
// Accepts: .csv .xlsx .xls .numbers .pdf .doc .docx .txt
// POSTs multipart to /api/marketing/audience/import-leads.
// Route uses Claude to extract email/name/company/phone/source-hint from the
// mess and upserts into marketing.imported_leads_staging for PBS review.

import { useCallback, useRef, useState } from 'react';

const WHITE = '#FFFFFF';
const HAIR  = '#E6DFCC';
const INK   = '#1B1B1B';
const INK_S = '#5A5A5A';
const BRAND = '#084838';
const RED   = '#B03826';
const WARM  = '#F5F0E1';

const ACCEPT = '.csv,.xlsx,.xls,.numbers,.pdf,.doc,.docx,.txt';

type State = 'idle' | 'uploading' | 'done' | 'error';

export default function LeadDropbox() {
  const [state, setState] = useState<State>('idle');
  const [msg, setMsg]     = useState<string>('');
  const [hover, setHover] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const upload = useCallback(async (file: File) => {
    setState('uploading');
    setMsg(`Uploading ${file.name}…`);
    const form = new FormData();
    form.append('file', file);
    try {
      const r = await fetch('/api/marketing/audience/import-leads', {
        method: 'POST',
        body: form,
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok || !j.ok) {
        setState('error');
        setMsg('Failed: ' + (j?.error ?? r.statusText));
        return;
      }
      setState('done');
      setMsg(`Parsed ${j.rows_found ?? 0} rows · ${j.rows_upserted ?? 0} staged for review.`);
    } catch (e) {
      setState('error');
      setMsg('Upload error: ' + ((e as Error).message ?? 'unknown'));
    }
  }, []);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); e.stopPropagation(); setHover(false);
    const f = e.dataTransfer?.files?.[0];
    if (f) upload(f);
  }, [upload]);

  const onPick = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) upload(f);
    e.target.value = '';
  }, [upload]);

  const border = state === 'error' ? RED : (hover ? BRAND : HAIR);
  const bg     = state === 'done' ? '#EEF7F0' : (hover ? WARM : WHITE);

  return (
    <div
      onDrop={onDrop}
      onDragEnter={(e) => { e.preventDefault(); setHover(true); }}
      onDragOver={(e)  => { e.preventDefault(); setHover(true); }}
      onDragLeave={(e) => { e.preventDefault(); setHover(false); }}
      style={{
        border: `1px dashed ${border}`, borderRadius: 4, padding: '10px 14px',
        background: bg, display: 'flex', alignItems: 'center', gap: 12,
        fontSize: 12, color: INK,
      }}
    >
      <div style={{ flex: '0 0 auto', fontSize: 20, color: BRAND }}>+</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 600 }}>Upload new leads</div>
        <div style={{ fontSize: 11, color: INK_S }}>
          Drop <code>.csv .xlsx .xls .numbers .pdf .doc .docx .txt</code> — Claude will extract email + name + company + phone into the staging queue.
        </div>
        {msg && (
          <div style={{
            marginTop: 4, fontSize: 11,
            color: state === 'error' ? RED : (state === 'done' ? BRAND : INK_S),
          }}>{msg}</div>
        )}
      </div>
      <button
        onClick={() => inputRef.current?.click()}
        disabled={state === 'uploading'}
        style={{
          padding: '6px 12px', border: `1px solid ${BRAND}`, background: WHITE,
          color: BRAND, borderRadius: 3, fontSize: 12, cursor: 'pointer',
          opacity: state === 'uploading' ? 0.6 : 1,
        }}
      >{state === 'uploading' ? 'Uploading…' : 'Browse'}</button>
      <input
        ref={inputRef} type="file" accept={ACCEPT} onChange={onPick}
        style={{ display: 'none' }}
      />
    </div>
  );
}
