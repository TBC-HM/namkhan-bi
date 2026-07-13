// app/marketing/media/_client/ReviewTab.tsx
// PBS 2026-07-14 · TASK 3 — new Review tab for photos flagged by Iris.
// Source: public.v_media_review_queue (needs_review=true rows).
// Actions per tile: clear review flag (fn_media_asset_clear_review) OR
// soft-delete (fn_media_asset_soft_delete). Chip filters: Non-Hotel · Low Quality.
'use client';

import { useMemo, useState } from 'react';

export interface ReviewRow {
  asset_id: string;
  original_filename: string | null;
  primary_tier: string | null;
  property_area: string | null;
  file_size_bytes: number | string | null;
  technical_score: number | null;
  aesthetic_score: number | null;
  marketing_score: number | null;
  quality_index: number | null;
  is_hotel_property: boolean | null;
  category: string | null;
  sub_category: string | null;
  review_reason: string | null;
  qa_notes: any;
  qa_scored_at: string | null;
  created_at: string | null;
  raw_path: string | null;
  master_path: string | null;
  mime_type: string | null;
  public_url: string | null;
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

type FilterKey = 'all' | 'non_hotel' | 'low_quality';

function reasonKind(reason: string | null | undefined): 'non_hotel' | 'low_quality' | 'other' {
  const r = (reason ?? '').toLowerCase();
  if (r.includes('hotel')) return 'non_hotel';
  if (r.includes('low quality') || r.includes('low-quality') || r.includes('quality')) return 'low_quality';
  return 'other';
}

function reasonBadge(reason: string | null | undefined): { label: string; bg: string; fg: string } {
  const k = reasonKind(reason);
  if (k === 'non_hotel') return { label: 'Non-Hotel', bg: '#FBE8E4', fg: RED };
  if (k === 'low_quality') return { label: 'Low quality (<30)', bg: '#FBEFD9', fg: AMBER };
  return { label: reason ?? 'Flagged', bg: CREAM, fg: INK_M };
}

export default function ReviewTab({ rows }: Props) {
  const [filter, setFilter] = useState<FilterKey>('all');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [localDismiss, setLocalDismiss] = useState<Set<string>>(new Set());
  const [selected, setSelected] = useState<ReviewRow | null>(null);

  const filtered = useMemo(() => {
    let out = rows.filter((r) => !localDismiss.has(r.asset_id));
    if (filter === 'non_hotel') out = out.filter((r) => reasonKind(r.review_reason) === 'non_hotel');
    if (filter === 'low_quality') out = out.filter((r) => reasonKind(r.review_reason) === 'low_quality');
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
    if (!window.confirm('Delete "' + (filename ?? assetId.slice(0, 8)) + '"? (soft-delete)')) return;
    setBusyId(assetId); setMsg(null);
    try {
      const res = await fetch('/api/marketing/media/asset-delete', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ asset_id: assetId }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || 'delete_failed');
      setLocalDismiss((s) => { const next = new Set(s); next.add(assetId); return next; });
      setSelected(null);
      setMsg('Deleted — refresh to sync');
    } catch (e: any) {
      setMsg('Delete failed: ' + e.message);
    } finally {
      setBusyId(null);
    }
  }

  const counts = useMemo(() => {
    const nonHotel = rows.filter((r) => reasonKind(r.review_reason) === 'non_hotel').length;
    const lowQual = rows.filter((r) => reasonKind(r.review_reason) === 'low_quality').length;
    return { total: rows.length, nonHotel, lowQual };
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
            {counts.total.toLocaleString()} flagged · {counts.nonHotel} non-hotel · {counts.lowQual} low-quality
          </div>
        </div>
        <div style={{ fontSize: 11, color: INK_M }}>{filtered.length.toLocaleString()} shown</div>
      </div>

      {/* Filter chips */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
        {([
          { k: 'all',         l: 'All',              n: counts.total },
          { k: 'non_hotel',   l: 'Non-Hotel Content', n: counts.nonHotel },
          { k: 'low_quality', l: 'Low Quality',       n: counts.lowQual },
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
            const b = reasonBadge(r.review_reason);
            return (
              <button
                key={r.asset_id}
                onClick={() => setSelected(r)}
                style={{
                  background: WHITE, border: '1px solid ' + HAIR, borderRadius: 4,
                  overflow: 'hidden', display: 'flex', flexDirection: 'column',
                  padding: 0, cursor: 'pointer', textAlign: 'left',
                }}
              >
                <div style={{ position: 'relative' }}>
                  {r.public_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={r.public_url} alt={r.original_filename ?? ''} loading="lazy"
                      style={{ width: '100%', aspectRatio: '16/9', minHeight: 160, objectFit: 'cover', background: '#F5F0E1', display: 'block' }} />
                  ) : (
                    <div style={{ width: '100%', aspectRatio: '16/9', minHeight: 160, background: '#F5F0E1', color: INK_M, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11 }}>no preview</div>
                  )}
                  <div
                    style={{
                      position: 'absolute', left: 4, bottom: 4,
                      background: b.bg, color: b.fg,
                      fontSize: 10, fontWeight: 700,
                      padding: '2px 6px', borderRadius: 3,
                      letterSpacing: '0.02em',
                      boxShadow: '0 1px 2px rgba(0,0,0,0.15)',
                    }}
                  >
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
                </div>
              </button>
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

            {selected.public_url && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={selected.public_url} alt={selected.original_filename ?? ''} style={{ width: '100%', maxHeight: 320, objectFit: 'contain', background: '#F5F0E1', borderRadius: 4 }} />
            )}

            <div style={{ background: CREAM, border: '1px solid ' + HAIR, borderRadius: 4, padding: 12, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, fontSize: 12 }}>
              <FieldRow label="Reason"        value={selected.review_reason ?? '—'} strong />
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
                Clear review flag
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
                Delete
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
