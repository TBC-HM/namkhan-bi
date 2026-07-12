// app/marketing/media/_client/VideoAiStudioTab.tsx
// PBS 2026-07-12 · Task #148 — Video AI Studio (Shotstack).
// Composer: Template · Category · What (5-taxonomy) · Assets multi-select · Voiceover.
// Submit → POST /api/marketing/media/video-render with {template_key, asset_ids,
// voiceover_text, target_channel}. Route builds Shotstack EDL from template
// scaffold + asset URLs, dispatches to Shotstack /render, stores row.
// Render queue below polls GET ?id= every 15s until done/failed.
'use client';

import { useEffect, useMemo, useState } from 'react';
import type { PromptCategory, RoomOption, FacilityOption, MediaTaxonomy } from './MediaHub';

interface MediaRow {
  asset_id: string; asset_type?: string;
  original_filename: string; public_url: string | null;
  primary_tier: string | null; property_area: string | null;
  mime_type?: string | null; master_path?: string | null;
  duration_sec?: number | null;
}

interface ChannelSpec { channel: string; display_name: string; video_aspect_ratio: string | null; video_max_duration_sec: number | null; }

interface VideoTemplate {
  template_key: string;
  display_name: string;
  description: string | null;
  duration_sec: number;
  min_assets: number;
  max_assets: number;
  aspect: string;
}

interface VideoEditRow {
  id: string; property_id: number; title: string | null; channel: string;
  aspect: string | null; timeline: any; source_asset_ids: string[] | null;
  status: string; shotstack_render_id: string | null; output_asset_id: string | null;
  cost_eur: number | null; cost_cap_eur: number | null; created_by: string | null;
  created_at: string; rendered_at: string | null;
}

interface Props {
  propertyId: number;
  mediaPage: MediaRow[];
  channelSpecs: ChannelSpec[];
  videoEdits: VideoEditRow[];
  templates: VideoTemplate[];
  categories: PromptCategory[];
  rooms: RoomOption[];
  facilities: FacilityOption[];
  taxonomy: MediaTaxonomy;
  initialSourceAssetId?: string | null;
}

const WHITE  = '#FFFFFF';
const HAIR   = '#E6DFCC';
const INK    = '#1B1B1B';
const INK_M  = '#5A5A5A';
const FOREST = '#084838';
const RED    = '#B23A2E';
const OK     = '#0E7A4B';

function isImageRow(r: MediaRow): boolean {
  if ((r.asset_type ?? '').toLowerCase() === 'photo') return true;
  const mt = (r.mime_type ?? '').toLowerCase();
  if (mt.startsWith('image/')) return true;
  const p = (r.public_url ?? r.master_path ?? '').toLowerCase();
  return /\.(jpg|jpeg|png|webp|heic|heif)(\?|$)/.test(p);
}
function isVideoRow(r: MediaRow): boolean {
  if ((r.asset_type ?? '').toLowerCase() === 'video') return true;
  const mt = (r.mime_type ?? '').toLowerCase();
  if (mt.startsWith('video/')) return true;
  const p = (r.public_url ?? r.master_path ?? '').toLowerCase();
  return /\.(mp4|mov|webm|m4v)(\?|$)/.test(p);
}

export default function VideoAiStudioTab({
  propertyId, mediaPage, channelSpecs, videoEdits, templates,
  categories, rooms, facilities, taxonomy, initialSourceAssetId,
}: Props) {
  // Composer state
  const [templateKey, setTemplateKey] = useState<string>(templates[0]?.template_key ?? '');
  const [categoryKey, setCategoryKey] = useState<string>('');
  const [whatArea, setWhatArea]       = useState<string>('');
  const [whereFacilityId, setWhereFacilityId] = useState<string>('');
  const [title, setTitle] = useState<string>('');
  const [voiceover, setVoiceover] = useState<string>('');
  const [targetChannel, setTargetChannel] = useState<string>(
    (channelSpecs.find(c => c.video_aspect_ratio)?.channel) ?? 'youtube'
  );
  const [assetIds, setAssetIds] = useState<string[]>(initialSourceAssetId ? [initialSourceAssetId] : []);
  const [assetQuery, setAssetQuery] = useState<string>('');

  const [busy, setBusy] = useState(false);
  const [banner, setBanner] = useState<{ tone: 'ok'|'err'|'warn'; text: string } | null>(null);
  const [rows, setRows] = useState<VideoEditRow[]>(videoEdits);

  useEffect(() => {
    if (initialSourceAssetId && !assetIds.includes(initialSourceAssetId)) {
      setAssetIds(prev => [initialSourceAssetId, ...prev]);
    }
  }, [initialSourceAssetId]); // eslint-disable-line react-hooks/exhaustive-deps

  const template = useMemo(
    () => templates.find(t => t.template_key === templateKey) ?? null,
    [templates, templateKey]
  );

  // Poll queued/rendering rows every 15s.
  useEffect(() => {
    const openRows = rows.filter(r => ['queued', 'rendering', 'fetching', 'saving'].includes((r.status ?? '').toLowerCase()));
    if (openRows.length === 0) return;
    const t = setInterval(async () => {
      for (const r of openRows) {
        try {
          const res = await fetch(`/api/marketing/media/video-render?id=${r.id}`, { cache: 'no-store' });
          if (!res.ok) continue;
          const j = await res.json();
          if (j?.row?.id) {
            setRows(prev => prev.map(x => x.id === j.row.id ? j.row : x));
          }
        } catch { /* silent */ }
      }
    }, 15000);
    return () => clearInterval(t);
  }, [rows]);

  const assetsForPicker = useMemo(() => {
    let out = mediaPage.filter(r => isImageRow(r) || isVideoRow(r));
    if (assetQuery) {
      const q = assetQuery.toLowerCase();
      out = out.filter(r =>
        (r.original_filename ?? '').toLowerCase().includes(q) ||
        (r.property_area ?? '').toLowerCase().includes(q)
      );
    }
    return out.slice(0, 200);
  }, [mediaPage, assetQuery]);

  const assetsSelected = useMemo(
    () => mediaPage.filter(r => assetIds.includes(r.asset_id)),
    [mediaPage, assetIds]
  );

  function toggleAsset(id: string) {
    setAssetIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  }

  const minAssets = template?.min_assets ?? 3;
  const maxAssets = template?.max_assets ?? 10;

  async function submit() {
    setBanner(null);
    if (!template) { setBanner({ tone:'err', text:'Pick a template first.' }); return; }
    if (assetIds.length < minAssets) {
      setBanner({ tone:'err', text:`Pick at least ${minAssets} asset${minAssets===1?'':'s'} — this template needs ${minAssets}–${maxAssets}.` });
      return;
    }
    if (assetIds.length > maxAssets) {
      setBanner({ tone:'err', text:`Trim to ${maxAssets} assets — this template maxes out at ${maxAssets}.` });
      return;
    }
    setBusy(true);
    try {
      const res = await fetch('/api/marketing/media/video-render', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          property_id: propertyId,
          template_key: template.template_key,
          asset_ids: assetIds,
          voiceover_text: voiceover.trim() || null,
          target_channel: targetChannel,
          title: title.trim() || null,
          context: {
            category_key: categoryKey || null,
            what_area:    whatArea || null,
            where_facility_id: whereFacilityId ? Number(whereFacilityId) : null,
          },
        }),
      });
      const j = await res.json();
      if (!res.ok) {
        if (j.error === 'shotstack_key_missing_in_vault' || j.error === 'vault_key_missing_SHOTSTACK_API_KEY') {
          setBanner({ tone:'err', text:'Shotstack key not configured — add SHOTSTACK_API_KEY to Supabase vault.' });
        } else {
          setBanner({ tone:'err', text:`Failed: ${j.error ?? res.statusText}${j.detail ? ' · ' + j.detail : ''}` });
        }
        return;
      }
      setBanner({ tone:'ok', text:`Queued · render_id=${j.id?.slice(0,8) ?? '?'} · status=${j.row?.status ?? 'queued'}. Poll updates below every 15s.` });
      if (j.row) setRows(prev => [j.row, ...prev]);
      // Reset selection so PBS can start next round; keep template + category context.
      setAssetIds([]);
    } catch (e: any) {
      setBanner({ tone:'err', text:`Failed: ${e.message}` });
    } finally {
      setBusy(false);
    }
  }

  const bannerBg = banner?.tone === 'ok' ? '#EAF3EA' : banner?.tone === 'err' ? '#FBE9E7' : '#F7F0E1';
  const bannerFg = banner?.tone === 'ok' ? FOREST : banner?.tone === 'err' ? RED : INK;

  const facilityOptions = facilities.length > 0 ? facilities : [];
  const videoCategories = categories.filter(c => c.active);

  return (
    <div>
      {banner && (
        <div style={{ padding:'10px 14px', background:bannerBg, color:bannerFg, border:'1px solid '+HAIR, borderRadius:4, marginBottom:12, fontSize:12 }}>
          {banner.text} <button onClick={() => setBanner(null)} style={{ marginLeft:8, background:'none', border:'none', cursor:'pointer', color:INK_M }}>×</button>
        </div>
      )}

      {/* Composer — 3 columns like AI Studio */}
      <div style={{ display:'grid', gridTemplateColumns:'320px 1fr 300px', gap:12, marginBottom:16 }}>
        {/* Left: Template + Category + What + Where + Title */}
        <div style={{ background:WHITE, border:'1px solid '+HAIR, borderRadius:6, padding:12, display:'flex', flexDirection:'column', gap:12 }}>
          <div>
            <Label>Template</Label>
            <select value={templateKey} onChange={e => setTemplateKey(e.target.value)} style={S.input}>
              {templates.map(t => <option key={t.template_key} value={t.template_key}>{t.display_name}</option>)}
            </select>
            {template && (
              <div style={{ fontSize:10, color:INK_M, marginTop:4 }}>
                {template.description} · {template.duration_sec}s · {template.min_assets}–{template.max_assets} shots · {template.aspect}
              </div>
            )}
          </div>

          <div>
            <Label>Category (prompt style)</Label>
            <select value={categoryKey} onChange={e => setCategoryKey(e.target.value)} style={S.input}>
              <option value="">(no category)</option>
              {videoCategories.map(c => <option key={c.key} value={c.key}>{c.display_name}</option>)}
            </select>
          </div>

          <div>
            <Label>What (property area)</Label>
            <select value={whatArea} onChange={e => setWhatArea(e.target.value)} style={S.input}>
              <option value="">(pick an area)</option>
              {taxonomy.rooms.length > 0 && (
                <optgroup label="Rooms">{taxonomy.rooms.map(r => <option key={`v-room-${r.id}`} value={r.name}>{r.name}</option>)}</optgroup>
              )}
              {taxonomy.facilities.length > 0 && (
                <optgroup label="Facilities">{taxonomy.facilities.map(f => <option key={`v-fac-${f.id}`} value={f.name}>{f.parent_name ? `${f.name} · ↳ ${f.parent_name}` : f.name}</option>)}</optgroup>
              )}
              {taxonomy.activities.length > 0 && (
                <optgroup label="Activities">{taxonomy.activities.map(a => <option key={`v-act-${a.id}`} value={a.name}>{a.name}</option>)}</optgroup>
              )}
              {taxonomy.meeting_spaces.length > 0 && (
                <optgroup label="Meeting spaces">{taxonomy.meeting_spaces.map(m => <option key={`v-mtg-${m.id}`} value={m.name}>{m.name}</option>)}</optgroup>
              )}
              {taxonomy.transport.length > 0 && (
                <optgroup label="Transport">{taxonomy.transport.map(t => <option key={`v-trp-${t.id}`} value={t.name}>{t.name}</option>)}</optgroup>
              )}
              {(taxonomy.boats && taxonomy.boats.length > 0) && (
                <optgroup label="Imekong · Boats">{taxonomy.boats.map(b => <option key={`v-boat-${b.id}`} value={b.name}>{b.name}</option>)}</optgroup>
              )}
              {(taxonomy.boat_cruises && taxonomy.boat_cruises.length > 0) && (
                <optgroup label="Imekong · Cruises">{taxonomy.boat_cruises.map(c => <option key={`v-cruise-${c.id}`} value={c.name}>{c.name}</option>)}</optgroup>
              )}
            </select>
          </div>

          <div>
            <Label>Where (facility · optional)</Label>
            <select value={whereFacilityId} onChange={e => setWhereFacilityId(e.target.value)} style={S.input}>
              <option value="">(no facility bias)</option>
              {facilityOptions.map(f => <option key={f.facility_id} value={f.facility_id}>{f.facility_name}</option>)}
            </select>
          </div>

          <div>
            <Label>Title (optional)</Label>
            <input value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Sunset bumper — Kingfisher Loft" style={S.input} />
          </div>
        </div>

        {/* Middle: Asset multi-select */}
        <div style={{ background:WHITE, border:'1px solid '+HAIR, borderRadius:6, padding:12, display:'flex', flexDirection:'column' }}>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:8, gap:8 }}>
            <div style={{ fontSize:11, letterSpacing:'0.06em', textTransform:'uppercase', color:INK_M, fontWeight:600 }}>
              Shots · {assetIds.length}/{maxAssets} picked · need ≥ {minAssets}
            </div>
            <input value={assetQuery} onChange={e => setAssetQuery(e.target.value)} placeholder="Search…" style={{ ...S.input, maxWidth:200, padding:'4px 8px', fontSize:11 }} />
          </div>

          {/* Selected strip */}
          {assetsSelected.length > 0 && (
            <div style={{ marginBottom:10, padding:8, background:'#F5F1E6', border:'1px solid '+HAIR, borderRadius:4 }}>
              <div style={{ fontSize:10, color:INK_M, marginBottom:6, textTransform:'uppercase', letterSpacing:'0.06em' }}>Selected · will be stitched in this order</div>
              <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
                {assetsSelected.map((r, idx) => (
                  <div key={r.asset_id} style={{ position:'relative', width:80, height:60, border:'2px solid '+FOREST, borderRadius:3, overflow:'hidden' }}>
                    {r.public_url ? (
                      isVideoRow(r)
                        // eslint-disable-next-line jsx-a11y/media-has-caption
                        ? <video src={r.public_url} preload="metadata" muted style={{ width:'100%', height:'100%', objectFit:'cover' }} />
                        // eslint-disable-next-line @next/next/no-img-element
                        : <img src={r.public_url} alt={r.original_filename} style={{ width:'100%', height:'100%', objectFit:'cover' }} />
                    ) : (
                      <div style={{ width:'100%', height:'100%', background:'#DDD' }} />
                    )}
                    <div style={{ position:'absolute', top:0, left:0, background:FOREST, color:WHITE, fontSize:9, fontWeight:700, padding:'1px 4px' }}>{idx+1}</div>
                    <button onClick={() => toggleAsset(r.asset_id)} title="Remove" style={{
                      position:'absolute', top:0, right:0, background:RED, color:WHITE, border:'none',
                      fontSize:9, fontWeight:700, padding:'1px 4px', cursor:'pointer',
                    }}>×</button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Picker grid */}
          <div style={{ flex:1, overflow:'auto', maxHeight:360, display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(90px, 1fr))', gap:6 }}>
            {assetsForPicker.map(r => {
              const picked = assetIds.includes(r.asset_id);
              const video = isVideoRow(r);
              return (
                <button key={r.asset_id} onClick={() => toggleAsset(r.asset_id)} style={{
                  position:'relative', border: picked ? '2px solid '+FOREST : '1px solid '+HAIR,
                  borderRadius:3, padding:0, background:WHITE, cursor:'pointer', overflow:'hidden',
                }}>
                  <div style={{ position:'relative', width:'100%', height:72, background:'#F5F0E1' }}>
                    {r.public_url ? (
                      video
                        // eslint-disable-next-line jsx-a11y/media-has-caption
                        ? <video src={r.public_url} preload="metadata" muted style={{ width:'100%', height:'100%', objectFit:'cover' }} />
                        // eslint-disable-next-line @next/next/no-img-element
                        : <img src={r.public_url} alt={r.original_filename} loading="lazy" style={{ width:'100%', height:'100%', objectFit:'cover' }} />
                    ) : (
                      <div style={{ width:'100%', height:'100%', display:'flex', alignItems:'center', justifyContent:'center', fontSize:9, color:INK_M }}>no preview</div>
                    )}
                    {video && (
                      <div style={{ position:'absolute', bottom:2, left:2, background:'rgba(0,0,0,0.6)', color:WHITE, fontSize:8, fontWeight:600, padding:'1px 3px', borderRadius:2 }}>▶</div>
                    )}
                    {picked && (
                      <div style={{ position:'absolute', top:2, right:2, background:FOREST, color:WHITE, fontSize:9, fontWeight:700, padding:'1px 4px', borderRadius:2 }}>✓</div>
                    )}
                  </div>
                  <div style={{ padding:'2px 4px', fontSize:9, color:INK, textAlign:'left', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{r.original_filename}</div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Right: Voiceover + Channel + Submit */}
        <div style={{ background:WHITE, border:'1px solid '+HAIR, borderRadius:6, padding:12, display:'flex', flexDirection:'column', gap:12 }}>
          <div>
            <Label>Target channel</Label>
            <select value={targetChannel} onChange={e => setTargetChannel(e.target.value)} style={S.input}>
              {channelSpecs.filter(c => c.video_aspect_ratio).map(c => (
                <option key={c.channel} value={c.channel}>{c.display_name} · {c.video_aspect_ratio}</option>
              ))}
            </select>
          </div>

          <div>
            <Label>Voiceover (optional · ElevenLabs)</Label>
            <textarea value={voiceover} onChange={e => setVoiceover(e.target.value)} rows={6} placeholder="Leave empty for silent." style={{ ...S.input, resize:'vertical', fontFamily:'inherit' }} />
            <div style={{ fontSize:10, color:INK_M, marginTop:4 }}>
              If empty → silent cut. If set → TTS'd via ElevenLabs when key present.
            </div>
          </div>

          <div>
            <Label>Music track</Label>
            <div style={{ fontSize:11, color:INK_M, padding:'8px 10px', border:'1px dashed '+HAIR, borderRadius:3 }}>
              TODO — royalty-free music library. Coming after Voiceover proves out.
            </div>
          </div>

          <button onClick={submit} disabled={busy || !template} style={{
            padding:'10px 14px', fontSize:13, fontWeight:700, background:FOREST, color:WHITE,
            border:'none', borderRadius:4, cursor: (busy || !template) ? 'default' : 'pointer',
            opacity: (busy || !template) ? 0.6 : 1,
          }}>{busy ? 'Queueing…' : 'Render video ▸'}</button>
        </div>
      </div>

      {/* Render queue */}
      <div style={{ marginBottom:8, fontSize:11, color:INK_M, textTransform:'uppercase', letterSpacing:'0.06em', fontWeight:600 }}>
        Render queue · {rows.length}
      </div>
      {rows.length === 0 ? (
        <div style={{ padding:20, textAlign:'center', color:INK_M, background:WHITE, border:'1px solid '+HAIR, borderRadius:4, fontSize:12 }}>No renders yet.</div>
      ) : (
        <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
          {rows.slice(0, 50).map(v => {
            const status = (v.status ?? '').toLowerCase();
            const done   = status === 'done' || status === 'completed';
            const failed = status === 'failed' || status === 'error';
            const tone   = done ? OK : failed ? RED : INK;
            return (
              <div key={v.id} style={{ background:WHITE, border:'1px solid '+HAIR, borderRadius:4, padding:12, fontSize:12, color:INK }}>
                <div style={{ display:'flex', justifyContent:'space-between', gap:8, alignItems:'baseline', flexWrap:'wrap' }}>
                  <span style={{ fontWeight:600 }}>{v.title || '(untitled)'} · {v.channel}{v.aspect ? ' · ' + v.aspect : ''}</span>
                  <span style={{ fontSize:10, color:INK_M }}>{new Date(v.created_at).toLocaleString()}</span>
                </div>
                <div style={{ display:'flex', gap:8, marginTop:4, fontSize:10, color:INK_M, flexWrap:'wrap' }}>
                  <span>status: <strong style={{ color:tone }}>{v.status}</strong></span>
                  {v.shotstack_render_id && <span>shotstack: {v.shotstack_render_id.slice(0, 10)}…</span>}
                  {v.output_asset_id && <span>asset: {v.output_asset_id.slice(0, 8)}…</span>}
                  {v.cost_eur != null && <span>cost: €{Number(v.cost_eur).toFixed(2)}</span>}
                  {v.source_asset_ids && <span>shots: {v.source_asset_ids.length}</span>}
                </div>
                {done && (v as any).output_url && (
                  <a href={(v as any).output_url as string} target="_blank" rel="noopener noreferrer" style={{
                    display:'inline-block', marginTop:6, fontSize:11, color:FOREST, fontWeight:600, textDecoration:'underline',
                  }}>Preview / download ▸</a>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return <div style={{ fontSize:10, letterSpacing:'0.06em', textTransform:'uppercase', color:INK_M, marginBottom:4, fontWeight:600 }}>{children}</div>;
}

const S: Record<string, React.CSSProperties> = {
  input: {
    width: '100%', padding: '6px 10px', fontSize: 12, color: INK,
    background: WHITE, border: '1px solid ' + HAIR, borderRadius: 3, outline: 'none',
  },
};
