'use client';

// app/marketing/media/upload/UploadDropzone.tsx
// Drag-drop multi-file uploader. Photos only. SHA256 client-side for dedupe.

import { useCallback, useRef, useState } from 'react';

type Stage = 'idle' | 'hashing' | 'signing' | 'uploading' | 'finalizing' | 'done' | 'duplicate' | 'error';

interface Item {
  id: string;          // local UI id
  file: File;
  stage: Stage;
  progress: number;    // 0-100 for the upload step
  asset_id?: string;
  error?: string;
}

const ALLOWED_MIME = new Set([
  'image/jpeg', 'image/png', 'image/heic', 'image/heif', 'image/webp',
  'image/x-canon-cr2', 'image/x-nikon-nef', 'image/x-sony-arw', 'image/x-adobe-dng',
]);

async function sha256OfFile(file: File): Promise<string> {
  const buf = await file.arrayBuffer();
  const hash = await crypto.subtle.digest('SHA-256', buf);
  return Array.from(new Uint8Array(hash))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

function inferMime(file: File): string {
  if (file.type) return file.type;
  const ext = file.name.toLowerCase().split('.').pop() ?? '';
  const map: Record<string, string> = {
    cr2: 'image/x-canon-cr2', nef: 'image/x-nikon-nef',
    arw: 'image/x-sony-arw', dng: 'image/x-adobe-dng',
    heic: 'image/heic', heif: 'image/heif',
    jpg: 'image/jpeg', jpeg: 'image/jpeg',
    png: 'image/png', webp: 'image/webp',
  };
  return map[ext] ?? 'application/octet-stream';
}

function bytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

export default function UploadDropzone() {
  const [items, setItems] = useState<Item[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const updateItem = useCallback((id: string, patch: Partial<Item>) => {
    setItems(prev => prev.map(it => (it.id === id ? { ...it, ...patch } : it)));
  }, []);

  const processOne = useCallback(async (item: Item) => {
    const id = item.id;
    try {
      // Reject videos / unsupported MIME at the gate
      const mime = inferMime(item.file);
      if (!ALLOWED_MIME.has(mime)) {
        updateItem(id, { stage: 'error', error: `Unsupported type: ${mime}` });
        return;
      }
      if (item.file.size > 500 * 1024 * 1024) {
        updateItem(id, { stage: 'error', error: 'File exceeds 500 MB' });
        return;
      }

      updateItem(id, { stage: 'hashing' });
      const sha = await sha256OfFile(item.file);

      updateItem(id, { stage: 'signing' });
      const signRes = await fetch('/api/media/sign-upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filename: item.file.name,
          content_type: mime,
          size: item.file.size,
          sha256: sha,
        }),
      });
      const signJson = await signRes.json();
      if (!signRes.ok) {
        updateItem(id, { stage: 'error', error: signJson.error ?? 'sign_failed' });
        return;
      }
      if (signJson.duplicate) {
        updateItem(id, { stage: 'duplicate', asset_id: signJson.asset_id });
        return;
      }

      const { upload_url, asset_id } = signJson;
      updateItem(id, { stage: 'uploading', asset_id });

      // PUT to signed URL with progress via XHR
      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open('PUT', upload_url);
        xhr.setRequestHeader('Content-Type', mime);
        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) {
            const pct = Math.round((e.loaded / e.total) * 100);
            updateItem(id, { progress: pct });
          }
        };
        xhr.onload = () => (xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error(`upload_failed_${xhr.status}`)));
        xhr.onerror = () => reject(new Error('upload_network_error'));
        xhr.send(item.file);
      });

      updateItem(id, { stage: 'finalizing', progress: 100 });
      const finRes = await fetch('/api/media/finalize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ asset_id }),
      });
      const finJson = await finRes.json();
      if (!finRes.ok || !finJson.ok) {
        updateItem(id, { stage: 'error', error: finJson.error ?? 'finalize_failed' });
        return;
      }
      updateItem(id, { stage: 'done' });
    } catch (e: any) {
      updateItem(id, { stage: 'error', error: e?.message ?? 'unknown' });
    }
  }, [updateItem]);

  const onFiles = useCallback((files: FileList | File[]) => {
    const arr = Array.from(files);
    const newItems: Item[] = arr.map(f => ({
      id: `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      file: f,
      stage: 'idle' as Stage,
      progress: 0,
    }));
    setItems(prev => [...newItems, ...prev]);
    // Process with a parallelism cap of 3
    let i = 0;
    const lane = async () => {
      while (i < newItems.length) {
        const idx = i++;
        await processOne(newItems[idx]);
      }
    };
    Promise.all([lane(), lane(), lane()]);
  }, [processOne]);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files?.length) onFiles(e.dataTransfer.files);
  }, [onFiles]);

  const stageLabel = (s: Stage) => ({
    idle: 'Queued', hashing: 'Hashing…', signing: 'Signing…', uploading: 'Uploading…',
    finalizing: 'Finalising…', done: 'Ingested', duplicate: 'Duplicate', error: 'Error',
  })[s];

  const stageColor = (s: Stage) => ({
    done: 'var(--good, #2d6a4f)',
    duplicate: 'var(--warn, #b8860b)',
    error: 'var(--bad, #b3261e)',
    uploading: 'var(--brass, #b8860b)',
    finalizing: 'var(--brass, #b8860b)',
  } as Record<Stage, string>)[s] ?? 'var(--ink-mute, #6b6b6b)';

  return (
    <div style={{ padding: '8px 0' }}>
      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        onClick={() => inputRef.current?.click()}
        style={{
          border: `2px dashed ${dragOver ? 'var(--brass, #b8860b)' : 'var(--line, #d8d4cc)'}`,
          background: dragOver ? 'var(--paper, #f8f4ec)' : 'transparent',
          padding: '40px 24px',
          textAlign: 'center',
          cursor: 'pointer',
          transition: 'all .15s',
        }}
      >
        <div style={{ fontFamily: 'var(--serif)', fontSize: 18, color: 'var(--ink)', fontStyle: 'italic' }}>
          {dragOver ? 'Release to upload' : 'Drop photos here or click to select'}
        </div>
        <div style={{ fontSize: 12, color: 'var(--ink-mute)', marginTop: 8, fontFamily: 'var(--mono)' }}>
          JPG · PNG · HEIC · WebP · DNG · CR2 · NEF · ARW
        </div>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept="image/jpeg,image/png,image/heic,image/heif,image/webp,.cr2,.nef,.arw,.dng"
          onChange={(e) => e.target.files && onFiles(e.target.files)}
          style={{ display: 'none' }}
        />
      </div>

      {items.length > 0 && (
        <div style={{ marginTop: 16, borderTop: '1px solid var(--line-soft, #e6e2da)' }}>
          {items.map((it) => (
            <div
              key={it.id}
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 90px 110px',
                gap: 12,
                padding: '10px 4px',
                borderBottom: '1px solid var(--line-soft, #e6e2da)',
                fontSize: 13,
              }}
            >
              <div style={{ overflow: 'hidden' }}>
                <div style={{ fontWeight: 500, color: 'var(--ink)', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>
                  {it.file.name}
                </div>
                <div style={{ fontSize: 11, color: 'var(--ink-mute)', fontFamily: 'var(--mono)' }}>
                  {bytes(it.file.size)} · {it.file.type || 'unknown'}
                  {it.error && <span style={{ color: 'var(--bad, #b3261e)', marginLeft: 8 }}>· {it.error}</span>}
                  {it.asset_id && <span style={{ marginLeft: 8 }}>· {it.asset_id.slice(0, 8)}</span>}
                </div>
              </div>
              <div style={{ alignSelf: 'center', fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--ink-mute)' }}>
                {it.stage === 'uploading' ? `${it.progress}%` : ''}
              </div>
              <div style={{ alignSelf: 'center', textAlign: 'right', fontFamily: 'var(--mono)', fontSize: 11, color: stageColor(it.stage), fontWeight: 600 }}>
                {stageLabel(it.stage)}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
