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
// PBS 2026-07-16 (redesign) — clean paper-white modern design; drop legacy
// mono/serif tokens and "Open Media Library →" leave-page link. Empty state now
// switches scope inline (Context → All property photos) without navigating away.

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

const T = {
  paper:    '#FFFFFF',
  hairline: '#E6DFCC',
  warm:     '#F5F0E1',
  ink:      '#1B1B1B',
  inkSoft:  '#5A5A5A',
  inkMute:  '#8A8A8A',
  green:    '#084838',
  greenSoft:'#EAF1EE',
  sans:     'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
} as const;

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

  // Reset scope back to context whenever the drawer reopens for a new block.
  useEffect(() => { if (open) setScope('context'); }, [open, block?.ref_id]);

  if (!open) return null;

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0,
        background: 'rgba(27,27,27,0.4)',
        zIndex: 60, display: 'flex', justifyContent: 'flex-end',
        fontFamily: T.sans,
      }}
    >
      <aside
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 'min(920px, 96vw)', height: '100%',
          background: T.paper, color: T.ink,
          borderLeft: `1px solid ${T.hairline}`,
          overflow: 'auto',
          display: 'flex', flexDirection: 'column',
        }}
      >
        {/* HEADER */}
        <header style={{
          padding: '18px 22px',
          borderBottom: `1px solid ${T.hairline}`,
          background: T.paper,
          position: 'sticky', top: 0, zIndex: 2,
          display: 'flex', flexDirection: 'column', gap: 10,
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16 }}>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 17, fontWeight: 600, color: T.ink, marginBottom: 2 }}>
                Choose a photo
                {block?.label ? <span style={{ color: T.inkSoft, fontWeight: 400 }}> · {block.label}</span> : null}
              </div>
              <div style={{ fontSize: 12, color: T.inkSoft }}>
                OTA + Website tier only · {rows.length} match{rows.length === 1 ? '' : 'es'}
                {scope === 'all' && <span style={{ marginLeft: 8, color: T.green }}>· showing all property photos</span>}
              </div>
            </div>
            <button
              onClick={onClose}
              aria-label="Close"
              style={{
                background: 'transparent', border: `1px solid ${T.hairline}`,
                width: 30, height: 30, borderRadius: 4, cursor: 'pointer',
                color: T.ink, fontSize: 15, lineHeight: 1,
              }}
            >×</button>
          </div>

          {/* SCOPE TOGGLE */}
          <div style={{
            display: 'inline-flex', gap: 0,
            border: `1px solid ${T.hairline}`, borderRadius: 4,
            background: T.paper, alignSelf: 'flex-start',
          }}>
            <button
              onClick={() => setScope('context')}
              style={{
                background: scope === 'context' ? T.green : 'transparent',
                color: scope === 'context' ? '#FFF' : T.ink,
                border: 0, padding: '6px 14px',
                fontSize: 12, fontWeight: 500, cursor: 'pointer',
                borderRadius: '3px 0 0 3px',
              }}
            >Linked to this block</button>
            <div style={{ width: 1, background: T.hairline }} />
            <button
              onClick={() => setScope('all')}
              style={{
                background: scope === 'all' ? T.green : 'transparent',
                color: scope === 'all' ? '#FFF' : T.ink,
                border: 0, padding: '6px 14px',
                fontSize: 12, fontWeight: 500, cursor: 'pointer',
                borderRadius: '0 3px 3px 0',
              }}
            >All property photos</button>
          </div>
        </header>

        {/* BODY */}
        <div style={{ padding: 22, flex: 1 }}>
          {loading && (
            <p style={{ color: T.inkSoft, fontSize: 13 }}>Loading photos…</p>
          )}

          {!loading && rows.length === 0 && (
            <div style={{
              padding: '48px 20px', textAlign: 'center',
              background: T.warm, border: `1px solid ${T.hairline}`,
              borderRadius: 6, color: T.inkSoft,
            }}>
              <p style={{ fontSize: 14, marginBottom: 12, color: T.ink }}>
                {scope === 'context'
                  ? 'No photos linked to this specific item yet.'
                  : 'No photos match the current tier filter.'}
              </p>
              {scope === 'context' ? (
                <button
                  onClick={() => setScope('all')}
                  style={{
                    background: T.green, color: '#FFF', border: 0,
                    padding: '9px 18px', borderRadius: 4,
                    fontSize: 12, fontWeight: 600, cursor: 'pointer',
                  }}
                >
                  Show all property photos →
                </button>
              ) : (
                <p style={{ fontSize: 12, color: T.inkSoft, marginTop: 8 }}>
                  Add OTA / Website tier photos in the Media Library first.
                </p>
              )}
            </div>
          )}

          {!loading && rows.length > 0 && (
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
              gap: 12,
            }}>
              {rows.map((p) => {
                const isCurrent = currentAssetId === p.asset_id;
                return (
                  <button
                    key={p.asset_id}
                    onClick={() => { onPick(p); onClose(); }}
                    title={p.caption ?? p.original_filename ?? ''}
                    style={{
                      display: 'flex', flexDirection: 'column',
                      padding: 0, cursor: 'pointer',
                      background: T.paper, color: T.ink,
                      border: `2px solid ${isCurrent ? T.green : T.hairline}`,
                      borderRadius: 6, overflow: 'hidden', textAlign: 'left',
                      boxShadow: isCurrent ? '0 0 0 2px rgba(8,72,56,0.15)' : 'none',
                      transition: 'border-color 120ms',
                    }}
                  >
                    {/* THUMB */}
                    <div style={{
                      position: 'relative',
                      width: '100%', aspectRatio: '4/3', background: T.warm,
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
                      {/* Score badge top-right */}
                      {p.marketing_score != null && (
                        <span style={{
                          position: 'absolute', top: 6, right: 6,
                          background: 'rgba(27,27,27,0.75)', color: '#FFF',
                          fontSize: 10, fontWeight: 600,
                          padding: '2px 6px', borderRadius: 3,
                        }}>{p.marketing_score}</span>
                      )}
                      {/* Current pick badge top-left */}
                      {isCurrent && (
                        <span style={{
                          position: 'absolute', top: 6, left: 6,
                          background: T.green, color: '#FFF',
                          fontSize: 10, fontWeight: 600,
                          padding: '2px 6px', borderRadius: 3,
                        }}>Current</span>
                      )}
                    </div>
                    {/* META */}
                    <div style={{ padding: '8px 10px' }}>
                      <div style={{
                        fontSize: 12, color: T.ink,
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      }}>
                        {p.original_filename ?? 'untitled'}
                      </div>
                      <div style={{
                        fontSize: 10, color: T.inkSoft, marginTop: 3,
                        display: 'flex', gap: 6, flexWrap: 'wrap',
                      }}>
                        {p.primary_tier && (
                          <span>{p.primary_tier.replace('tier_', '').replace('_', ' ')}</span>
                        )}
                        {p.property_area && <span>· {p.property_area}</span>}
                      </div>
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
