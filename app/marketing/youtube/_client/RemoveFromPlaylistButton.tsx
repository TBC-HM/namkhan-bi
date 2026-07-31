'use client';
// Removes a video from a playlist via manage-playlist action=remove_video.
// Requires the playlistItemId (not videoId) — the entry ID from the playlist.
import { useState } from 'react';

const RED = '#B03826'; const WHITE = '#FFFFFF'; const HAIR = '#E6DFCC'; const INK_M = '#5A5A5A'; const OK = '#0E7A4B';

interface Props { playlistItemId: string; videoTitle?: string | null; }

export default function RemoveFromPlaylistButton({ playlistItemId, videoTitle }: Props) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [err, setErr] = useState('');

  async function remove() {
    setBusy(true); setErr('');
    try {
      const res = await fetch('/api/marketing/youtube/manage-playlist', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'remove_video', playlist_item_id: playlistItemId }),
      });
      const j = await res.json();
      if (!res.ok || !j.ok) { setErr(j.detail ?? j.error ?? 'failed'); setBusy(false); return; }
      setDone(true); setOpen(false);
    } catch (e: unknown) { setErr(e instanceof Error ? e.message : 'network'); }
    setBusy(false);
  }

  if (done) return <span style={{ fontSize: 10, color: OK, fontWeight: 700, padding: '2px 6px', border: '1px solid ' + OK, borderRadius: 3 }}>✓ Removed</span>;

  return (
    <div style={{ position: 'relative', display: 'inline-block' }}>
      <button onClick={() => setOpen(o => !o)} style={{ fontSize: 10, padding: '2px 8px', background: WHITE, color: RED, border: '1px solid ' + RED, borderRadius: 3, cursor: 'pointer', fontWeight: 600 }}>
        Remove
      </button>
      {open && (
        <div style={{ position: 'absolute', right: 0, top: 22, zIndex: 200, background: WHITE, border: '1px solid ' + HAIR, borderRadius: 5, padding: 12, width: 260, boxShadow: '0 4px 16px rgba(0,0,0,.12)', fontSize: 11 }}>
          <div style={{ fontWeight: 700, color: RED, marginBottom: 6 }}>Remove from this playlist?</div>
          <div style={{ color: INK_M, marginBottom: 10, lineHeight: 1.4 }}>
            "{videoTitle ?? 'this video'}" will be removed from the playlist. The video itself stays on YouTube.
          </div>
          {err && <div style={{ color: RED, marginBottom: 6, fontSize: 10 }}>{err}</div>}
          <div style={{ display: 'flex', gap: 6 }}>
            <button onClick={remove} disabled={busy} style={{ flex: 1, padding: '5px 0', background: RED, color: WHITE, border: 'none', borderRadius: 3, cursor: 'pointer', fontWeight: 700, fontSize: 10 }}>
              {busy ? 'Removing…' : 'Confirm remove'}
            </button>
            <button onClick={() => setOpen(false)} style={{ padding: '5px 10px', background: WHITE, color: INK_M, border: '1px solid ' + HAIR, borderRadius: 3, cursor: 'pointer', fontSize: 10 }}>Cancel</button>
          </div>
        </div>
      )}
    </div>
  );
}
