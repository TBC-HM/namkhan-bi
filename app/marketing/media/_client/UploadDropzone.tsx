// app/marketing/media/_client/UploadDropzone.tsx
// PBS 2026-07-12 — drag+drop upload using existing sign+finalize endpoints.
'use client';

import { useState, useRef } from 'react';

interface Props { onResult?: (msg: string) => void }

const HAIR   = '#E6DFCC';
const INK    = '#1B1B1B';
const INK_M  = '#5A5A5A';
const FOREST = '#084838';

async function sha256hex(file: File): Promise<string> {
  const buf = await file.arrayBuffer();
  const hash = await crypto.subtle.digest('SHA-256', buf);
  return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('');
}

export default function UploadDropzone({ onResult }: Props) {
  const [busy, setBusy] = useState(false);
  const [prog, setProg] = useState<string | null>(null);
  const [drag, setDrag] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleFiles(files: FileList | File[]) {
    const list = Array.from(files);
    if (!list.length) return;
    setBusy(true);
    setProg(`Preparing ${list.length} file${list.length===1?'':'s'}…`);
    let ok = 0, fail = 0, dup = 0;
    for (const f of list) {
      try {
        setProg(`Hashing ${f.name}…`);
        const sha = await sha256hex(f);
        setProg(`Signing ${f.name}…`);
        const signRes = await fetch('/api/marketing/upload-sign', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ filename: f.name, content_type: f.type || 'image/jpeg', size: f.size, sha256: sha }),
        });
        const signJson = await signRes.json();
        if (!signRes.ok) { fail++; continue; }
        if (signJson.duplicate) { dup++; continue; }
        setProg(`Uploading ${f.name}…`);
        const putRes = await fetch(signJson.upload_url, { method: 'PUT', body: f, headers: { 'Content-Type': f.type || 'image/jpeg' } });
        if (!putRes.ok) { fail++; continue; }
        setProg(`Finalizing ${f.name}…`);
        await fetch('/api/marketing/upload-finalize', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ asset_id: signJson.asset_id }),
        });
        ok++;
      } catch { fail++; }
    }
    const summary = `Upload complete — ${ok} ok · ${dup} duplicate · ${fail} failed`;
    setProg(summary);
    onResult?.(summary);
    setBusy(false);
    setTimeout(() => setProg(null), 5000);
  }

  return (
    <div
      onDragOver={e => { e.preventDefault(); setDrag(true); }}
      onDragLeave={() => setDrag(false)}
      onDrop={e => { e.preventDefault(); setDrag(false); handleFiles(e.dataTransfer.files); }}
      style={{
        border:'2px dashed ' + (drag ? FOREST : HAIR),
        borderRadius:6, padding:'32px 16px', textAlign:'center',
        background: drag ? '#F7F0E1' : '#FFFFFF', cursor:'pointer',
      }}
      onClick={() => inputRef.current?.click()}
    >
      <input ref={inputRef} type="file" multiple accept="image/*" style={{ display:'none' }}
        onChange={e => e.target.files && handleFiles(e.target.files)} />
      <div style={{ fontSize:14, color:INK, fontWeight:600, marginBottom:6 }}>
        {busy ? 'Uploading…' : 'Drag photos here or click to browse'}
      </div>
      <div style={{ fontSize:11, color:INK_M }}>
        {prog ?? 'JPEG · PNG · HEIC · WEBP · RAW/DNG · up to 500 MB each'}
      </div>
    </div>
  );
}
