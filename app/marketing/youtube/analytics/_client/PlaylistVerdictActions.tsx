'use client';
// Playlist verdict CTAs — kill / rename / merge / keep per audit verdict.
import { useState } from 'react';

const FOREST = '#084838'; const RED = '#B03826'; const AMBER = '#B48A3A';
const OK = '#0E7A4B'; const WHITE = '#FFFFFF'; const HAIR = '#E6DFCC';
const INK = '#1B1B1B'; const INK_M = '#5A5A5A';

interface Props {
  playlistId: string;
  verdict: string;
  currentTitle: string;
  suggestedTitle?: string | null;
  notes?: string | null;
}

type ActionState = 'idle' | 'confirm' | 'busy' | 'done' | 'error';

export default function PlaylistVerdictActions({ playlistId, verdict, currentTitle, suggestedTitle }: Props) {
  const [state, setState] = useState<ActionState>('idle');
  const [newTitle, setNewTitle] = useState(suggestedTitle ?? currentTitle);
  const [errMsg, setErrMsg] = useState('');
  const [open, setOpen] = useState(false);

  const v = verdict?.toLowerCase();

  async function doDelete() {
    setState('busy');
    try {
      const res = await fetch('/api/marketing/youtube/manage-playlist', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ playlist_id: playlistId }),
      });
      const j = await res.json();
      if (!res.ok || !j.ok) { setErrMsg(j.detail ?? j.error ?? 'failed'); setState('error'); return; }
      setState('done');
    } catch (e: unknown) { setErrMsg(e instanceof Error ? e.message : 'network'); setState('error'); }
  }

  async function doRename() {
    if (!newTitle.trim()) return;
    setState('busy');
    try {
      const res = await fetch('/api/marketing/youtube/manage-playlist', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ playlist_id: playlistId, title: newTitle.trim() }),
      });
      const j = await res.json();
      if (!res.ok || !j.ok) { setErrMsg(j.detail ?? j.error ?? 'failed'); setState('error'); return; }
      setState('done');
    } catch (e: unknown) { setErrMsg(e instanceof Error ? e.message : 'network'); setState('error'); }
  }

  if (state === 'done') {
    return <span style={{ fontSize: 10, color: OK, fontWeight: 700, padding: '2px 8px', border: `1px solid ${OK}`, borderRadius: 3 }}>✓ Done</span>;
  }

  if (v === 'keep') {
    return <span style={{ fontSize: 10, color: OK, fontWeight: 600, padding: '2px 8px', border: `1px solid ${OK}`, borderRadius: 3 }}>✓ Keep</span>;
  }

  if (v === 'kill') {
    return (
      <div style={{ marginTop: 8 }}>
        {!open ? (
          <button onClick={() => setOpen(true)} style={{ fontSize: 10, padding: '3px 10px', background: RED, color: WHITE, border: 'none', borderRadius: 3, cursor: 'pointer', fontWeight: 700 }}>
            Delete playlist
          </button>
        ) : (
          <div style={{ background: '#FEF2F2', border: `1px solid ${RED}`, borderRadius: 4, padding: 10, fontSize: 11 }}>
            <div style={{ fontWeight: 600, color: RED, marginBottom: 6 }}>Delete "{currentTitle}"? This cannot be undone.</div>
            {state === 'error' && <div style={{ color: RED, marginBottom: 6 }}>Error: {errMsg}</div>}
            <div style={{ display: 'flex', gap: 6 }}>
              <button onClick={doDelete} disabled={state === 'busy'} style={{ padding: '4px 12px', background: RED, color: WHITE, border: 'none', borderRadius: 3, cursor: 'pointer', fontWeight: 700, fontSize: 10 }}>
                {state === 'busy' ? 'Deleting…' : 'Confirm delete'}
              </button>
              <button onClick={() => setOpen(false)} style={{ padding: '4px 10px', background: WHITE, color: INK_M, border: `1px solid ${HAIR}`, borderRadius: 3, cursor: 'pointer', fontSize: 10 }}>Cancel</button>
            </div>
          </div>
        )}
      </div>
    );
  }

  if (v === 'rename') {
    return (
      <div style={{ marginTop: 8 }}>
        {!open ? (
          <button onClick={() => setOpen(true)} style={{ fontSize: 10, padding: '3px 10px', background: AMBER, color: WHITE, border: 'none', borderRadius: 3, cursor: 'pointer', fontWeight: 700 }}>
            Rename
          </button>
        ) : (
          <div style={{ background: '#FFFBF0', border: `1px solid ${AMBER}`, borderRadius: 4, padding: 10, fontSize: 11 }}>
            <div style={{ fontWeight: 600, color: AMBER, marginBottom: 6 }}>New title:</div>
            <input value={newTitle} onChange={e => setNewTitle(e.target.value)} style={{ width: '100%', padding: '5px 8px', border: `1px solid ${HAIR}`, borderRadius: 3, fontSize: 11, marginBottom: 6, boxSizing: 'border-box' }} />
            {state === 'error' && <div style={{ color: RED, marginBottom: 6 }}>Error: {errMsg}</div>}
            <div style={{ display: 'flex', gap: 6 }}>
              <button onClick={doRename} disabled={state === 'busy' || !newTitle.trim()} style={{ padding: '4px 12px', background: FOREST, color: WHITE, border: 'none', borderRadius: 3, cursor: 'pointer', fontWeight: 700, fontSize: 10 }}>
                {state === 'busy' ? 'Renaming…' : 'Rename on YouTube'}
              </button>
              <button onClick={() => setOpen(false)} style={{ padding: '4px 10px', background: WHITE, color: INK_M, border: `1px solid ${HAIR}`, borderRadius: 3, cursor: 'pointer', fontSize: 10 }}>Cancel</button>
            </div>
          </div>
        )}
      </div>
    );
  }

  if (v === 'merge') {
    return (
      <div style={{ marginTop: 8 }}>
        <div style={{ fontSize: 10, padding: '3px 8px', background: '#FFF7E6', border: `1px solid ${AMBER}`, borderRadius: 3, color: AMBER, fontWeight: 600 }}>
          MERGE — copy videos to target playlist in YouTube Studio, then delete this one
        </div>
      </div>
    );
  }

  return null;
}
