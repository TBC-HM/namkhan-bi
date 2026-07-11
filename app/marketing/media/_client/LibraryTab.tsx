// app/marketing/media/_client/LibraryTab.tsx
// PBS 2026-07-12 — Library tab. KPIs, tier filter, grid, upload.
'use client';

import { useMemo, useState, Fragment } from 'react';
import UploadDropzone from './UploadDropzone';

interface TierRow { primary_tier: string | null; total: number | string; photos: number | string; videos: number | string; }
interface MediaRow {
  asset_id: string; asset_type: string; original_filename: string;
  caption: string | null; primary_tier: string | null; property_area: string | null;
  captured_at: string | null; qc_score: number | null; public_url: string | null;
  width_px: number | null; height_px: number | null;
}
interface ChannelSpec { channel: string; display_name: string; }

interface Props {
  propertyId: number;
  byTier: TierRow[];
  mediaPage: MediaRow[];
  channelSpecs: ChannelSpec[];
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

export default function LibraryTab({ propertyId, byTier, mediaPage, channelSpecs, onSendToAi }: Props) {
  const [tier, setTier] = useState<string>('');
  const [page, setPage] = useState(0);
  const [showUpload, setShowUpload] = useState(false);
  const [useForMenu, setUseForMenu] = useState<string | null>(null);
  const [busyRow, setBusyRow] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const totals = useMemo(() => {
    const tot = byTier.reduce((s, r) => s + n(r.total), 0);
    const ota = n(byTier.find(r => r.primary_tier === 'tier_ota_profile')?.total);
    const hero = n(byTier.find(r => r.primary_tier === 'tier_website_hero')?.total);
    const social = n(byTier.find(r => r.primary_tier === 'tier_social_pool')?.total);
    const internal = n(byTier.find(r => r.primary_tier === 'tier_internal')?.total);
    return { tot, ota, hero, social, internal };
  }, [byTier]);

  const filtered = useMemo(() => {
    if (!tier) return mediaPage;
    return mediaPage.filter(r => r.primary_tier === tier);
  }, [mediaPage, tier]);

  const pageRows = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));

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
      setMsg(`Rendered for ${channel} — queued as ${j.render_id ?? 'render'}`);
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
                <div style={{ marginTop:'auto', display:'grid', gap:6 }}>
                  {onSendToAi ? (
                    <button onClick={() => onSendToAi(r.asset_id)} style={{
                      padding:'6px 10px', fontSize:12, fontWeight:700, background:FOREST, color:WHITE,
                      border:'none', borderRadius:3, cursor:'pointer', width:'100%', whiteSpace:'nowrap',
                      letterSpacing:'0.04em', textTransform:'uppercase',
                    }}>🎨 Use for AI</button>
                  ) : null}
                  <button onClick={() => setUseForMenu(useForMenu === r.asset_id ? null : r.asset_id)} disabled={busyRow === r.asset_id} style={{
                    fontSize:10, padding:'4px 8px', background:WHITE, border:'1px solid '+HAIR, borderRadius:3, cursor:'pointer', color:INK, width:'100%',
                  }}>Use for channel…</button>
                  {busyRow === r.asset_id && <span style={{ fontSize:10, color:INK_M }}>…</span>}
                </div>
                {useForMenu === r.asset_id && (
                  <div style={{ marginTop:4, background:WHITE, border:'1px solid '+HAIR, borderRadius:3, padding:4, maxHeight:160, overflow:'auto' }}>
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
    </div>
  );
}
