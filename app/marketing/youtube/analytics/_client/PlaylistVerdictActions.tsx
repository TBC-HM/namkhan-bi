'use client';
// Playlist verdict CTAs — persists every action to yt_action_log so state
// survives page refreshes and new audit runs.
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
  initialDone?: boolean;
  initialAction?: string | null;
}

async function logAction(entityId: string, action: string, newValue?: string) {
  await fetch('/api/marketing/youtube/log-action', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ entity_type: 'playlist', entity_id: entityId, action, new_value: newValue }),
  });
}

async function getPlaylistItems(playlistId: string): Promise<string[]> {
  // Fetch video IDs from source playlist via manage-playlist GET
  const r = await fetch(`/api/marketing/youtube/manage-playlist?action=get_items&playlist_id=${encodeURIComponent(playlistId)}`, { cache: 'no-store' });
  const j = await r.json();
  return j.video_ids ?? [];
}

export default function PlaylistVerdictActions({ playlistId, verdict, currentTitle, suggestedTitle, initialDone, initialAction }: Props) {
  const [done, setDone] = useState(initialDone ?? false);
  const [doneLabel, setDoneLabel] = useState(initialAction ?? '');
  const [busy, setState_] = useState(false);
  const [errMsg, setErr] = useState('');
  const [open, setOpen] = useState(false);
  const [newTitle, setNewTitle] = useState(suggestedTitle ?? currentTitle);

  // Merge state
  const [mergeOpen, setMergeOpen] = useState(false);
  const [targetId, setTargetId] = useState('');
  const [targetTitle, setTargetTitle] = useState('');
  const [mergeStep, setMergeStep] = useState<'idle' | 'copying' | 'deleting' | 'done'>('idle');
  const [mergeMsg, setMergeMsg] = useState('');

  const v = verdict?.toLowerCase();

  function setBusy(b: boolean) { setState_(b); }

  async function doDelete() {
    setBusy(true);
    try {
      const res = await fetch('/api/marketing/youtube/manage-playlist', {
        method: 'DELETE', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ playlist_id: playlistId }),
      });
      const j = await res.json();
      if (!res.ok || !j.ok) { setErr(j.detail ?? j.error ?? 'failed'); setBusy(false); return; }
      await logAction(playlistId, 'deleted', currentTitle);
      setDone(true); setDoneLabel('deleted');
    } catch (e: unknown) { setErr(e instanceof Error ? e.message : 'network'); }
    setBusy(false);
  }

  async function doRename() {
    if (!newTitle.trim()) return;
    setBusy(true);
    try {
      const res = await fetch('/api/marketing/youtube/manage-playlist', {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ playlist_id: playlistId, title: newTitle.trim() }),
      });
      const j = await res.json();
      if (!res.ok || !j.ok) { setErr(j.detail ?? j.error ?? 'failed'); setBusy(false); return; }
      await logAction(playlistId, 'renamed', newTitle.trim());
      setDone(true); setDoneLabel('renamed → ' + newTitle.trim());
    } catch (e: unknown) { setErr(e instanceof Error ? e.message : 'network'); }
    setBusy(false);
  }

  async function doMerge() {
    if (!targetId) { setErr('Select a target playlist first'); return; }
    setBusy(true); setErr('');
    try {
      // 1: get all video IDs from source playlist
      setMergeStep('copying'); setMergeMsg('Fetching source playlist videos…');
      const videoIds = await getPlaylistItems(playlistId);
      if (videoIds.length === 0) {
        setMergeMsg('No videos found in source playlist — deleting empty playlist…');
      } else {
        setMergeMsg('Copying ' + videoIds.length + ' videos to target playlist…');
        for (let i = 0; i < videoIds.length; i++) {
          await fetch('/api/marketing/youtube/manage-playlist', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'add_video', playlist_id: targetId, video_id: videoIds[i] }),
          });
          setMergeMsg('Copying ' + (i + 1) + ' / ' + videoIds.length + ' videos…');
        }
      }
      // 2: delete source
      setMergeStep('deleting'); setMergeMsg('Deleting source playlist…');
      const del = await fetch('/api/marketing/youtube/manage-playlist', {
        method: 'DELETE', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ playlist_id: playlistId }),
      });
      const dj = await del.json();
      if (!del.ok || !dj.ok) { setErr('Copy done but delete failed: ' + (dj.error ?? '')); setBusy(false); return; }
      await logAction(playlistId, 'merged', targetTitle || targetId);
      setMergeStep('done'); setMergeMsg('');
      setDone(true); setDoneLabel('merged into ' + (targetTitle || targetId));
    } catch (e: unknown) { setErr(e instanceof Error ? e.message : 'network'); }
    setBusy(false);
  }

  // Already done — show persistent badge
  if (done) {
    const bg = doneLabel.startsWith('deleted') ? '#FDECEA' : doneLabel.startsWith('merged') ? '#FFF8E6' : '#E4F1E0';
    const fg = doneLabel.startsWith('deleted') ? RED : doneLabel.startsWith('merged') ? AMBER : OK;
    return (
      <div style={{ marginTop: 8, fontSize: 10, padding: '3px 10px', background: bg, border: '1px solid ' + fg, borderRadius: 3, color: fg, fontWeight: 700 }}>
        ✓ {doneLabel || 'done'}
      </div>
    );
  }

  if (v === 'keep') {
    return <div style={{ marginTop: 6 }}><span style={{ fontSize: 10, color: OK, fontWeight: 600, padding: '2px 8px', border: '1px solid ' + OK, borderRadius: 3 }}>✓ Keep</span></div>;
  }

  if (v === 'kill') {
    return (
      <div style={{ marginTop: 8 }}>
        {!open ? (
          <button onClick={() => setOpen(true)} style={{ fontSize: 10, padding: '4px 12px', background: RED, color: WHITE, border: 'none', borderRadius: 3, cursor: 'pointer', fontWeight: 700 }}>
            Delete playlist
          </button>
        ) : (
          <div style={{ background: '#FEF2F2', border: '1px solid ' + RED, borderRadius: 4, padding: 10, fontSize: 11 }}>
            <div style={{ fontWeight: 600, color: RED, marginBottom: 6 }}>Delete "{currentTitle}"? Cannot be undone.</div>
            {errMsg && <div style={{ color: RED, marginBottom: 6 }}>{errMsg}</div>}
            <div style={{ display: 'flex', gap: 6 }}>
              <button onClick={doDelete} disabled={busy} style={{ padding: '4px 12px', background: RED, color: WHITE, border: 'none', borderRadius: 3, cursor: 'pointer', fontWeight: 700, fontSize: 10 }}>
                {busy ? 'Deleting…' : 'Confirm delete'}
              </button>
              <button onClick={() => setOpen(false)} style={{ padding: '4px 10px', background: WHITE, color: INK_M, border: '1px solid ' + HAIR, borderRadius: 3, cursor: 'pointer', fontSize: 10 }}>Cancel</button>
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
          <button onClick={() => setOpen(true)} style={{ fontSize: 10, padding: '4px 12px', background: AMBER, color: WHITE, border: 'none', borderRadius: 3, cursor: 'pointer', fontWeight: 700 }}>
            Rename
          </button>
        ) : (
          <div style={{ background: '#FFFBF0', border: '1px solid ' + AMBER, borderRadius: 4, padding: 10, fontSize: 11 }}>
            <div style={{ fontWeight: 600, color: AMBER, marginBottom: 6 }}>New title:</div>
            <input value={newTitle} onChange={e => setNewTitle(e.target.value)}
              style={{ width: '100%', padding: '5px 8px', border: '1px solid ' + HAIR, borderRadius: 3, fontSize: 11, marginBottom: 6, boxSizing: 'border-box' }} />
            {errMsg && <div style={{ color: RED, marginBottom: 6 }}>{errMsg}</div>}
            <div style={{ display: 'flex', gap: 6 }}>
              <button onClick={doRename} disabled={busy || !newTitle.trim()}
                style={{ padding: '4px 12px', background: FOREST, color: WHITE, border: 'none', borderRadius: 3, cursor: 'pointer', fontWeight: 700, fontSize: 10 }}>
                {busy ? 'Renaming…' : 'Rename on YouTube'}
              </button>
              <button onClick={() => setOpen(false)} style={{ padding: '4px 10px', background: WHITE, color: INK_M, border: '1px solid ' + HAIR, borderRadius: 3, cursor: 'pointer', fontSize: 10 }}>Cancel</button>
            </div>
          </div>
        )}
      </div>
    );
  }

  if (v === 'merge') {
    return (
      <div style={{ marginTop: 8 }}>
        {!mergeOpen ? (
          <button onClick={() => setMergeOpen(true)}
            style={{ fontSize: 10, padding: '4px 12px', background: AMBER, color: WHITE, border: 'none', borderRadius: 3, cursor: 'pointer', fontWeight: 700 }}>
            Copy videos & merge
          </button>
        ) : mergeStep === 'done' ? null : (
          <div style={{ background: '#FFFBF0', border: '1px solid ' + AMBER, borderRadius: 4, padding: 10, fontSize: 11 }}>
            <div style={{ fontWeight: 600, color: AMBER, marginBottom: 8 }}>Merge "{currentTitle}" into:</div>
            <div style={{ marginBottom: 6 }}>
              <div style={{ fontSize: 10, color: INK_M, marginBottom: 4 }}>TARGET PLAYLIST ID (paste from YouTube Studio URL)</div>
              <input value={targetId} onChange={e => setTargetId(e.target.value)} placeholder="PLO87vGnBPV3..."
                style={{ width: '100%', padding: '5px 8px', border: '1px solid ' + HAIR, borderRadius: 3, fontSize: 11, marginBottom: 4, boxSizing: 'border-box' }} />
              <input value={targetTitle} onChange={e => setTargetTitle(e.target.value)} placeholder="Target playlist name (for display)"
                style={{ width: '100%', padding: '5px 8px', border: '1px solid ' + HAIR, borderRadius: 3, fontSize: 11, boxSizing: 'border-box' }} />
            </div>
            <div style={{ fontSize: 10, color: INK_M, marginBottom: 8, padding: '6px 8px', background: '#F5F0E1', borderRadius: 3 }}>
              This will copy ALL videos from "{currentTitle}" to the target playlist, then delete the source. Cannot be undone.
            </div>
            {mergeMsg && <div style={{ fontSize: 10, color: FOREST, marginBottom: 6, fontWeight: 600 }}>{mergeMsg}</div>}
            {errMsg && <div style={{ color: RED, marginBottom: 6, fontSize: 10 }}>{errMsg}</div>}
            <div style={{ display: 'flex', gap: 6 }}>
              <button onClick={doMerge} disabled={busy || !targetId.trim()}
                style={{ padding: '4px 12px', background: FOREST, color: WHITE, border: 'none', borderRadius: 3, cursor: 'pointer', fontWeight: 700, fontSize: 10, opacity: !targetId.trim() ? 0.5 : 1 }}>
                {busy ? mergeMsg || 'Working…' : 'Copy all & delete source'}
              </button>
              <button onClick={() => setMergeOpen(false)} style={{ padding: '4px 10px', background: WHITE, color: INK_M, border: '1px solid ' + HAIR, borderRadius: 3, cursor: 'pointer', fontSize: 10 }}>Cancel</button>
            </div>
          </div>
        )}
      </div>
    );
  }

  return null;
}
