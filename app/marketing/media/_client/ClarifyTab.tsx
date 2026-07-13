// app/marketing/media/_client/ClarifyTab.tsx
// PBS 2026-07-12 — Clarify tab.
// 2026-07-13 · Coordinator scope-add — PICS clarify skips videos.
// 2026-07-13 pm · MEDIA QA v1 — tile now shows bottom-right quality badge.
// 2026-07-14 · MEDIA QA v2 — tile now displays seo_target_filename (Iris SEO)
//   with original_filename kept as a hover tooltip. Naming failures no longer
//   surface here — the RPC auto-applies Iris's compliant filename at score time.
'use client';

import { useMemo, useState } from 'react';
import AssetEditDrawer, { type AssetEditRow, type DrawerTaxonomy } from './AssetEditDrawer';
import VideoPlayerModal, { type VideoPlayerAsset } from './VideoPlayerModal';
import { qaBadge } from '@/lib/mediaQa';

interface MediaRow {
  asset_id: string;
  original_filename: string | null;
  seo_target_filename?: string | null;
  primary_tier: string | null;
  property_area: string | null;
  public_url: string | null;
  master_path: string | null;
  mime_type: string | null;
  status: string | null;
  width_px: number | null;
  height_px: number | null;
  file_size_bytes: number | string | null;
  file_size_human: string | null;
  created_at: string | null;
  quality_index?: number | null;
  technical_score?: number | null;
  aesthetic_score?: number | null;
  marketing_score?: number | null;
  qa_notes?: any;
  qa_scored_at?: string | null;
}

// PBS 2026-07-14 · display swap — prefer Iris SEO filename, keep original as tooltip.
function displayName(r: MediaRow): string {
  const seo = (r.seo_target_filename ?? '').trim();
  if (seo) return seo;
  const orig = (r.original_filename ?? '').trim();
  if (orig) return orig;
  return r.asset_id.slice(0, 8);
}

interface Props {
  mediaPage: MediaRow[];
  areaOptions: string[];
  rooms?: Array<{ room_type_id: number; room_type_name: string }>;
  taxonomy?: DrawerTaxonomy;
}

const WHITE  = '#FFFFFF';
const HAIR   = '#E6DFCC';
const INK    = '#1B1B1B';
const INK_M  = '#5A5A5A';
const RED    = '#B23A2E';

function isVideoRow(r: MediaRow): boolean {
  const mt = (r.mime_type ?? '').toLowerCase();
  if (mt.startsWith('video/')) return true;
  const p = (r.public_url ?? r.master_path ?? '').toLowerCase();
  return /\.(mp4|mov|webm|m4v)(\?|$)/.test(p);
}

export default function ClarifyTab({ mediaPage, areaOptions, rooms = [], taxonomy }: Props) {
  const [editing, setEditing] = useState<MediaRow | null>(null);
  const [playing, setPlaying] = useState<MediaRow | null>(null);
  const [localDismiss, setLocalDismiss] = useState<Set<string>>(new Set());

  const photos = useMemo(() => mediaPage.filter(r => !isVideoRow(r)), [mediaPage]);

  const clarify = useMemo(() => {
    return photos.filter(r => {
      if (localDismiss.has(r.asset_id)) return false;
      return r.property_area == null || r.primary_tier == null;
    });
  }, [photos, localDismiss]);

  const stats = useMemo(() => {
    const total = photos.length;
    const withArea = photos.filter(r => r.property_area != null).length;
    const withTier = photos.filter(r => r.primary_tier != null).length;
    const clean = photos.filter(r => r.property_area != null && r.primary_tier != null).length;
    return { toClarify: clarify.length, withArea, withTier, clean, total };
  }, [photos, clarify.length]);

  return (
    <div>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(160px, 1fr))', gap:8, marginBottom:16 }}>
        {[
          { label: 'To clarify', value: stats.toClarify, tone: stats.toClarify > 0 ? RED : INK },
          { label: 'With area',  value: stats.withArea },
          { label: 'With tier',  value: stats.withTier },
          { label: 'Clean',      value: stats.clean },
        ].map((t, i) => (
          <div key={i} style={{ background:WHITE, border:'1px solid '+HAIR, borderRadius:6, padding:'12px 14px' }}>
            <div style={{ fontSize:10, letterSpacing:'0.06em', textTransform:'uppercase', color:INK_M, marginBottom:4 }}>{t.label}</div>
            <div style={{ fontSize:22, fontWeight:700, color: t.tone ?? INK }}>{t.value.toLocaleString()}</div>
          </div>
        ))}
      </div>

      {clarify.length === 0 ? (
        <div style={{ padding:40, textAlign:'center', color:INK_M, background:WHITE, border:'1px solid '+HAIR, borderRadius:4 }}>
          Nothing to clarify — every photo has an area and a tier. Videos live in the Videos → Clarify tab.
        </div>
      ) : (
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(180px, 1fr))', gap:12 }}>
          {clarify.map(r => {
            const badges: Array<{ k: string; label: string }> = [];
            if (!r.property_area) badges.push({ k: 'area', label: '?area' });
            if (!r.primary_tier)  badges.push({ k: 'tier', label: '?tier' });
            const qBadge = qaBadge(r.quality_index ?? null);
            return (
              <button key={r.asset_id} onClick={() => setEditing(r)} style={{
                background: WHITE, border: '1px solid ' + HAIR, borderRadius: 4, overflow: 'hidden',
                display: 'flex', flexDirection: 'column', padding: 0, cursor: 'pointer', textAlign: 'left',
              }}>
                <div style={{ position: 'relative', width: '100%', height: 120, background: '#F5F0E1' }}>
                  {r.public_url ? (
                    isVideoRow(r) ? (
                      <video
                        src={r.public_url}
                        preload="metadata"
                        muted
                        playsInline
                        onLoadedMetadata={(e) => {
                          const v = e.currentTarget;
                          const d = Number.isFinite(v.duration) ? v.duration : 0;
                          v.currentTime = d > 0 ? Math.min(d * 0.1, 3) : 0;
                        }}
                        style={{ width:'100%', height:'100%', objectFit:'cover', background:'#F5F0E1', display:'block' }}
                      />
                    ) : (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={r.public_url} alt={r.original_filename ?? ''} loading="lazy" style={{ width:'100%', height:'100%', objectFit:'cover' }} />
                    )
                  ) : (
                    <div style={{ width:'100%', height:'100%', display:'flex', alignItems:'center', justifyContent:'center', fontSize:10, color:INK_M }}>no preview</div>
                  )}
                  <div style={{ position:'absolute', top:6, left:6, display:'flex', gap:4 }}>
                    {badges.map(b => (
                      <span key={b.k} style={{
                        background: RED, color: WHITE, fontSize: 10, fontWeight: 700,
                        padding: '2px 6px', borderRadius: 3, letterSpacing: '0.02em',
                      }}>{b.label}</span>
                    ))}
                  </div>
                  {/* QA badge — bottom-right */}
                  <div title={r.quality_index != null ? 'Quality index ' + r.quality_index + '%' : 'Not scored yet'} style={{
                    position:'absolute', right:4, bottom:4,
                    background: qBadge.bg, color: qBadge.fg,
                    fontSize: 10, fontWeight: 700, padding: '2px 6px', borderRadius: 3,
                    letterSpacing: '0.02em', fontVariantNumeric: 'tabular-nums',
                    boxShadow: '0 1px 2px rgba(0,0,0,0.15)',
                  }}>{qBadge.label}</div>
                  {r.public_url && isVideoRow(r) && (
                    <span
                      role="button"
                      tabIndex={0}
                      aria-label="Play video"
                      onClick={(e) => { e.stopPropagation(); e.preventDefault(); setPlaying(r); }}
                      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.stopPropagation(); e.preventDefault(); setPlaying(r); } }}
                      style={{
                        position:'absolute', top:'50%', left:'50%', transform:'translate(-50%, -50%)',
                        width:28, height:28, borderRadius:14, background:'#084838',
                        color:'#FFFFFF', fontSize:12, cursor:'pointer',
                        display:'flex', alignItems:'center', justifyContent:'center', fontWeight:700,
                        boxShadow:'0 2px 8px rgba(0,0,0,0.3)', zIndex:2,
                      }}
                    >▶</span>
                  )}
                </div>
                <div style={{ padding:'6px 8px', borderTop:'1px solid '+HAIR, fontSize:10 }}>
                  <div
                    title={r.original_filename ? 'Original: ' + r.original_filename : undefined}
                    style={{ color:INK, fontWeight:600, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}
                  >
                    {displayName(r)}
                  </div>
                  <div style={{ color:INK_M, marginTop:2 }}>Click to edit ✎</div>
                </div>
              </button>
            );
          })}
        </div>
      )}

      <AssetEditDrawer
        open={editing != null}
        onClose={() => setEditing(null)}
        asset={editing as AssetEditRow | null}
        areaOptions={areaOptions}
        rooms={rooms}
        taxonomy={taxonomy}
        onSaved={(updated) => {
          if (updated?.asset_id) {
            setLocalDismiss(s => new Set(s).add(updated.asset_id));
          }
        }}
      />

      <VideoPlayerModal
        open={playing != null}
        onClose={() => setPlaying(null)}
        asset={playing as VideoPlayerAsset | null}
      />
    </div>
  );
}
