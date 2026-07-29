// app/marketing/media/_client/VideoReviewTab.tsx
// PBS 2026-07-29 · media-video-frontend brief · WORK ITEM 3 (A3) — Video Review
// = junk cull. Reads public.v_media_video_review_queue (server-loaded in
// page.tsx). Card = poster (placeholder when Cloudinary hasn't run) + reason +
//   [Keep]   → /api/marketing/media/clear-review  (public.fn_clear_review)
//   [Delete] → /api/marketing/media/confirm-junk  (public.fn_confirm_junk, soft-delete)
// Decide from poster + caption WITHOUT watching each clip. Honest empty state
// when the queue is empty (0 rows at build time).
'use client';

import { useMemo, useState } from 'react';

export interface VideoReviewRow {
  asset_id: string;
  property_id: number | null;
  original_filename: string | null;
  status: string | null;
  content_class: string | null;
  video_type: string | null;
  usability_score: number | null;
  review_reason: string | null;
  poster_path: string | null;
  playable_path: string | null;
  caption: string | null;
  created_at: string | null;
}

interface Props {
  rows: VideoReviewRow[];
}

const WHITE  = '#FFFFFF';
const CREAM  = '#F5F0E1';
const HAIR   = '#E6DFCC';
const INK    = '#1B1B1B';
const INK_M  = '#5A5A5A';
const FOREST = '#084838';
const RED    = '#B23A2E';

const REASON_LABEL: Record<string, string> = {
  video_unusable: 'Unusable',
  video_low_quality: 'Low quality',
};

export default function VideoReviewTab({ rows }: Props) {
  const [busyId, setBusyId] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [localDismiss, setLocalDismiss] = useState<Set<string>>(new Set());

  const pending = useMemo(
    () => rows.filter((r) => !localDismiss.has(r.asset_id)),
    [rows, localDismiss],
  );

  async function keepAsset(assetId: string) {
    setBusyId(assetId); setMsg(null);
    try {
      const res = await fetch('/api/marketing/media/clear-review', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ asset_id: assetId }),
      });
      const j = await res.json();
      if (!res.ok || !j?.ok) throw new Error(j?.error || 'clear_failed');
      setLocalDismiss((s) => new Set(s).add(assetId));
      setMsg('Kept — review flag cleared');
    } catch (e: any) { setMsg('Keep failed: ' + e.message); }
    finally { setBusyId(null); }
  }

  async function deleteAsset(assetId: string, filename: string | null) {
    if (!window.confirm('Confirm as junk: "' + (filename ?? assetId.slice(0, 8)) + '"? (soft-delete, reversible)')) return;
    setBusyId(assetId); setMsg(null);
    try {
      const res = await fetch('/api/marketing/media/confirm-junk', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ asset_id: assetId }),
      });
      const j = await res.json();
      if (!res.ok || !j?.ok) throw new Error(j?.error || 'junk_failed');
      setLocalDismiss((s) => new Set(s).add(assetId));
      setMsg('Deleted (soft) — confirmed as junk');
    } catch (e: any) { setMsg('Delete failed: ' + e.message); }
    finally { setBusyId(null); }
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
        <div>
          <div style={{ fontSize: 15, fontWeight: 700, color: INK }}>Video Review — junk cull</div>
          <div style={{ fontSize: 11, color: INK_M, marginTop: 2 }}>
            Flagged clips (unusable / low quality). Decide from poster + caption — no need to watch each one.
          </div>
        </div>
        <div style={{ fontSize: 11, color: INK_M }}>{pending.length.toLocaleString()} in queue</div>
      </div>

      {msg && (
        <div style={{ padding: '6px 10px', background: '#F7F0E1', border: '1px solid ' + HAIR, borderRadius: 4, marginBottom: 10, fontSize: 12, color: INK }}>
          {msg}
          <button onClick={() => setMsg(null)} style={{ marginLeft: 8, background: 'none', border: 'none', cursor: 'pointer', color: INK_M }}>x</button>
        </div>
      )}

      {pending.length === 0 ? (
        <div style={{ padding: 40, textAlign: 'center', color: INK_M, background: WHITE, border: '1px solid ' + HAIR, borderRadius: 4, fontSize: 12 }}>
          Review queue is empty — no clips are currently flagged.
          <div style={{ marginTop: 6, fontSize: 11 }}>
            Clips land here when the video AI flags them (video_unusable / video_low_quality) once analysis runs.
          </div>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 12 }}>
          {pending.map((r) => (
            <div key={r.asset_id} style={{ background: WHITE, border: '1px solid ' + HAIR, borderRadius: 4, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
              <div style={{ position: 'relative', aspectRatio: '16/9', minHeight: 130, background: CREAM }}>
                {r.poster_path ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={r.poster_path} alt={r.original_filename ?? ''} loading="lazy"
                    style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                ) : (
                  <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 4, color: INK_M, fontSize: 10 }}>
                    <div style={{ fontSize: 32, opacity: 0.35 }}>▶</div>
                    <div>poster pending</div>
                  </div>
                )}
                <div style={{ position: 'absolute', left: 4, top: 4, background: RED, color: WHITE, fontSize: 10, fontWeight: 700, padding: '2px 6px', borderRadius: 3 }}>
                  {REASON_LABEL[r.review_reason ?? ''] ?? (r.review_reason ?? 'flagged')}
                </div>
              </div>
              <div style={{ padding: '6px 8px', fontSize: 10, color: INK, borderTop: '1px solid ' + HAIR, display: 'flex', flexDirection: 'column', gap: 4, flex: 1 }}>
                <div title={r.original_filename ?? ''} style={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {r.original_filename ?? r.asset_id.slice(0, 8)}
                </div>
                {r.caption && (
                  <div style={{ color: INK_M, overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                    {r.caption}
                  </div>
                )}
                <div style={{ color: INK_M, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {r.video_type && <span>{r.video_type}</span>}
                  {r.usability_score != null && <span>· QI {r.usability_score}</span>}
                </div>
                <div style={{ display: 'flex', gap: 4, marginTop: 'auto', paddingTop: 4 }}>
                  <button
                    onClick={() => keepAsset(r.asset_id)}
                    disabled={busyId === r.asset_id}
                    title="Keep · clear review flag (fn_clear_review)"
                    style={{ flex: 1, padding: '5px 6px', fontSize: 10, fontWeight: 600, background: WHITE, color: FOREST, border: '1px solid ' + FOREST, borderRadius: 3, cursor: busyId === r.asset_id ? 'wait' : 'pointer' }}
                  >Keep</button>
                  <button
                    onClick={() => deleteAsset(r.asset_id, r.original_filename)}
                    disabled={busyId === r.asset_id}
                    title="Delete · confirm junk (fn_confirm_junk, soft-delete)"
                    style={{ flex: 1, padding: '5px 6px', fontSize: 10, fontWeight: 600, background: WHITE, color: RED, border: '1px solid ' + RED, borderRadius: 3, cursor: busyId === r.asset_id ? 'wait' : 'pointer' }}
                  >Delete</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
