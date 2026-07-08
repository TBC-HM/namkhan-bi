'use client';

// components/marketing/LibraryDropZone.tsx
//
// PBS 2026-05-16 fix: switched from /api/marketing/upload (Vercel-hosted,
// 4.5 MB body cap) to the signed-URL flow:
//   1. POST /api/marketing/upload-sign  → { upload_url, asset_id, raw_path }
//   2. PUT file directly to Supabase Storage (bypasses Vercel entirely)
//   3. POST /api/marketing/upload-finalize → confirm + tag
//
// Phone photos (10-30 MB) now upload cleanly. Bucket cap = 500 MB.

import { useCallback, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import TenantLink from '@/components/nav/TenantLink';
interface QueueItem {
  id: string;
  name: string;
  size: number;
  status: 'queued' | 'hashing' | 'signing' | 'uploading' | 'finalizing' | 'done' | 'duplicate' | 'error';
  msg?: string;
  pct?: number;
}

const ALLOWED_MIMES = new Set([
  'image/jpeg', 'image/png', 'image/heic', 'image/heif', 'image/webp',
  'image/x-canon-cr2', 'image/x-nikon-nef', 'image/x-sony-arw', 'image/x-adobe-dng',
]);

async function sha256Hex(file: File): Promise<string> {
  const buf = await file.arrayBuffer();
  const hash = await crypto.subtle.digest('SHA-256', buf);
  return Array.from(new Uint8Array(hash)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

export default function LibraryDropZone() {
  const router = useRouter();
  const [over, setOver] = useState(false);
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  const setItem = useCallback((id: string, patch: Partial<QueueItem>) => {
    setQueue((q) => q.map((it) => (it.id === id ? { ...it, ...patch } : it)));
  }, []);

  const upload = useCallback(async (files: File[]) => {
    if (!files.length) return;
    const items: QueueItem[] = files.map((f) => ({
      id: `${Date.now()}-${f.name}-${Math.random().toString(36).slice(2, 6)}`,
      name: f.name,
      size: f.size,
      status: 'queued',
    }));
    setQueue((q) => [...q, ...items]);

    let anySuccess = false;

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const id = items[i].id;
      try {
        if (!ALLOWED_MIMES.has(file.type)) {
          setItem(id, { status: 'error', msg: `mime not allowed: ${file.type || 'unknown'}` });
          continue;
        }

        // 1. Hash (client-side, Web Crypto)
        setItem(id, { status: 'hashing' });
        const sha256 = await sha256Hex(file);

        // 2. Get signed URL
        setItem(id, { status: 'signing' });
        const signRes = await fetch('/api/marketing/upload-sign', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            filename: file.name,
            content_type: file.type,
            size: file.size,
            sha256,
          }),
        });
        const signJson = await signRes.json().catch(() => ({}));
        if (!signRes.ok) {
          setItem(id, { status: 'error', msg: signJson.error ?? signRes.statusText });
          continue;
        }
        if (signJson.duplicate) {
          setItem(id, { status: 'duplicate', msg: 'already in library' });
          anySuccess = true;
          continue;
        }

        // 3. PUT directly to Supabase Storage with XHR for progress
        setItem(id, { status: 'uploading', pct: 0 });
        await new Promise<void>((resolve, reject) => {
          const xhr = new XMLHttpRequest();
          xhr.open('PUT', signJson.upload_url);
          xhr.setRequestHeader('content-type', file.type);
          xhr.upload.onprogress = (e) => {
            if (e.lengthComputable) {
              const pct = Math.round((e.loaded / e.total) * 100);
              setItem(id, { pct });
            }
          };
          xhr.onload = () => {
            if (xhr.status >= 200 && xhr.status < 300) resolve();
            else reject(new Error(`storage PUT failed: ${xhr.status} ${xhr.responseText.slice(0, 80)}`));
          };
          xhr.onerror = () => reject(new Error('network error during upload'));
          xhr.send(file);
        });

        // 4. Finalize
        setItem(id, { status: 'finalizing' });
        const finRes = await fetch('/api/marketing/upload-finalize', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ asset_id: signJson.asset_id }),
        });
        const finJson = await finRes.json().catch(() => ({}));
        if (!finRes.ok) {
          setItem(id, { status: 'error', msg: finJson.error ?? finRes.statusText });
          continue;
        }

        setItem(id, { status: 'done', pct: 100 });
        anySuccess = true;
      } catch (e: any) {
        setItem(id, { status: 'error', msg: e?.message ?? 'upload failed' });
      }
    }

    if (anySuccess) router.refresh();
  }, [router, setItem]);

  const totalQueued = queue.length;
  const totalDone = queue.filter((q) => q.status === 'done' || q.status === 'duplicate').length;
  const totalError = queue.filter((q) => q.status === 'error').length;

  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setOver(true); }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setOver(false);
        upload(Array.from(e.dataTransfer.files));
      }}
      style={{
        border: over ? '2px dashed var(--moss)' : '1px dashed var(--line)',
        background: over ? 'var(--paper-warm)' : 'var(--paper)',
        borderRadius: 8,
        padding: '16px 18px',
        marginBottom: 14,
        display: 'flex',
        gap: 14,
        alignItems: 'center',
        flexWrap: 'wrap',
        transition: 'border-color 120ms ease, background 120ms ease',
      }}
    >
      <div style={{ flex: 1, minWidth: 240 }}>
        <div style={{ fontFamily: 'var(--mono)', fontSize: 'var(--t-xs)', letterSpacing: '0.18em', textTransform: 'uppercase', color: 'var(--brass)' }}>
          ⇪ drop here · signed-url flow · up to 500 MB / file
        </div>
        <div style={{ fontFamily: 'var(--serif)', fontStyle: 'italic', fontSize: 'var(--t-lg)', color: 'var(--ink)', marginTop: 2 }}>
          Drag photos / videos / RAW to add them to the library.
        </div>
        <div style={{ fontSize: 'var(--t-sm)', color: 'var(--ink-mute)', marginTop: 4 }}>
          Direct-to-Supabase. SHA-256 dedupes. Auto-tagger + Reality Check run on upload. JPEG · PNG · HEIC · WebP · CR2 · NEF · ARW · DNG.
        </div>
      </div>
      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept="image/*,.cr2,.nef,.arw,.dng,.heic,.heif"
          onChange={(e) => upload(Array.from(e.target.files ?? []))}
          style={{ display: 'none' }}
        />
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          style={{
            padding: '8px 14px',
            fontFamily: 'var(--mono)',
            fontSize: 'var(--t-xs)',
            letterSpacing: '0.18em',
            textTransform: 'uppercase',
            fontWeight: 600,
            background: 'var(--moss)',
            color: 'var(--paper-warm)',
            border: '1px solid var(--moss)',
            borderRadius: 4,
            cursor: 'pointer',
          }}
        >
          Choose files
        </button>
        <TenantLink
          href="/marketing/upload"
          style={{
            padding: '8px 14px',
            fontFamily: 'var(--mono)',
            fontSize: 'var(--t-xs)',
            letterSpacing: '0.18em',
            textTransform: 'uppercase',
            fontWeight: 600,
            color: 'var(--ink)',
            background: 'var(--paper-warm)',
            border: '1px solid var(--line)',
            borderRadius: 4,
            textDecoration: 'none',
          }}
        >
          Full upload ↗
        </TenantLink>
      </div>
      {totalQueued > 0 && (
        <div style={{ width: '100%', borderTop: '1px solid var(--line-soft)', paddingTop: 10, marginTop: 6, display: 'flex', flexDirection: 'column', gap: 4 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: 'var(--mono)', fontSize: 'var(--t-xs)', letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--ink-mute)' }}>
            <span>Queue · {totalDone}/{totalQueued} done{totalError > 0 ? ` · ${totalError} errors` : ''}</span>
            <button type="button" onClick={() => setQueue([])} style={{ background: 'transparent', border: 'none', color: 'var(--ink-mute)', cursor: 'pointer', fontFamily: 'inherit', fontSize: 'inherit', letterSpacing: 'inherit', textTransform: 'inherit' }}>clear</button>
          </div>
          {queue.slice(-8).map((it) => (
            <div key={it.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 8, fontSize: 'var(--t-sm)' }}>
              <span style={{ fontFamily: 'var(--mono)', color: 'var(--ink-soft)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{it.name} · {(it.size/1e6).toFixed(1)}MB</span>
              <span
                style={{
                  fontFamily: 'var(--mono)',
                  fontSize: 'var(--t-xs)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.12em',
                  whiteSpace: 'nowrap',
                  color: it.status === 'done' || it.status === 'duplicate' ? 'var(--moss-glow)' :
                         it.status === 'error' ? 'var(--st-bad)' :
                         it.status === 'uploading' ? 'var(--brass)' :
                         'var(--ink-mute)',
                }}
              >
                {it.status}{it.status === 'uploading' && it.pct != null ? ` · ${it.pct}%` : ''}{it.msg ? ` · ${it.msg}` : ''}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
