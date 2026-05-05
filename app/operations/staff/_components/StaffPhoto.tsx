// app/operations/staff/_components/StaffPhoto.tsx
// Avatar + upload control shown to the left of the staff name.
// Click → file picker → POSTs to /api/operations/staff/photo → re-renders.

'use client';

import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';

interface Props {
  staffId: string;
  fullName: string;
  /** Storage path within bucket "staff-photos" (e.g. "{staff_id}/avatar.jpg"). */
  photoPath: string | null | undefined;
  /** Inline edit allowed? Defaults true. */
  editable?: boolean;
}

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'https://kpenyneooigsyuuomgct.supabase.co';

function publicUrl(path: string): string {
  return `${SUPABASE_URL}/storage/v1/object/public/staff-photos/${path}`;
}

function initials(name: string): string {
  const parts = name.split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export default function StaffPhoto({ staffId, fullName, photoPath, editable = true }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [localPath, setLocalPath] = useState<string | null>(photoPath ?? null);
  const inputRef = useRef<HTMLInputElement>(null);

  async function onFile(f: File) {
    if (!f.type.startsWith('image/')) { setError('Image files only.'); return; }
    if (f.size > 5_000_000) { setError('Max 5 MB.'); return; }
    setBusy(true); setError(null);
    try {
      const fd = new FormData();
      fd.append('file', f);
      fd.append('staff_id', staffId);
      const res = await fetch('/api/operations/staff/photo', { method: 'POST', body: fd });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        setError(json.error || `Upload failed (HTTP ${res.status})`);
        setBusy(false);
        return;
      }
      setLocalPath(json.photo_path);
      setBusy(false);
      router.refresh();
    } catch (e: any) {
      setError(e?.message || 'Network error');
      setBusy(false);
    }
  }

  const has = !!localPath;
  const url = has ? publicUrl(localPath as string) + `?v=${Date.now()}` : null;

  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16 }}>
      <button
        type="button"
        onClick={() => editable && inputRef.current?.click()}
        disabled={busy || !editable}
        title={editable ? (has ? 'Click to replace photo' : 'Click to upload photo') : undefined}
        style={{
          width: 96,
          height: 96,
          borderRadius: '50%',
          border: '2px solid var(--paper-deep)',
          background: has ? 'transparent' : 'var(--paper-warm)',
          padding: 0,
          overflow: 'hidden',
          cursor: editable ? 'pointer' : 'default',
          flexShrink: 0,
          position: 'relative',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {has ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={url ?? ''} alt={fullName} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        ) : (
          <span style={{
            fontFamily: 'var(--serif)',
            fontStyle: 'italic',
            fontSize: 'var(--t-2xl)',
            color: 'var(--brass)',
            letterSpacing: 'var(--ls-tight)',
          }}>
            {initials(fullName)}
          </span>
        )}
        {busy && (
          <div style={{
            position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.5)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: 'var(--paper-warm)', fontSize: 'var(--t-xs)', fontFamily: 'var(--mono)',
          }}>
            uploading…
          </div>
        )}
      </button>

      {editable && (
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          style={{ display: 'none' }}
          onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); e.currentTarget.value = ''; }}
        />
      )}

      {error && (
        <div style={{
          fontFamily: 'var(--mono)',
          fontSize: 'var(--t-xs)',
          color: 'var(--st-bad)',
          alignSelf: 'center',
        }}>
          {error}
        </div>
      )}
    </div>
  );
}
