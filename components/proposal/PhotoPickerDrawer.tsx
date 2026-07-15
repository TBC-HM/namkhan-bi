'use client';
// components/proposal/PhotoPickerDrawer.tsx
// PBS 2026-07-16 — proposal composer photo picker.
// Reads public.v_proposal_photo_library (bridge over media.media_assets).
// HARD FILTER: target_usage_tiers && ARRAY['tier_ota_profile','tier_website_hero']
//   → only OTA + website tier photos, never internal / social / logos / archive.
// Block-context matching (when opened from a specific block):
//   room     block → prefers room_type_id = block.ref_id
//   activity block → prefers activity_id  = block.ref_id (fallback property_area='activity')
//   facility block → prefers facility_id  = block.ref_id (fallback property_area='facility')
//   fallback (no ref)→ all tier-ok photos, ordered by marketing_score DESC.
//
// Design: paper white + hairline, green ring on current pick. Empty state links
// to /marketing/media/library. Uses /api/marketing/media/preview for thumbs (v5
// download-through pattern) — same wire the Library page uses.

import { useEffect, useState, useCallback } from 'react';

export interface PhotoRow {
  asset_id: string;
  original_filename: string | null;
  caption: string | null;
  alt_text: string | null;
  property_area: string | null;
  room_type_id: number | null;
  activity_id: number | null;
  facility_id: number | null;
  primary_tier: string | null;
  marketing_score: number | null;
  aesthetic_score: number | null;
  width_px: number | null;
  height_px: number | null;
  aspect_ratio: string | null;
}

export interface BlockContext {
  block_type: 'room' | 'activity' | 'fnb' | 'spa' | 'transfer' | 'note' | 'facility';
  ref_id?: string | null;
  label?: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
  propertyId: number;
  block: BlockContext | null;
  currentAssetId?: string | null;
  onPick: (asset: PhotoRow) => void;
}

const PAPER = '#FFFFFF';
const INK = '#1B1B1B';
const INK_SOFT = '#5A5A5A';
const HAIRLINE = '#E6DFCC';
const PRIMARY = '#084838';
const PAPER_WARM = '#F5F0E1';

export default function PhotoPickerDrawer({ open, onClose, propertyId, block, currentAssetId, onPick }: Props) {
  const [rows, setRows] = useState<PhotoRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [scope, setScope] = useState<'context' | 'all'>('context');

  const load = useCallback(async () => {
    if (!open) return;
    setLoading(true);
    const params = new URLSearchParams({ property_id: String(propertyId), scope });
    if (block?.block_type) params.set('block_type', block.block_type);
    if (block?.ref_id)     params.set('ref_id',     String(block.ref_id));
    try {
      const r = await fetch(`/api/sales/proposals/photos?${params.toString()}`, { cache: 'no-store' });
      if (r.ok) {
        const j = await r.json();
        setRows((j.photos ?? []) as PhotoRow[]);
      } else {
        setRows([]);
      }
    } catch { setRows([]); }
    finally { setLoading(false); }
  }, [open, propertyId, block, scope]);

  useEffect(() => { load(); }, [load]);

  if (!open) return null;

  return (
    <div
      onClick={onClose}
      style={{ position: 'fixed', inset: 0, background: 'rgba(27,27,27,0.35)', zIndex: 60, display: 'flex', justifyContent: 'flex-end' }}
    >
      <aside
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 'min(880px, 96vw)', height: '100%', background: PAPER, color: INK,
          borderLeft: `1px solid ${HAIRLINE}`, overflow: 'auto',
          display: 'flex', flexDirection: 'column',
        }}
      >
        <header style={{
          padding: '18px 22px', borderBottom: `1px solid ${HAIRLINE}`,
          display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16,
          background: PAPER, position: 'sticky', top: 0, zIndex: 2,
        }}>
          <div>
            <div style={{
              fontFamily: 'var(--mono)', fontSize: 11, letterSpacing: '0.14em',
              textTransform: 'uppercase', color: INK_SOFT, marginBottom: 4,
            }}>
              Photo picker · {block?.block_type ?? 'any block'}
            </div>
            <div style={{ fontFamily: 'var(--serif)', fontSize: 20, color: INK }}>
              Choose <em style={{ color: PRIMARY }}>a photo</em>
              {block?.label ? <span style={{ color: INK_SOFT, fontStyle: 'normal' }}> — {block.label}</span> : null}
            </div>
            <div style={{ fontSize: 12, color: INK_SOFT, marginTop: 4 }}>
              OTA + Website tier only · {rows.length} match{rows.length === 1 ? '' : 'es'}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <div style={{ display: 'flex', gap: 4, background: PAPER_WARM, padding: 3, borderRadius: 4, border: `1px solid ${HAIRLINE}` }}>
              <button onClick={() => setScope('context')} className="btn" style={{
                background: scope === 'context' ? PRIMARY : 'transparent',
                color: scope === 'context' ? '#FFF' : INK,
                fontSize: 12, padding: '4px 10px',
              }}>Context</button>
              <button onClick={() => setScope('all')} className="btn" style={{
                background: scope === 'all' ? PRIMARY : 'transparent',
                color: scope === 'all' ? '#FFF' : INK,
                fontSize: 12, padding: '4px 10px',
              }}>All tier-ok</button>
            </div>
            <button onClick={onClose} className="btn" style={{ padding: '6px 10px' }}>×</button>
          </div>
        </header>

        <div style={{ padding: 22, flex: 1 }}>
          {loading && <p style={{ color: INK_SOFT, fontSize: 13 }}>Loading photos…</p>}
          {!loading && rows.length === 0 && (
            <div style={{
              padding: '48px 20px', textAlign: 'center', background: PAPER_WARM,
              border: `1px solid ${HAIRLINE}`, borderRadius: 6, color: INK_SOFT,
            }}>
              <p style={{ fontSize: 14, marginBottom: 8 }}>
                No tier-ok photos match {block?.block_type ? `this ${block.block_type} block` : 'this filter'} yet.
              </p>
              <p style={{ fontSize: 12, marginBottom: 14 }}>
                Add photos in the Media Library — set tier to OTA or Website and tag by area / room / activity.
              </p>
              <a href="/marketing/media/library" target="_blank" rel="noopener" style={{
                color: PRIMARY, fontFamily: 'var(--mono)', fontSize: 12,
                letterSpacing: '0.08em', textTransform: 'uppercase',
                textDecoration: 'underline',
              }}>
                Open Media Library →
              </a>
            </div>
          )}
          {!loading && rows.length > 0 && (
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
              gap: 12,
            }}>
              {rows.map(p => {
                const isCurrent = currentAssetId === p.asset_id;
                return (
                  <button
                    key={p.asset_id}
                    onClick={() => { onPick(p); onClose(); }}
                    style={{
                      display: 'flex', flexDirection: 'column',
                      padding: 0, cursor: 'pointer',
                      background: PAPER, color: INK,
                      border: `2px solid ${isCurrent ? PRIMARY : HAIRLINE}`,
                      borderRadius: 6, overflow: 'hidden', textAlign: 'left',
                      boxShadow: isCurrent ? '0 0 0 2px rgba(8,72,56,0.15)' : 'none',
                    }}
                    title={p.caption ?? p.original_filename ?? ''}
                  >
                    <div style={{
                      width: '100%', aspectRatio: '4/3', background: PAPER_WARM,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      overflow: 'hidden',
                    }}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={`/api/marketing/media/preview?asset_id=${p.asset_id}`}
                        alt={p.alt_text ?? p.original_filename ?? ''}
                        loading="lazy"
                        style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                        onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
                      />
                    </div>
                    <div style={{ padding: '8px 10px' }}>
                      <div style={{
                        fontSize: 12, color: INK,
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      }}>
                        {p.original_filename ?? 'untitled'}
                      </div>
                      <div style={{ fontSize: 10, color: INK_SOFT, marginTop: 3, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        {p.primary_tier && <span style={{
                          fontFamily: 'var(--mono)', letterSpacing: '0.06em',
                          textTransform: 'uppercase',
                        }}>{p.primary_tier.replace('tier_', '')}</span>}
                        {p.marketing_score != null && (
                          <span style={{ color: PRIMARY }}>{p.marketing_score}%</span>
                        )}
                        {p.property_area && <span>· {p.property_area}</span>}
                      </div>
                      {isCurrent && (
                        <div style={{
                          marginTop: 6, fontSize: 10, color: PRIMARY,
                          fontFamily: 'var(--mono)', letterSpacing: '0.08em',
                          textTransform: 'uppercase', fontWeight: 700,
                        }}>
                          Current pick
                        </div>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </aside>
    </div>
  );
}
