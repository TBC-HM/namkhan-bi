'use client';
import { useState } from 'react';

const RED = '#B03826'; const HAIR = '#E6DFCC';
const INK_M = '#5A5A5A'; const OK = '#0E7A4B';

interface Props { playlistId: string; playlistTitle?: string | null }

export default function DeletePlaylistButton({ playlistId, playlistTitle }: Props) {
  const [step, setStep] = useState<'idle' | 'confirm' | 'running' | 'done' | 'error'>('idle');
  const [err, setErr] = useState<string | null>(null);

  async function doDelete() {
    setStep('running');
    try {
      const res = await fetch('/api/marketing/youtube/manage-playlist', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ playlist_id: playlistId }),
      });
      const j = await res.json();
      if (j.ok) setStep('done');
      else { setErr(j.error ?? 'error'); setStep('error'); }
    } catch (e) { setErr(String(e)); setStep('error'); }
  }

  if (step === 'done') return <span style={{ fontSize: 10, color: OK }}>✓ Deleted — refresh to update</span>;
  if (step === 'error') return <span style={{ fontSize: 10, color: RED }}>{err?.slice(0, 60)}</span>;
  if (step === 'running') return <span style={{ fontSize: 10, color: INK_M }}>Deleting…</span>;

  if (step === 'confirm') return (
    <div style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
      <span style={{ fontSize: 10, color: RED }}>Delete &quot;{playlistTitle?.slice(0, 22) ?? playlistId}&quot;?</span>
      <button onClick={() => setStep('idle')} style={{ fontSize: 10, padding: '2px 6px', border: `1px solid ${HAIR}`, borderRadius: 2, cursor: 'pointer', background: '#fff', color: INK_M }}>No</button>
      <button onClick={doDelete} style={{ fontSize: 10, padding: '2px 6px', border: `1px solid ${RED}`, borderRadius: 2, cursor: 'pointer', background: RED, color: '#fff', fontWeight: 600 }}>Yes, delete</button>
    </div>
  );

  return (
    <button onClick={() => setStep('confirm')}
      style={{ fontSize: 10, padding: '2px 8px', border: `1px solid ${HAIR}`, borderRadius: 2, background: '#fff', cursor: 'pointer', color: RED }}>
      🗑 Delete playlist
    </button>
  );
}
