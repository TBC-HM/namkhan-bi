// app/marketing/media/_client/VideoLibraryTab.tsx
// PBS 2026-07-12 · Task #148 — Video Library. Mirrors LibraryTab, filtered to
// videos (asset_type='video' OR mime_type starts with video/ OR path ends with
// mp4/mov/webm/m4v). Duration filter (short/mid/long), tier chips, area
// optgroup, AI-generated toggle, search. Edit ✎ → AssetEditDrawer. Delete
// via same /asset-delete route. Use-for-channel path unchanged.
// 2026-07-13 · Coordinator — centered ▶ overlay opens VideoPlayerModal;
// clicks elsewhere on the tile keep opening the edit drawer.
'use client';

import { useMemo, useState, Fragment } from 'react';
import UploadDropzone from './UploadDropzone';
import AssetEditDrawer, { type AssetEditRow, type DrawerTaxonomy } from './AssetEditDrawer';
import VideoPlayerModal, { type VideoPlayerAsset } from './VideoPlayerModal';

interface MediaRow {
  asset_id: string; asset_type?: string; original_filename: string;
  caption: string | null; primary_tier: string | null; property_area: string | null;
  captured_at?: string | null; qc_score: number | null; public_url: string | null;
  width_px: number | null; height_px: number | null;
  master_path?: string | null; mime_type?: string | null; status?: string | null;
  file_size_bytes?: number | string | null; file_size_human?: string | null;
  alt_text?: string | null; is_ai_generated?: boolean | null;
  duration_sec?: number | null;
  aspect_ratio?: string | null;
  camera_make?: string | null;
  created_at?: string | null;
}
interface ChannelSpec { channel: string; display_name: string; video_aspect_ratio: string | null; }

interface Props {
  propertyId: number;
  mediaPage: MediaRow[];
  channelSpecs: ChannelSpec[];
  onSendToAi?: (assetId: string) => void;
  areaOptions?: string[];
  rooms?: Array<{ room_type_id: number; room_type_name: string }>;
  taxonomy?: DrawerTaxonomy;
}

const WHITE  = '#FFFFFF';
const HAIR   = '#E6DFCC';
const INK    = '#1B1B1B';
const INK_M  = '#5A5A5A';
const FOREST = '#084838';
const PAGE_SIZE = 24;

const TIER_CHIPS: Array<{ key: string; label: string }> = [
  { key: '',                  label: 'All'      },
  { key: 'tier_ota_profile',  label: 'OTA'      },
  { key: 'tier_website_hero', label: 'Website'  },
  { key: 'tier_social_pool',  label: 'Social'   },
  { key: 'tier_internal',     label: 'Internal' },
  { key: 'tier_archive',      label: 'Archive'  },
];

const DURATION_BUCKETS: Array<{ key: string; label: string; min: number; max: number }> = [
  { key: '',      label: 'Any',                min: 0,   max: 999999 },
  { key: 'short', label: 'Short  (≤ 15s)',     min: 0,   max: 15 },
  { key: 'mid',   label: 'Mid  (15–60s)',      min: 15,  max: 60 },
  { key: 'long',  label: 'Long  (60s+)',       min: 60,  max: 999999 },
];

function isVideoRow(r: MediaRow): boolean {
  if ((r.asset_type ?? '').toLowerCase() === 'video') return true;
  const mt = (r.mime_type ?? '').toLowerCase();
  if (mt.startsWith('video/')) return true;
  const p = (r.public_url ?? r.master_path ?? '').toLowerCase();
  return /\.(mp4|mov|webm|m4v)(\?|$)/.test(p);
}

function fmtDur(sec: number | null | undefined): string {
  if (sec == null || Number.isNaN(Number(sec))) return '';
  const s = Math.round(Number(sec));
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  const r = s % 60;
  return r === 0 ? `${m}m` : `${m}m ${r}s`;
}

export default function VideoLibraryTab({ propertyId, mediaPage, channelSpecs, onSendToAi, areaOptions = [], rooms = [], taxonomy }: Props) {
  const [tier, setTier] = useState<string>('');
  const [page, setPage] = useState(0);
  const [showUpload, setShowUpload] = useState(false);
  const [useForMenu, setUseForMenu] = useState<string | null>(null);
  const [busyRow, setBusyRow] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [localDismiss, setLocalDismiss] = useState<Set<string>>(new Set());
  const [editing, setEditing] = useState<MediaRow | null>(null);
  const [playing, setPlaying] = useState<MediaRow | null>(null);

  const [searchText, setSearchText] = useState('');
  const [areaFilter, setAreaFilter] = useState('');
  const [aiOnly, setAiOnly] = useState(false);
  const [duration, setDuration] = useState<string>('');

  // Video-only base slice
  const videosAll = useMemo(() => mediaPage.filter(isVideoRow), [mediaPage]);

  const filtered = useMemo(() => {
    let out = videosAll;
    if (tier)       out = out.filter(r => r.primary_tier === tier);
    if (areaFilter) {
      const q = areaFilter.trim().toLowerCase();
      out = out.filter(r => (r.property_area ?? '').trim().toLowerCase() === q);
    }
    if (aiOnly)     out = out.filter(r => r.is_ai_generated === true);
    if (duration) {
      const b = DURATION_BUCKETS.find(x => x.key === duration);
      if (b) out = out.filter(r => {
        const d = Number(r.duration_sec ?? 0);
        if (!d) return b.key === 'short'; // treat unknown as short (many auto-uploads have no duration)
        return d >= b.min && d < b.max;
      });
    }
    if (searchText) {
      const q = searchText.toLowerCase();
      out = out.filter(r =>
        (r.original_filename ?? '').toLowerCase().includes(q) ||
        (r.property_area     ?? '').toLowerCase().includes(q)
      );
    }
    return out;
  }, [videosAll, tier, areaFilter, aiOnly, duration, searchText]);

  const visible = filtered.filter(r => !localDismiss.has(r.asset_id));
  const pageRows = visible.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const totalPages = Math.max(1, Math.ceil(visible.length / PAGE_SIZE));

  const totals = useMemo(() => {
    const tot = videosAll.length;
    const ota = videosAll.filter(r => r.primary_tier === 'tier_ota_profile').length;
    const web = videosAll.filter(r => r.primary_tier === 'tier_website_hero').length;
    const soc = videosAll.filter(r => r.primary_tier === 'tier_social_pool').length;
    const ai  = videosAll.filter(r => r.is_ai_generated === true).length;
    return { tot, ota, web, soc, ai };
  }, [videosAll]);

  async function deleteAsset(assetId: string, filename: string | null) {
    if (!window.confirm(`Delete video "${filename ?? assetId.slice(0,8)}" from the library? (soft-delete)`)) return;
    setBusyRow(assetId); setMsg(null);
    try {
      const res = await fetch('/api/marketing/media/asset-delete', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ asset_id: assetId }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || 'delete_failed');
      setLocalDismiss(s => { const next = new Set(s); next.add(assetId); return next; });
      setMsg(`Deleted ${filename ?? assetId.slice(0,8)} — refresh to sync`);
    } catch (e: any) { setMsg(`Delete failed: ${e.message}`); }
    finally { setBusyRow(null); }
  }

  async function renderForChannel(assetId: string, channel: string) {
    setBusyRow(assetId);
    setUseForMenu(null);
    setMsg(null);
    try {
      const res = await fetch('/api/marketing/media/render-for-channel', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ asset_id: assetId, channel, property_id: propertyId }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || 'failed');
      const label = `${j.channel_display ?? channel}`;
      if (j.download_url) {
        const proxy = `/api/marketing/media/download-render?asset_id=${assetId}&channel=${encodeURIComponent(channel)}`;
        const link = document.createElement('a'); link.href = proxy; link.download = j.filename_hint ?? '';
        document.body.appendChild(link); link.click(); link.remove();
        setMsg(`Rendered for ${label} — download started ✓`);
      } else {
        setMsg(`Rendered for ${channel} — queued as ${j.render_id ?? 'render'}`);
      }
    } catch (e: any) {
      setMsg(`Failed: ${e.message}`);
    } finally {
      setBusyRow(null);
    }
  }

  return (
    <div>
      {/* KPI strip */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(160px, 1fr))', gap:8, marginBottom:16 }}>
        {[
          { label: 'Total videos', value: totals.tot },
          { label: 'OTA',          value: totals.ota },
          { label: 'Website',      value: totals.web },
          { label: 'Social',       value: totals.soc },
          { label: 'AI generated', value: totals.ai },
        ].map((t, i) => (
          <div key={i} style={{ background:WHITE, border:'1px solid '+HAIR, borderRadius:6, padding:'12px 14px' }}>
            <div style={{ fontSize:10, letterSpacing:'0.06em', textTransform:'uppercase', color:INK_M, marginBottom:4 }}>{t.label}</div>
            <div style={{ fontSize:22, fontWeight:700, color:INK }}>{t.value.toLocaleString()}</div>
          </div>
        ))}
      </div>

      {/* Filter row + upload */}
      <div style={{ display:'flex', gap:8, flexWrap:'wrap', alignItems:'center', marginBottom:12 }}>
        <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
          <input value={searchText} onChange={e => { setSearchText(e.target.value); setPage(0); }} placeholder="Search filename / area…" style={{ flex:'1 1 200px', minWidth:180, padding:'6px 10px', fontSize:11, border:'1px solid '+HAIR, borderRadius:3, color:INK, background:WHITE }} />
          <select value={areaFilter} onChange={e => { setAreaFilter(e.target.value); setPage(0); }} style={{ padding:'6px 10px', fontSize:11, border:'1px solid '+HAIR, borderRadius:3, color:INK, background:WHITE, minWidth:180 }}>
            <option value="">All areas</option>
            <option value="Logos">Logos</option>
            <option value="No area">No area</option>
            {taxonomy ? (
              <>
                {taxonomy.rooms.length > 0 && (
                  <optgroup label="Rooms">{taxonomy.rooms.map(r => <option key={`fv-room-${r.id}`} value={r.name}>{r.name}</option>)}</optgroup>
                )}
                {taxonomy.facilities.length > 0 && (
                  <optgroup label="Facilities">{taxonomy.facilities.map(f => <option key={`fv-fac-${f.id}`} value={f.name}>{f.parent_name ? `${f.name} · ↳ ${f.parent_name}` : f.name}</option>)}</optgroup>
                )}
                {taxonomy.activities.length > 0 && (
                  <optgroup label="Activities">{taxonomy.activities.map(a => <option key={`fv-act-${a.id}`} value={a.name}>{a.name}</option>)}</optgroup>
                )}
                {taxonomy.meeting_spaces.length > 0 && (
                  <optgroup label="Meeting spaces">{taxonomy.meeting_spaces.map(m => <option key={`fv-mtg-${m.id}`} value={m.name}>{m.name}</option>)}</optgroup>
                )}
                {taxonomy.transport.length > 0 && (
                  <optgroup label="Transport">{taxonomy.transport.map(t => <option key={`fv-trp-${t.id}`} value={t.name}>{t.name}</option>)}</optgroup>
                )}
                {(taxonomy.boats && taxonomy.boats.length > 0) && (
                  <optgroup label="Imekong · Boats">{taxonomy.boats.map(b => <option key={`fv-boat-${b.id}`} value={b.name}>{b.name}</option>)}</optgroup>
                )}
                {(taxonomy.boat_cruises && taxonomy.boat_cruises.length > 0) && (
                  <optgroup label="Imekong · Cruises">{taxonomy.boat_cruises.map(c => <option key={`fv-cruise-${c.id}`} value={c.name}>{c.name}</option>)}</optgroup>
                )}
              </>
            ) : (
              (areaOptions ?? []).map(a => <option key={a} value={a}>{a}</option>)
            )}
          </select>
          <select value={duration} onChange={e => { setDuration(e.target.value); setPage(0); }} style={{ padding:'6px 10px', fontSize:11, border:'1px solid '+HAIR, borderRadius:3, color:INK, background:WHITE, minWidth:140 }}>
            {DURATION_BUCKETS.map(b => <option key={b.key || 'any'} value={b.key}>{b.label}</option>)}
          </select>
          <button onClick={() => { setAiOnly(v => !v); setPage(0); }} style={{ padding:'4px 10px', fontSize:11, borderRadius:12, cursor:'pointer', border:'1px solid '+(aiOnly ? FOREST : HAIR), background: aiOnly ? FOREST : WHITE, color: aiOnly ? WHITE : INK, fontWeight: aiOnly ? 600 : 400, whiteSpace:'nowrap' }}>✨ AI only</button>
          {TIER_CHIPS.map(c => {
            const active = tier === c.key;
            return (
              <button key={c.key || 'all'} onClick={() => { setTier(c.key); setPage(0); }} style={{
                padding:'6px 12px', fontSize:11, fontWeight:600, borderRadius:4,
                border:'1px solid ' + (active ? FOREST : HAIR),
                background: active ? FOREST : WHITE,
                color: active ? WHITE : INK, cursor:'pointer',
              }}>{c.label}</button>
            );
          })}
        </div>
        <div style={{ marginLeft:'auto', display:'flex', gap:8, alignItems:'center' }}>
          <span style={{ fontSize:11, color:INK_M }}>{filtered.length.toLocaleString()} shown</span>
          <button onClick={() => setShowUpload(v => !v)} style={{
            padding:'6px 14px', fontSize:12, fontWeight:600, background:FOREST, color:WHITE,
            border:'none', borderRadius:4, cursor:'pointer',
          }}>{showUpload ? 'Hide upload' : '+ Upload video'}</button>
        </div>
      </div>

      {showUpload && (
        <div style={{ marginBottom:16 }}>
          <UploadDropzone onResult={r => setMsg(r)} />
        </div>
      )}

      {msg && (
        <div style={{ padding:'8px 12px', background:'#F7F0E1', border:'1px solid '+HAIR, borderRadius:4, marginBottom:12, fontSize:12, color:INK }}>
          {msg} <button onClick={() => setMsg(null)} style={{ marginLeft:8, background:'none', border:'none', cursor:'pointer', color:INK_M }}>×</button>
        </div>
      )}

      {/* Grid */}
      {pageRows.length === 0 ? (
        <div style={{ padding:40, textAlign:'center', color:INK_M, background:WHITE, border:'1px solid '+HAIR, borderRadius:4 }}>
          {videosAll.length === 0
            ? 'No video assets yet — upload a video above or generate one from the AI Studio tab.'
            : 'No videos match this filter.'}
        </div>
      ) : (
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(220px, 1fr))', gap:12 }}>
          {pageRows.map(r => (
            <div key={r.asset_id} style={{ background:WHITE, border:'1px solid '+HAIR, borderRadius:4, overflow:'hidden', display:'flex', flexDirection:'column' }}>
              <div style={{ position:'relative', width:'100%', height:150, background:'#F5F0E1' }}>
                {r.public_url ? (
                  <video src={r.public_url} preload="metadata" muted style={{ width:'100%', height:'100%', objectFit:'cover' }} />
                ) : (
                  <div style={{ width:'100%', height:'100%', display:'flex', alignItems:'center', justifyContent:'center', fontSize:11, color:INK_M }}>no preview</div>
                )}
                {/* Centered ▶ overlay — opens embedded player instead of edit drawer */}
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); setPlaying(r); }}
                  aria-label="Play video"
                  style={{
                    position:'absolute', top:'50%', left:'50%', transform:'translate(-50%, -50%)',
                    width:44, height:44, borderRadius:22, background:'rgba(255,255,255,0.9)',
                    border:'none', color:'#084838', fontSize:20, cursor:'pointer',
                    display:'flex', alignItems:'center', justifyContent:'center', fontWeight:700,
                    boxShadow:'0 2px 8px rgba(0,0,0,0.3)',
                  }}
                >▶</button>
                <div style={{ position:'absolute', bottom:6, left:6, background:'rgba(0,0,0,0.55)', color:WHITE, fontSize:9, fontWeight:600, padding:'2px 5px', borderRadius:2, letterSpacing:'0.04em' }}>▶ VIDEO</div>
                {r.duration_sec != null && (
                  <div style={{ position:'absolute', bottom:6, right:6, background:'rgba(0,0,0,0.55)', color:WHITE, fontSize:10, fontWeight:600, padding:'2px 5px', borderRadius:2 }}>{fmtDur(r.duration_sec)}</div>
                )}
                {r.is_ai_generated && (
                  <div style={{ position:'absolute', top:6, left:6, background:FOREST, color:WHITE, fontSize:9, fontWeight:700, padding:'2px 6px', borderRadius:2, letterSpacing:'0.04em' }}>✨ AI</div>
                )}
              </div>
              <div style={{ padding:'6px 8px', fontSize:10, color:INK, borderTop:'1px solid '+HAIR, flex:1, display:'flex', flexDirection:'column', gap:4 }}>
                <div style={{ fontWeight:600, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{r.original_filename}</div>
                <div style={{ color:INK_M, display:'flex', gap:6, flexWrap:'wrap' }}>
                  {r.primary_tier && <span>{r.primary_tier}</span>}
                  {r.property_area && <span>· {r.property_area}</span>}
                </div>
                <div style={{ marginTop:'auto', display:'flex', gap:4, alignItems:'center', flexWrap:'wrap' }}>
                  <button onClick={() => setEditing(r)} style={{
                    padding:'4px 10px', fontSize:11, fontWeight:600, background:'transparent', color:INK,
                    border:'1px solid '+INK, borderRadius:2, cursor:'pointer', whiteSpace:'nowrap',
                  }}>Edit ✎</button>
                  <button onClick={() => deleteAsset(r.asset_id, r.original_filename ?? null)} disabled={busyRow === r.asset_id} title="Delete from library (soft-delete)" style={{
                    padding:'4px 8px', fontSize:11, fontWeight:600, background:'transparent', color:'#B23A2E',
                    border:'1px solid #B23A2E', borderRadius:2, cursor:'pointer', whiteSpace:'nowrap',
                  }}>✕ Delete</button>
                  <button onClick={() => setUseForMenu(useForMenu === r.asset_id ? null : r.asset_id)} disabled={busyRow === r.asset_id} style={{
                    fontSize:10, padding:'4px 8px', background:WHITE, border:'1px solid '+HAIR, borderRadius:3, cursor:'pointer', color:INK,
                  }}>Use for…</button>
                  {busyRow === r.asset_id && <span style={{ fontSize:10, color:INK_M }}>…</span>}
                </div>
                {useForMenu === r.asset_id && (
                  <div style={{ marginTop:4, background:WHITE, border:'1px solid '+HAIR, borderRadius:3, padding:4, maxHeight:160, overflow:'auto' }}>
                    {onSendToAi && (
                      <button onClick={() => { onSendToAi(r.asset_id); setUseForMenu(null); }} style={{
                        display:'block', width:'100%', textAlign:'left', padding:'6px 8px', fontSize:11, fontWeight:600, background:'#F5F1E6', border:'none', borderBottom:'1px solid '+HAIR, cursor:'pointer', color:FOREST,
                      }}>✨ Video AI Studio (use as source)</button>
                    )}
                    {channelSpecs.filter(c => c.video_aspect_ratio).map(c => (
                      <Fragment key={c.channel}>
                        <button onClick={() => renderForChannel(r.asset_id, c.channel)} style={{
                          display:'block', width:'100%', textAlign:'left', padding:'4px 6px', fontSize:10, background:'none', border:'none', cursor:'pointer', color:INK,
                        }}>{c.display_name} · {c.video_aspect_ratio}</button>
                      </Fragment>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div style={{ display:'flex', justifyContent:'center', gap:8, marginTop:16, alignItems:'center' }}>
          <button disabled={page === 0} onClick={() => setPage(p => Math.max(0, p - 1))} style={{
            padding:'4px 10px', fontSize:11, border:'1px solid '+HAIR, background:WHITE, borderRadius:3, cursor: page === 0 ? 'default' : 'pointer', color:INK,
          }}>← Prev</button>
          <span style={{ fontSize:11, color:INK_M }}>Page {page + 1} of {totalPages}</span>
          <button disabled={page + 1 >= totalPages} onClick={() => setPage(p => p + 1)} style={{
            padding:'4px 10px', fontSize:11, border:'1px solid '+HAIR, background:WHITE, borderRadius:3, cursor: page + 1 >= totalPages ? 'default' : 'pointer', color:INK,
          }}>Next →</button>
        </div>
      )}

      <AssetEditDrawer
        open={editing != null}
        onClose={() => setEditing(null)}
        asset={editing as AssetEditRow | null}
        areaOptions={areaOptions}
        rooms={rooms}
        taxonomy={taxonomy}
      />

      <VideoPlayerModal
        open={playing != null}
        onClose={() => setPlaying(null)}
        asset={playing as VideoPlayerAsset | null}
      />
    </div>
  );
}
