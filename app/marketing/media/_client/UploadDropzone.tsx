// app/marketing/media/_client/UploadDropzone.tsx
// PBS 2026-07-12 — drag+drop upload using existing sign+finalize endpoints.
// 2026-07-12 pm: accept images + videos + PDF. Filename-extension MIME fallback so files
//   dropped without a browser MIME still get the right content_type sent to sign endpoint.
'use client';

import { useState, useRef } from 'react';

interface Props { onResult?: (msg: string) => void }

const HAIR   = '#E6DFCC';
const INK    = '#1B1B1B';
const INK_M  = '#5A5A5A';
const FOREST = '#084838';

// Filename-extension → MIME. Used when the browser doesn't set File.type
// (RAW files often; some drag-drops from external tools; older browsers).
const EXT_MIME: Record<string, string> = {
  // Photos
  jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp',
  heic: 'image/heic', heif: 'image/heif', gif: 'image/gif', tif: 'image/tiff', tiff: 'image/tiff',
  // RAW
  cr2: 'image/x-canon-cr2', cr3: 'image/x-canon-cr3', nef: 'image/x-nikon-nef',
  arw: 'image/x-sony-arw', dng: 'image/x-adobe-dng', raf: 'image/x-fuji-raf', rw2: 'image/x-panasonic-rw2',
  // Video
  mp4: 'video/mp4', m4v: 'video/x-m4v', mov: 'video/quicktime', webm: 'video/webm',
  avi: 'video/x-msvideo', mkv: 'video/x-matroska', mpeg: 'video/mpeg', mpg: 'video/mpeg',
  '3gp': 'video/3gpp', ts: 'video/mp2t', mxf: 'application/mxf',
  // Documents
  pdf: 'application/pdf',
};

function guessMime(file: File): string {
  if (file.type) return file.type;
  const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
  return EXT_MIME[ext] ?? 'application/octet-stream';
}

async function sha256hex(file: File): Promise<string> {
  const buf = await file.arrayBuffer();
  const hash = await crypto.subtle.digest('SHA-256', buf);
  return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('');
}

export default function UploadDropzone({ onResult }: Props) {
  const [busy, setBusy] = useState(false);
  const [prog, setProg] = useState<string | null>(null);
  const [drag, setDrag] = useState(false);
  const [errs, setErrs] = useState<string[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleFiles(files: FileList | File[]) {
    const list = Array.from(files);
    if (!list.length) return;
    setBusy(true);
    setErrs([]);
    setProg(`Preparing ${list.length} file${list.length===1?'':'s'}…`);
    let ok = 0, fail = 0, dup = 0;
    const failMessages: string[] = [];
    for (const f of list) {
      try {
        const mime = guessMime(f);
        setProg(`Hashing ${f.name}…`);
        const sha = await sha256hex(f);
        setProg(`Signing ${f.name}…`);
        const signRes = await fetch('/api/marketing/upload-sign', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ filename: f.name, content_type: mime, size: f.size, sha256: sha }),
        });
        const signJson = await signRes.json();
        if (!signRes.ok) {
          fail++;
          failMessages.push(`${f.name}: ${signJson.error ?? signRes.statusText}${signJson.content_type ? ` (${signJson.content_type})` : ''}`);
          continue;
        }
        if (signJson.duplicate) { dup++; continue; }
        setProg(`Uploading ${f.name}…`);
        const putRes = await fetch(signJson.upload_url, { method: 'PUT', body: f, headers: { 'Content-Type': mime } });
        if (!putRes.ok) {
          fail++;
          failMessages.push(`${f.name}: storage PUT failed (${putRes.status})`);
          continue;
        }
        setProg(`Finalizing ${f.name}…`);
        await fetch('/api/marketing/upload-finalize', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ asset_id: signJson.asset_id }),
        });
        ok++;
      } catch (e: any) {
        fail++;
        failMessages.push(`${f.name}: ${e.message ?? 'exception'}`);
      }
    }
    const summary = `Upload complete — ${ok} ok · ${dup} duplicate · ${fail} failed`;
    setProg(summary);
    setErrs(failMessages);
    onResult?.(summary);
    setBusy(false);
    setTimeout(() => { setProg(null); setErrs([]); }, 12000);
  }

  return (
    <div>
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
        <input ref={inputRef} type="file" multiple accept="image/*,video/*,application/pdf,image/x-adobe-dng,image/x-canon-cr2,image/x-canon-cr3,image/x-nikon-nef,image/x-sony-arw,image/x-fuji-raf,image/x-panasonic-rw2" style={{ display:'none' }}
          onChange={e => e.target.files && handleFiles(e.target.files)} />
        <div style={{ fontSize:14, color:INK, fontWeight:600, marginBottom:6 }}>
          {busy ? 'Uploading…' : 'Drag files here or click to browse'}
        </div>
        <div style={{ fontSize:11, color:INK_M }}>
          {prog ?? 'Photos · Videos · RAW · PDF flyers — up to 5 GB each'}
        </div>
      </div>
      {errs.length > 0 && (
        <div style={{ marginTop:8, fontSize:11, color:'#B23A2E', background:'#FDECEA', border:'1px solid #F5C6C4', borderRadius:4, padding:'6px 10px' }}>
          {errs.map((e, i) => <div key={i}>× {e}</div>)}
        </div>
      )}
    </div>
  );
}
