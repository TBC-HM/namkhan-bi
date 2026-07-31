'use client';
// Move a video to a different playlist: add to target, then remove from current.
import { useState } from 'react';

const FOREST = '#084838'; const WHITE = '#FFFFFF'; const HAIR = '#E6DFCC';
const INK = '#1B1B1B'; const INK_M = '#5A5A5A'; const OK = '#0E7A4B'; const AMBER = '#B48A3A';

interface Playlist { id: string; title: string }
interface Props {
  videoId: string;
  playlistItemId: string;
  videoTitle?: string | null;
  currentPlaylistId: string;
  availablePlaylists: Playlist[];
}

export default function MoveToPlaylistButton({ videoId, playlistItemId, videoTitle, currentPlaylistId, availablePlaylists }: Props) {
  const [open, setOpen] = useState(false);
  const [targetId, setTargetId] = useState('');
  const [busy, setBusy] = useState(false);
  const [step, setStep] = useState('');
  const [done, setDone] = useState(false);
  const [err, setErr] = useState('');

  const targets = availablePlaylists.filter(p => p.id !== currentPlaylistId);

  async function move() {
    if (!targetId) { setErr('Select a target playlist'); return; }
    setBusy(true); setErr('');
    try {
      // Step 1: add to target
      setStep('Adding to target playlist…');
      const addRes = await fetch('/api/marketing/youtube/manage-playlist', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'add_video', playlist_id: targetId, video_id: videoId }),
      });
      const addJ = await addRes.json();
      if (!addRes.ok || !addJ.ok) { setErr('Add failed: ' + (addJ.detail ?? addJ.error ?? 'unknown')); setBusy(false); setStep(''); return; }

      // Step 2: remove from current
      setStep('Removing from current playlist…');
      const rmRes = await fetch('/api/marketing/youtube/manage-playlist', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'remove_video', playlist_item_id: playlistItemId }),
      });
      const rmJ = await rmRes.json();
      if (!rmRes.ok || !rmJ.ok) { setErr('Moved but could not remove from this playlist: ' + (rmJ.detail ?? '')); setBusy(false); setStep(''); return; }

      setDone(true); setOpen(false); setStep('');
    } catch (e: unknown) { setErr(e instanceof Error ? e.message : 'network'); }
    setBusy(false); setStep('');
  }

  if (done) return <span style={{ fontSize: 10, color: OK, fontWeight: 700, padding: '2px 6px', border: '1px solid ' + OK, borderRadius: 3 }}>✓ Moved</span>;

  return (
    <div style={{ position: 'relative', display: 'inline-block' }}>
      <button onClick={() => setOpen(o => !o)} style={{ fontSize: 10, padding: '2px 8px', background: WHITE, color: AMBER, border: '1px solid ' + AMBER, borderRadius: 3, cursor: 'pointer', fontWeight: 600 }}>
        Move →
      </button>
      {open && (
        <div style={{ position: 'absolute', right: 0, top: 22, zIndex: 200, background: WHITE, border: '1px solid ' + HAIR, borderRadius: 5, padding: 14, width: 300, boxShadow: '0 4px 16px rgba(0,0,0,.12)', fontSize: 11 }}>
          <div style={{ fontWeight: 700, color: INK, marginBottom: 8 }}>Move to playlist</div>
          <div style={{ fontSize: 10, color: INK_M, marginBottom: 10, lineHeight: 1.4 }}>
            "{videoTitle ?? videoId}" will be added to the target and removed from this playlist.
          </div>
          <select value={targetId} onChange={e => setTargetId(e.target.value)}
            style={{ width: '100%', padding: '6px 8px', border: '1px solid ' + HAIR, borderRadius: 3, fontSize: 11, marginBottom: 10, background: WHITE, color: INK }}>
            <option value="">— select target playlist —</option>
            {targets.map(p => (
              <option key={p.id} value={p.id}>{p.title}</option>
            ))}
          </select>
          {step && <div style={{ fontSize: 10, color: FOREST, marginBottom: 6 }}>{step}</div>}
          {err && <div style={{ fontSize: 10, color: '#B03826', marginBottom: 6 }}>{err}</div>}
          <div style={{ display: 'flex', gap: 6 }}>
            <button onClick={move} disabled={busy || !targetId}
              style={{ flex: 1, padding: '6px 0', background: FOREST, color: WHITE, border: 'none', borderRadius: 3, cursor: 'pointer', fontWeight: 700, fontSize: 10, opacity: !targetId || busy ? 0.5 : 1 }}>
              {busy ? step || 'Moving…' : 'Confirm move'}
            </button>
            <button onClick={() => setOpen(false)} style={{ padding: '6px 10px', background: WHITE, color: INK_M, border: '1px solid ' + HAIR, borderRadius: 3, cursor: 'pointer', fontSize: 10 }}>Cancel</button>
          </div>
        </div>
      )}
    </div>
  );
}
