'use client';

// components/marketing/LibraryDropZone.tsx
// Lightweight drag-target on /marketing/library. Files dropped here POST
// to /api/marketing/upload (the same endpoint /marketing/upload uses).
// Successful uploads trigger a router.refresh() so the grid below picks up
// the new asset rows immediately.

import { useCallback, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

interface QueueItem {
  id: string;
  name: string;
  status: 'queued' | 'uploading' | 'done' | 'error';
  msg?: string;
}

export default function LibraryDropZone() {
  const router = useRouter();
  const [over, setOver] = useState(false);
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  const upload = useCallback(async (files: File[]) => {
    if (!files.length) return;
    const items: QueueItem[] = files.map((f) => ({
      id: `${Date.now()}-${f.name}`, name: f.name, status: 'queued',
    }));
    setQueue((q) => [...q, ...items]);

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const id = items[i].id;
      setQueue((q) => q.map((it) => it.id === id ? { ...it, status: 'uploading' } : it));
      try {
        const fd = new FormData();
        fd.append('file', file);
        const res = await fetch('/api/marketing/upload', { method: 'POST', body: fd });
        const j = await res.json().catch(() => ({}));
        if (!res.ok) {
          setQueue((q) => q.map((it) => it.id === id ? { ...it, status: 'error', msg: j.error ?? res.statusText } : it));
        } else {
          setQueue((q) => q.map((it) => it.id === id ? { ...it, status: 'done' } : it));
        }
      } catch (e: any) {
        setQueue((q) => q.map((it) => it.id === id ? { ...it, status: 'error', msg: e?.message ?? 'upload failed' } : it));
      }
    }
    router.refresh();
  }, [router]);

  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setOver(true); }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setOver(false);
        const files = Array.from(e.dataTransfer.files);
        upload(files);
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
          ⇪ drop here · or
        </div>
        <div style={{ fontFamily: 'var(--serif)', fontStyle: 'italic', fontSize: 'var(--t-lg)', color: 'var(--ink)', marginTop: 2 }}>
          Drag photos / videos to add them to the library.
        </div>
        <div style={{ fontSize: 'var(--t-sm)', color: 'var(--ink-mute)', marginTop: 4 }}>
          Files are hashed, deduped, and routed through the auto-tagger. Goes via <code>/api/marketing/upload</code>.
        </div>
      </div>
      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept="image/*,video/*"
          onChange={(e) => upload(Array.from(e.target.files ?? []))}
          style={{ display: 'none' }}
        />
        <button
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
        <Link
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
        </Link>
      </div>
      {queue.length > 0 && (
        <div style={{ width: '100%', borderTop: '1px solid var(--line-soft)', paddingTop: 10, marginTop: 6, display: 'flex', flexDirection: 'column', gap: 4 }}>
          {queue.slice(-5).map((it) => (
            <div key={it.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--t-sm)' }}>
              <span style={{ fontFamily: 'var(--mono)', color: 'var(--ink-soft)' }}>{it.name}</span>
              <span
                style={{
                  fontFamily: 'var(--mono)',
                  fontSize: 'var(--t-xs)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.12em',
                  color: it.status === 'done' ? 'var(--moss-glow)' : it.status === 'error' ? 'var(--st-bad)' : 'var(--brass)',
                }}
              >
                {it.status}{it.msg ? ` · ${it.msg}` : ''}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
