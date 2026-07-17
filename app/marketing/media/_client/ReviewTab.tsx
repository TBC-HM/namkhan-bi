// app/marketing/media/_client/ReviewTab.tsx
// PBS 2026-07-14 · TASK 3 — Review tab for photos flagged by Iris.
// PBS 2026-07-17 · media-pipeline-frontend brief · SCOPE 2 — swap to canonical
//   /confirm-junk (public.fn_confirm_junk) + /clear-review (public.fn_clear_review).
// Source: public.v_media_review_queue (all flagged, any status).
// Chip filters: Non-Hotel · Low Quality · Junk.
'use client';

import { useMemo, useState } from 'react';

export interface ReviewRow {
  asset_id: string;
  original_filename: string | null;
  primary_tier?: string | null;
  property_area?: string | null;
  file_size_bytes?: number | string | null;
  technical_score: number | null;
  aesthetic_score: number | null;
  marketing_score?: number | null;
  quality_index: number | null;
  is_hotel_property?: boolean | null;
  category: string | null;
  sub_category?: string | null;
  review_reason: string | null;
  qa_notes?: any;
  qa_scored_at?: string | null;
  created_at: string | null;
  raw_path?: string | null;
  master_path?: string | null;
  mime_type?: string | null;
  public_url?: string | null;
  status?: string | null;
  content_class?: string | null;
  needs_review?: boolean | null;
  property_id?: number | null;
}

interface Props {
  rows: ReviewRow[];
}

const WHITE  = '#FFFFFF';
const HAIR   = '#E6DFCC';
const INK    = '#1B1B1B';
const INK_M  = '#5A5A5A';
const FOREST = '#084838';
const AMBER  = '#B87F26';
const RED    = '#B23A2E';
const CREAM  = '#F5F0E1';

type FilterKey = 'all' | 'non_hotel' | 'low_quality' | 'junk';

function reasonKind(row: ReviewRow): 'non_hotel' | 'low_quality' | 'junk' | 'other' {
  if ((row.content_class ?? '').toLowerCase() === 'junk') return 'junk';
  const r = (row.review_reason ?? '').toLowerCase();
  if (r.includes('hotel')) return 'non_hotel';
  if (r.includes('low quality') || r.includes('low-quality') || r.includes('quality')) return 'low_quality';
  return 'other';
}

function reasonBadge(row: ReviewRow): { label: string; bg: string; fg: string } {
  const k = reasonKind(row);
  if (k === 'junk')        return { label: 'Junk',              bg: '#FBE8E4', fg: RED };
  if (k === 'non_hotel')   return { label: 'Non-Hotel',         bg: '#FBE8E4', fg: RED };
  if (k === 'low_quality') return { label: 'Low quality (<30)', bg: '#FBEFD9', fg: AMBER };
  return { label: row.review_reason ?? 'Flagged', bg: CREAM, fg: INK_M };
}

export default function ReviewTab({ rows }: Props) {
  const [filter, setFilter] = useState<FilterKey>('all');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [localDismiss, setLocalDismiss] = useState<Set<string>>(new Set());
  const [selected, setSelected] = useState<ReviewRow | null>(null);

  const filtered = useMemo(() => {
    let out = rows.filter((r) => !localDismiss.has(r.asset_id));
    if (filter !== 'all') out = out.filter((r) => reasonKind(r) === filter);
    return out;
  }, [rows, filter, localDismiss]);

  async function clearFlag(assetId: string) {
    setBusyId(assetId); setMsg(null);
    try {
      const res = await fetch('/api/marketing/media/clear-review', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ asset_id: assetId }),
      });
      const j = await res.json();
      if (!res.ok || !j?.ok) throw new Error(j?.error || 'clear_failed');
      setLocalDismiss((s) => { const next = new Set(s); next.add(assetId); return next; });
      setSelected(null);
      setMsg('Review flag cleared — refresh to sync');
    } catch (e: any) {
      setMsg('Clear failed: ' + e.message);
    } finally {
      setBusyId(null);
    }
  }

  async function deleteAsset(assetId: string, filename: string | null) {
    if (!window.confirm('Confirm as junk: "' + (filename ?? assetId.slice(0, 8)) + '"? (reversible soft-delete via fn_confirm_junk)')) return;
    setBusyId(assetId); setMsg(null);
    try {
      const res = await fetch('/api/marketing/media/confirm-junk', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ asset_id: assetId }),
      });
      const j = await res.json();
      if (!res.ok || !j?.ok) throw new Error(j?.error || 'junk_failed');
      setLocalDismiss((s) => { const next = new Set(s); next.add(assetId); return next; });
      setSelected(null);
      setMsg('Confirmed junk — refresh to sync');
    } catch (e: any) {
      setMsg('Junk-confirm failed: ' + e.message);
    } finally {
      setBusyId(null);
    }
  }

  // PBS 2026-07-17 · Archive from Review — demote to tier_archive AND clear the
  // review flag in one action, so the photo leaves the queue but stays in the
  // library under Archive tier (recoverable, not deleted).
  async function archiveAsset(assetId: string) {
    setBusyId(assetId); setMsg(null);
    try {
      const [tierRes, clearRes] = await Promise.all([
        fetch('/api/marketing/media/asset-update', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ asset_id: assetId, primary_tier: 'tier_archive' }),
        }),
        fetch('/api/marketing/media/clear-review', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ asset_id: assetId }),
        }),
      ]);
      if (!tierRes.ok)  throw new Error('tier_set_failed');
      if (!clearRes.ok) throw new Error('clear_review_failed');
      setLocalDismiss((s) => { const next = new Set(s); next.add(assetId); return next; });
      setSelected(null);
      setMsg('Archived — moved to Archive tier');
    } catch (e: any) {
      setMsg('Archive failed: ' + e.message);
    } finally {
      setBusyId(null);
    }
  }

  const counts = useMemo(() => {
    const nonHotel = rows.filter((r) => reasonKind(r) === 'non_hotel').length;
    const lowQual  = rows.filter((r) => reasonKind(r) === 'low_quality').length;
    const junk     = rows.filter((r) => reasonKind(r) === 'junk').length;
    return { total: rows.length, nonHotel, lowQual, junk };
  }, [rows]);

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
        <div>
          <div style={{ fontSize: 15, fontWeight: 700, color: INK }}>
            Review Queue — photos flagged by Iris
          </div>
          <div style={{ fontSize: 11, color: INK_M, marginTop: 2 }}>
            {counts.total.toLocaleString()} flagged · {counts.nonHotel} non-hotel · {counts.lowQual} low-quality · {counts.junk} junk
          </div>
        </div>
        <div style={{ fontSize: 11, color: INK_M }}>{filtered.length.toLocaleString()} shown</div>
      </div>

      {/* Filter chips */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
        {([
          { k: 'all',         l: 'All',               n: counts.total },
          { k: 'non_hotel',   l: 'Non-Hotel Content', n: counts.nonHotel },
          { k: 'low_quality', l: 'Low Quality',       n: counts.lowQual },
          { k: 'junk',        l: 'Junk',              n: counts.junk },
        ] as Array<{ k: FilterKey; l: string; n: number }>).map((c) => {
          const active = filter === c.k;
          return (
            <button
              key={c.k}
              onClick={() => setFilter(c.k)}
              style={{
                padding: '6px 12px', fontSize: 11, fontWeight: 600, borderRadius: 4,
                border: '1px solid ' + (active ? FOREST : HAIR),
                background: active ? FOREST : WHITE,
                color: active ? WHITE : INK,
                cursor: 'pointer',
              }}
            >
              {c.l} <span style={{ opacity: 0.7 }}>· {c.n}</span>
            </button>
          );
        })}
      </div>

      {msg && (
        <div style={{ padding: '8px 12px', background: '#F7F0E1', border: '1px solid ' + HAIR, borderRadius: 4, marginBottom: 12, fontSize: 12, color: INK }}>
          {msg}
          <button onClick={() => setMsg(null)} style={{ marginLeft: 8, background: 'none', border: 'none', cursor: 'pointer', color: INK_M }}>x</button>
        </div>
      )}

      {/* Grid */}
      {filtered.length === 0 ? (
        <div style={{ padding: 40, textAlign: 'center', color: INK_M, background: WHITE, border: '1px solid ' + HAIR, borderRadius: 4 }}>
          No photos in the review queue.
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 12 }}>
          {filtered.map((r) => {
            const b = reasonBadge(r);
            return (
              <div
                key={r.asset_id}
                style={{
                  background: WHITE, border: '1px solid ' + HAIR, borderRadius: 4,
                  overflow: 'hidden', display: 'flex', flexDirection: 'column',
                  padding: 0, textAlign: 'left',
                }}
              >
                {/* PBS 2026-07-17 · tile no longer a button — inline action row
                    below the image handles Keep / Archive / Delete without
                    opening the drawer. Click the image to open the drawer for
                    the full classification detail. */}
                <div style={{ position: 'relative', cursor: 'pointer' }} onClick={() => setSelected(r)}>
                  {(() => {
                    const src = r.public_url || ('/api/marketing/media/preview-any?asset_id=' + r.asset_id);
                    return (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={src} alt={r.original_filename ?? ''} loading="lazy"
                        style={{ width: '100%', aspectRatio: '16/9', minHeight: 160, objectFit: 'cover', background: '#F5F0E1', display: 'block' }} />
                    );
                  })()}
                  <div style={{
                    position: 'absolute', left: 4, bottom: 4,
                    background: b.bg, color: b.fg,
                    fontSize: 10, fontWeight: 700,
                    padding: '2px 6px', borderRadius: 3,
                    letterSpacing: '0.02em',
                    boxShadow: '0 1px 2px rgba(0,0,0,0.15)',
                  }}>
                    {b.label}
                  </div>
                </div>
                <div style={{ padding: '6px 8px', fontSize: 10, color: INK, borderTop: '1px solid ' + HAIR, flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <div style={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {r.original_filename ?? r.asset_id.slice(0, 8)}
                  </div>
                  <div style={{ color: INK_M, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {r.quality_index != null && <span>QI {Math.round(Number(r.quality_index))}</span>}
                    {r.category && <span>· {r.category}</span>}
                  </div>
                  {/* PBS 2026-07-17 · inline actions — no drawer needed */}
                  <div style={{ display: 'flex', gap: 4, marginTop: 4 }}>
                    <button
                      onClick={() => clearFlag(r.asset_id)}
                      disabled={busyId === r.asset_id}
                      title="Keep this photo — clear the review flag"
                      style={{
                        flex: 1, padding: '4px 6px', fontSize: 10, fontWeight: 600,
                        background: WHITE, color: FOREST, border: '1px solid ' + FOREST,
                        borderRadius: 3, cursor: busyId === r.asset_id ? 'wait' : 'pointer',
                      }}
                    >Keep</button>
                    <button
                      onClick={() => archiveAsset(r.asset_id)}
                      disabled={busyId === r.asset_id}
                      title="Move to Archive tier — keeps the file, out of active library"
                      style={{
                        flex: 1, padding: '4px 6px', fontSize: 10, fontWeight: 600,
                        background: WHITE, color: AMBER, border: '1px solid ' + AMBER,
                        borderRadius: 3, cursor: busyId === r.asset_id ? 'wait' : 'pointer',
                      }}
                    >Archive</button>
                    <button
                      onClick={() => deleteAsset(r.asset_id, r.original_filename)}
                      disabled={busyId === r.asset_id}
                      title="Confirm as junk — soft-delete (reversible)"
                      style={{
                        flex: 1, padding: '4px 6px', fontSize: 10, fontWeight: 600,
                        background: WHITE, color: RED, border: '1px solid ' + RED,
                        borderRadius: 3, cursor: busyId === r.asset_id ? 'wait' : 'pointer',
                      }}
                    >Delete</button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Simple inline review drawer (avoids AssetEditDrawer edit collision) */}
      {selected && (
        <div
          onClick={() => setSelected(null)}
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
            display: 'flex', justifyContent: 'flex-end', zIndex: 1000,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: 'min(560px, 100%)', height: '100vh', background: WHITE,
              borderLeft: '1px solid ' + HAIR, overflow: 'auto', padding: 20,
              display: 'flex', flexDirection: 'column', gap: 14,
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: INK }}>
                Iris classification
              </div>
              <button onClick={() => setSelected(null)} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: INK_M, lineHeight: 1 }}>x</button>
            </div>

            {(() => {
              const src = selected.public_url || ('/api/marketing/media/preview-any?asset_id=' + selected.asset_id);
              return (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={src} alt={selected.original_filename ?? ''} style={{ width: '100%', maxHeight: 320, objectFit: 'contain', background: '#F5F0E1', borderRadius: 4 }} />
              );
            })()}

            <div style={{ background: CREAM, border: '1px solid ' + HAIR, borderRadius: 4, padding: 12, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, fontSize: 12 }}>
              <FieldRow label="Reason"        value={selected.review_reason ?? '—'} strong />
              <FieldRow label="Content class" value={selected.content_class ?? '—'} />
              <FieldRow label="Category"      value={selected.category ?? '—'} />
              <FieldRow label="Sub-category"  value={selected.sub_category ?? '—'} />
              <FieldRow label="Is hotel?"     value={selected.is_hotel_property == null ? '—' : (selected.is_hotel_property ? 'yes' : 'no')} />
              <FieldRow label="Quality index" value={selected.quality_index != null ? Math.round(Number(selected.quality_index)) + '%' : '—'} />
              <FieldRow label="Technical"     value={selected.technical_score != null ? String(selected.technical_score) : '—'} />
              <FieldRow label="Aesthetic"     value={selected.aesthetic_score != null ? String(selected.aesthetic_score) : '—'} />
              <FieldRow label="Marketing"     value={selected.marketing_score != null ? String(selected.marketing_score) : '—'} />
            </div>

            {selected.qa_notes && (
              <div style={{ fontSize: 11, color: INK_M, background: WHITE, border: '1px solid ' + HAIR, borderRadius: 4, padding: 10, maxHeight: 180, overflow: 'auto', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                {typeof selected.qa_notes === 'string' ? selected.qa_notes : JSON.stringify(selected.qa_notes, null, 2)}
              </div>
            )}

            <div style={{ fontSize: 11, color: INK_M }}>
              File: {selected.original_filename ?? selected.asset_id}
            </div>

            {/* Actions */}
            <div style={{ display: 'flex', gap: 10, marginTop: 'auto' }}>
              <button
                onClick={() => clearFlag(selected.asset_id)}
                disabled={busyId === selected.asset_id}
                style={{
                  flex: 1, padding: '12px 16px', fontSize: 13, fontWeight: 700,
                  background: FOREST, color: WHITE, border: 'none', borderRadius: 4,
                  cursor: busyId === selected.asset_id ? 'not-allowed' : 'pointer',
                  opacity: busyId === selected.asset_id ? 0.6 : 1,
                }}
              >
                Keep · clear review flag
              </button>
              <button
                onClick={() => deleteAsset(selected.asset_id, selected.original_filename)}
                disabled={busyId === selected.asset_id}
                style={{
                  flex: 1, padding: '12px 16px', fontSize: 13, fontWeight: 700,
                  background: WHITE, color: RED, border: '1px solid ' + RED, borderRadius: 4,
                  cursor: busyId === selected.asset_id ? 'not-allowed' : 'pointer',
                  opacity: busyId === selected.asset_id ? 0.6 : 1,
                }}
              >
                Delete · confirm junk
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function FieldRow({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div>
      <div style={{ fontSize: 10, color: INK_M, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: 12, color: INK, fontWeight: strong ? 700 : 500, wordBreak: 'break-word' }}>{value}</div>
    </div>
  );
}