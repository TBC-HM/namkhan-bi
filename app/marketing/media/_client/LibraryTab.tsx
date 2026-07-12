// app/marketing/media/_client/LibraryTab.tsx
// PBS 2026-07-12 — Library tab. KPIs, tier filter, grid, upload.
// 2026-07-12 (later) — Edit ✎ button opens AssetEditDrawer for 6 mutable columns.
'use client';

import { useMemo, useState, Fragment } from 'react';
import UploadDropzone from './UploadDropzone';
import AssetEditDrawer, { type AssetEditRow, type DrawerTaxonomy } from './AssetEditDrawer';

interface TierRow { primary_tier: string | null; total: number | string; photos: number | string; videos: number | string; }
interface MediaRow {
  asset_id: string; asset_type?: string; original_filename: string;
  caption: string | null; primary_tier: string | null; property_area: string | null;
  captured_at?: string | null; qc_score: number | null; public_url: string | null;
  width_px: number | null; height_px: number | null;
  master_path?: string | null; mime_type?: string | null; status?: string | null;
  file_size_bytes?: number | string | null; file_size_human?: string | null;
  alt_text?: string | null; is_ai_generated?: boolean | null;
  created_at?: string | null;
}
interface ChannelSpec { channel: string; display_name: string; }

interface Props {
  propertyId: number;
  byTier: TierRow[];
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
  { key: 'tier_logos',        label: 'Logos'    },
  { key: 'tier_archive',      label: 'Archive'  },
];

function n(v: any): number { return Number(v ?? 0); }

export default function LibraryTab({ propertyId, byTier, mediaPage, channelSpecs, onSendToAi, areaOptions = [], rooms = [], taxonomy }: Props) {
  const [tier, setTier] = useState<string>('');
  const [page, setPage] = useState(0);
  const [showUpload, setShowUpload] = useState(false);
  const [useForMenu, setUseForMenu] = useState<string | null>(null);
  const [busyRow, setBusyRow] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [lastDownload, setLastDownload] = useState<{ url: string; label: string } | null>(null);
  const [localDismiss, setLocalDismiss] = useState<Set<string>>(new Set());
  const [editing, setEditing] = useState<MediaRow | null>(null);

  const totals = useMemo(() => {
    const tot = byTier.reduce((s, r) => s + n(r.total), 0);
    const ota = n(byTier.find(r => r.primary_tier === 'tier_ota_profile')?.total);
    const hero = n(byTier.find(r => r.primary_tier === 'tier_website_hero')?.total);
    const social = n(byTier.find(r => r.primary_tier === 'tier_social_pool')?.total);
    const internal = n(byTier.find(r => r.primary_tier === 'tier_internal')?.total);
    return { tot, ota, hero, social, internal };
  }, [byTier]);

  // PBS 2026-07-12 pm: filter state — search text · area · AI-only.
  const [searchText, setSearchText] = useState('');
  const [areaFilter, setAreaFilter] = useState('');
  const [aiOnly, setAiOnly] = useState(false);

  const filtered = useMemo(() => {
    let out = mediaPage;
    if (tier)         out = out.filter(r => r.primary_tier === tier);
    if (areaFilter)   out = out.filter(r => (r.property_area ?? '') === areaFilter);
    if (aiOnly)       out = out.filter((r: any) => r.is_ai_generated === true);
    if (searchText) {
      const q = searchText.toLowerCase();
      out = out.filter(r =>
        (r.original_filename ?? '').toLowerCase().includes(q) ||
        (r.property_area     ?? '').toLowerCase().includes(q)
      );
    }
    return out;
  }, [mediaPage, tier, areaFilter, aiOnly, searchText]);

  const visible = filtered.filter(r => !localDismiss.has(r.asset_id));
  const pageRows = visible.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const totalPages = Math.max(1, Math.ceil(visible.length / PAGE_SIZE));

  async function deleteAsset(assetId: string, filename: string | null) {
    // PBS 2026-07-12: soft-delete (status=removed). Optimistic client hide + server RPC.
    if (!window.confirm(`Delete "${filename ?? assetId.slice(0,8)}" from the library? (soft-delete, can be restored via SQL)`)) return;
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
      const dl = j.download_url as string | undefined;
      const label = `${j.channel_display ?? channel} · ${j.width}×${j.height}`;
      if (dl) {
        const proxyUrl = `/api/marketing/media/download-render?asset_id=${assetId}&channel=${encodeURIComponent(channel)}`;
        setLastDownload({ url: proxyUrl, label });
        setMsg(`Rendered for ${label} — download started ✓`);
        const proxy = `/api/marketing/media/download-render?asset_id=${assetId}&channel=${encodeURIComponent(channel)}`;
        const link = document.createElement('a'); link.href = proxy; link.download = j.filename_hint ?? '';
        document.body.appendChild(link); link.click(); link.remove();
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
          { label: 'Total ready', value: totals.tot },
          { label: 'OTA',         value: totals.ota },
          { label: 'Website',     value: totals.hero },
          { label: 'Social',      value: totals.social },
          { label: 'Internal',    value: totals.internal },
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
                <optgroup label="Rooms">{taxonomy.rooms.map(r => <option key={`f-room-${r.id}`} value={r.name}>{r.name}</option>)}</optgroup>
              )}
              {taxonomy.facilities.length > 0 && (
                <optgroup label="Facilities">{taxonomy.facilities.map(f => <option key={`f-fac-${f.id}`} value={f.name}>{f.parent_name ? `${f.name} · ↳ ${f.parent_name}` : f.name}</option>)}</optgroup>
              )}
              {taxonomy.activities.length > 0 && (
                <optgroup label="Activities">{taxonomy.activities.map(a => <option key={`f-act-${a.id}`} value={a.name}>{a.name}</option>)}</optgroup>
              )}
              {taxonomy.meeting_spaces.length > 0 && (
                <optgroup label="Meeting spaces">{taxonomy.meeting_spaces.map(m => <option key={`f-mtg-${m.id}`} value={m.name}>{m.name}</option>)}</optgroup>
              )}
              {taxonomy.transport.length > 0 && (
                <optgroup label="Transport">{taxonomy.transport.map(t => <option key={`f-trp-${t.id}`} value={t.name}>{t.name}</option>)}</optgroup>
              )}
              {(taxonomy.boats && taxonomy.boats.length > 0) && (
                <optgroup label="Imekong · Boats">{taxonomy.boats.map(b => <option key={`f-boat-${b.id}`} value={b.name}>{b.name}</option>)}</optgroup>
              )}
              {(taxonomy.boat_cruises && taxonomy.boat_cruises.length > 0) && (
                <optgroup label="Imekong · Cruises">{taxonomy.boat_cruises.map(c => <option key={`f-cruise-${c.id}`} value={c.name}>{c.name}</option>)}</optgroup>
              )}
            </>
          ) : (
            (areaOptions ?? []).map(a => <option key={a} value={a}>{a}</option>)
          )}
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
          }}>{showUpload ? 'Hide upload' : '+ Upload'}</button>
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
          No assets match this filter.
        </div>
      ) : (
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(200px, 1fr))', gap:12 }}>
          {pageRows.map(r => (
            <div key={r.asset_id} style={{ background:WHITE, border:'1px solid '+HAIR, borderRadius:4, overflow:'hidden', display:'flex', flexDirection:'column' }}>
              {r.public_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={r.public_url} alt={r.original_filename} loading="lazy"
                  style={{ width:'100%', height:140, objectFit:'cover', background:'#F5F0E1' }} />
              ) : (
                <div style={{ width:'100%', height:140, background:'#F5F0E1', color:INK_M, display:'flex', alignItems:'center', justifyContent:'center', fontSize:11 }}>no preview</div>
              )}
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
                      }}>✨ AI Studio (refine / restyle)</button>
                    )}
                    {channelSpecs.map(c => (
                      <Fragment key={c.channel}>
                        <button onClick={() => renderForChannel(r.asset_id, c.channel)} style={{
                          display:'block', width:'100%', textAlign:'left', padding:'4px 6px', fontSize:10, background:'none', border:'none', cursor:'pointer', color:INK,
                        }}>{c.display_name}</button>
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
    </div>
  );
}
