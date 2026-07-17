// app/marketing/media/_client/ClarifyTab.tsx
// PBS 2026-07-12 — Clarify tab.
// 2026-07-13 · Coordinator scope-add — PICS clarify skips videos.
// 2026-07-13 pm · MEDIA QA v1 — tile now shows bottom-right quality badge.
// 2026-07-14 · MEDIA QA v2 — tile now displays seo_target_filename (Iris SEO)
//   with original_filename kept as a hover tooltip.
// PBS 2026-07-17 · media-pipeline-frontend brief · SCOPE 3 — inline area
//   dropdown per tile fed by v_media_area_taxonomy; one-click confirm →
//   /api/marketing/media/clarify-assign (fn_assign_area / fn_place_destination).
//   Header banner: "Iris suggests · Lens confirms". AssetEditDrawer stays as
//   the deep-edit fallback (click filename).
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

export interface ClarifyAreaTaxonomyRow {
  property_id: number;
  kind: string;
  sort_order: number;
  ref_id: string | null;
  area_key: string;
  name: string;
  extra: string | null;
  photo_count: number | null;
}

interface Props {
  mediaPage: MediaRow[];
  areaOptions: string[];
  rooms?: Array<{ room_type_id: number; room_type_name: string }>;
  taxonomy?: DrawerTaxonomy;
  areaTaxonomy?: ClarifyAreaTaxonomyRow[];
}

const WHITE  = '#FFFFFF';
const HAIR   = '#E6DFCC';
const INK    = '#1B1B1B';
const INK_M  = '#5A5A5A';
const RED    = '#B23A2E';
const FOREST = '#084838';
const CREAM  = '#F5F0E1';

const KIND_LABEL: Record<string, string> = {
  rooms: 'Rooms',
  facilities: 'Facilities',
  activities: 'Activities',
  certifications: 'Certifications',
  team: 'Team',
  destination: 'Destination',
  other: 'Other',
  uncategorized: 'Uncategorized',
};

function isVideoRow(r: MediaRow): boolean {
  const mt = (r.mime_type ?? '').toLowerCase();
  if (mt.startsWith('video/')) return true;
  const p = (r.public_url ?? r.master_path ?? '').toLowerCase();
  return /\.(mp4|mov|webm|m4v)(\?|$)/.test(p);
}

export default function ClarifyTab({ mediaPage, areaOptions, rooms = [], taxonomy, areaTaxonomy = [] }: Props) {
  const [editing, setEditing] = useState<MediaRow | null>(null);
  const [playing, setPlaying] = useState<MediaRow | null>(null);
  const [localDismiss, setLocalDismiss] = useState<Set<string>>(new Set());
  const [busyId, setBusyId] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const photos = useMemo(() => mediaPage.filter(r => !isVideoRow(r)), [mediaPage]);

  // SCOPE 3 — dropdown option groups from v_media_area_taxonomy.
  const taxonomyGroups = useMemo(() => {
    const groups: Array<{ kind: string; label: string; rows: ClarifyAreaTaxonomyRow[] }> = [];
    const byKind = new Map<string, ClarifyAreaTaxonomyRow[]>();
    for (const r of areaTaxonomy) {
      const k = r.kind;
      if (!byKind.has(k)) byKind.set(k, []);
      byKind.get(k)!.push(r);
    }
    const order = ['rooms', 'facilities', 'activities', 'certifications', 'team', 'destination', 'other'];
    for (const k of order) {
      const rows = byKind.get(k);
      if (rows && rows.length) groups.push({ kind: k, label: KIND_LABEL[k] ?? k, rows });
    }
    return groups;
  }, [areaTaxonomy]);

  async function inlineAssign(row: MediaRow, taxRow: ClarifyAreaTaxonomyRow) {
    setBusyId(row.asset_id); setMsg(null);
    try {
      const payload: Record<string, unknown> = {
        asset_id: row.asset_id,
        kind: taxRow.kind,
        ref_id: taxRow.kind === 'destination'
          ? (taxRow.ref_id ?? taxRow.area_key)
          : (taxRow.ref_id ?? null),
        area_key: taxRow.area_key,
      };
      const res = await fetch('/api/marketing/media/clarify-assign', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const j = await res.json();
      if (!res.ok || !j?.ok) throw new Error(j?.error || 'assign_failed');
      setLocalDismiss(s => new Set(s).add(row.asset_id));
      setMsg('Assigned ' + taxRow.name + ' — row cleared');
    } catch (e: any) {
      setMsg('Assign failed: ' + e.message);
    } finally {
      setBusyId(null);
    }
  }

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
      {/* SCOPE 3 · Iris/Lens header banner */}
      <div style={{
        background: CREAM, border: '1px solid ' + HAIR, borderRadius: 4,
        padding: '8px 12px', marginBottom: 12, fontSize: 12, color: INK,
        display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap',
      }}>
        <strong style={{ color: FOREST }}>Iris</strong>
        <span style={{ color: INK_M }}>suggests</span>
        <span style={{ color: INK_M }}>·</span>
        <strong style={{ color: FOREST }}>Lens</strong>
        <span style={{ color: INK_M }}>confirms</span>
        <span style={{ color: INK_M, marginLeft: 'auto', fontSize: 11 }}>
          {taxonomyGroups.length > 0
            ? 'pick an area from the dropdown to file this photo in one click'
            : 'loading area taxonomy…'}
        </span>
      </div>

      {msg && (
        <div style={{ padding:'6px 10px', background:'#F7F0E1', border:'1px solid '+HAIR, borderRadius:4, marginBottom:10, fontSize:12, color:INK }}>
          {msg}
          <button onClick={() => setMsg(null)} style={{ marginLeft: 8, background: 'none', border: 'none', cursor: 'pointer', color: INK_M }}>x</button>
        </div>
      )}

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
                  {/* SCOPE 3 · inline area dropdown — one-click file to a Settings-driven area or destination folder */}
                  {taxonomyGroups.length > 0 ? (
                    <div style={{ marginTop:4 }} onClick={(e) => e.stopPropagation()}>
                      <select
                        aria-label="Assign area"
                        disabled={busyId === r.asset_id}
                        defaultValue=""
                        onChange={(e) => {
                          const [kind, key] = e.target.value.split('::');
                          if (!kind) return;
                          const tr = areaTaxonomy.find(t => t.kind === kind && t.area_key === key);
                          if (tr) inlineAssign(r, tr);
                          e.currentTarget.value = '';
                        }}
                        style={{
                          width:'100%', fontSize:10, padding:'4px 6px',
                          border:'1px solid '+HAIR, background: WHITE, color: INK,
                          borderRadius:3, cursor: busyId === r.asset_id ? 'wait' : 'pointer',
                        }}
                      >
                        <option value="">— assign area…</option>
                        {taxonomyGroups.map(g => (
                          <optgroup key={g.kind} label={g.label}>
                            {g.rows.map(tr => (
                              <option key={g.kind + '::' + tr.area_key} value={g.kind + '::' + tr.area_key}>
                                {tr.name}{tr.photo_count != null ? ' · ' + tr.photo_count : ''}
                              </option>
                            ))}
                          </optgroup>
                        ))}
                      </select>
                    </div>
                  ) : (
                    <div style={{ color:INK_M, marginTop:2 }}>Click to edit ✎</div>
                  )}
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