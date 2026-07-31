'use client';
// Delete a video from YouTube. Shows a confirmation popover.
// Owned videos: permanently deleted. Third-party: shows playlist-removal guidance.
import { useState } from 'react';

const RED = '#B03826'; const WHITE = '#FFFFFF'; const HAIR = '#E6DFCC';
const INK_M = '#5A5A5A'; const AMBER = '#B48A3A'; const OK = '#0E7A4B';

interface Props { videoId: string; videoTitle?: string | null }

export default function DeleteVideoButton({ videoId, videoTitle }: Props) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [state, setState] = useState<'idle' | 'done' | 'not_owned' | 'error'>('idle');
  const [errMsg, setErr] = useState('');

  async function doDelete() {
    setBusy(true);
    try {
      const res = await fetch('/api/marketing/youtube/delete-video', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ video_id: videoId }),
      });
      const j = await res.json();
      if (j.error === 'not_owned') { setState('not_owned'); setBusy(false); return; }
      if (!res.ok || !j.ok) { setErr(j.detail ?? j.error ?? 'failed'); setState('error'); setBusy(false); return; }
      // Log the deletion
      await fetch('/api/marketing/youtube/log-action', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ entity_type: 'video', entity_id: videoId, action: 'deleted', new_value: videoTitle }),
      });
      setState('done'); setOpen(false);
    } catch (e: unknown) { setErr(e instanceof Error ? e.message : 'network'); setState('error'); }
    setBusy(false);
  }

  if (state === 'done') {
    return <span style={{ fontSize: 10, color: OK, fontWeight: 700, padding: '2px 8px', border: '1px solid ' + OK, borderRadius: 3 }}>✓ Deleted</span>;
  }

  return (
    <div style={{ position: 'relative', display: 'inline-block' }}>
      <button onClick={() => setOpen(o => !o)} style={{ fontSize: 10, padding: '3px 10px', background: WHITE, color: RED, border: '1px solid ' + RED, borderRadius: 3, cursor: 'pointer', fontWeight: 700 }}>
        Delete video
      </button>

      {open && (
        <div style={{ position: 'absolute', right: 0, top: 26, zIndex: 200, background: WHITE, border: '1px solid ' + HAIR, borderRadius: 6, padding: 14, width: 320, boxShadow: '0 6px 20px rgba(0,0,0,.12)', fontSize: 11.5 }}>
          {state === 'not_owned' ? (
            <>
              <div style={{ fontWeight: 700, color: AMBER, marginBottom: 8 }}>Not your video</div>
              <div style={{ color: '#1B1B1B', lineHeight: 1.5, marginBottom: 10 }}>
                This video is not uploaded by The Namkhan channel — you cannot delete it. To remove it:
                <ol style={{ margin: '8px 0 0 16px', color: INK_M }}>
                  <li>Open YouTube Studio → Playlists</li>
                  <li>Find the playlist containing this video</li>
                  <li>Click the 3-dot menu on the video → Remove from playlist</li>
                </ol>
              </div>
              <button onClick={() => { setOpen(false); setState('idle'); }} style={{ padding: '4px 12px', background: WHITE, color: INK_M, border: '1px solid ' + HAIR, borderRadius: 3, cursor: 'pointer', fontSize: 10 }}>Close</button>
            </>
          ) : (
            <>
              <div style={{ fontWeight: 700, color: RED, marginBottom: 8 }}>Delete this video permanently?</div>
              <div style={{ color: INK_M, marginBottom: 10, lineHeight: 1.5 }}>
                "{videoTitle ?? videoId}" will be permanently removed from YouTube. Cannot be undone.
              </div>
              {state === 'error' && <div style={{ color: RED, marginBottom: 8, fontSize: 10 }}>{errMsg}</div>}
              <div style={{ display: 'flex', gap: 6 }}>
                <button onClick={doDelete} disabled={busy} style={{ flex: 1, padding: '7px 0', background: RED, color: WHITE, border: 'none', borderRadius: 3, cursor: 'pointer', fontWeight: 700, fontSize: 11 }}>
                  {busy ? 'Deleting…' : 'Yes, delete permanently'}
                </button>
                <button onClick={() => setOpen(false)} style={{ padding: '7px 12px', background: WHITE, color: INK_M, border: '1px solid ' + HAIR, borderRadius: 3, cursor: 'pointer', fontSize: 11 }}>Cancel</button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
