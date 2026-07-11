// app/marketing/media/_client/VideoTab.tsx
// PBS 2026-07-12 — Video tab. Timeline JSON + Shotstack render queue.
'use client';

import { useMemo, useState } from 'react';

interface MediaRow { asset_id: string; original_filename: string; asset_type: string; public_url: string | null; primary_tier: string | null; }
interface ChannelSpec { channel: string; display_name: string; video_aspect_ratio: string | null; video_max_duration_sec: number | null; }
interface VideoEdit {
  id: string; property_id: number; title: string | null; channel: string;
  aspect: string | null; timeline: any; source_asset_ids: string[] | null;
  status: string; shotstack_render_id: string | null; output_asset_id: string | null;
  cost_eur: number | null; cost_cap_eur: number | null; created_by: string | null; created_at: string; rendered_at: string | null;
}

interface Props {
  propertyId: number;
  mediaPage: MediaRow[];
  channelSpecs: ChannelSpec[];
  videoEdits: VideoEdit[];
}

const HAIR   = '#E6DFCC';
const INK    = '#1B1B1B';
const INK_M  = '#5A5A5A';
const FOREST = '#084838';
const RED    = '#B03826';
const WHITE  = '#FFFFFF';

const PRESETS: Array<{ key: string; label: string; template: string }> = [
  {
    key: '60s',
    label: '60s teaser',
    template: JSON.stringify({
      timeline: { background: '#000000', tracks: [{ clips: [{ asset: { type: 'image', src: 'CLIP_URL_HERE' }, start: 0, length: 60, effect: 'zoomIn' }] }] },
      output: { format: 'mp4', resolution: 'hd' },
    }, null, 2),
  },
  {
    key: '30s',
    label: '30s reel',
    template: JSON.stringify({
      timeline: { background: '#000000', tracks: [{ clips: [{ asset: { type: 'image', src: 'CLIP_URL_HERE' }, start: 0, length: 30, effect: 'kenBurns' }] }] },
      output: { format: 'mp4', resolution: 'hd' },
    }, null, 2),
  },
  {
    key: '15s',
    label: '15s story',
    template: JSON.stringify({
      timeline: { background: '#000000', tracks: [{ clips: [{ asset: { type: 'image', src: 'CLIP_URL_HERE' }, start: 0, length: 15, effect: 'zoomOut' }] }] },
      output: { format: 'mp4', resolution: 'hd' },
    }, null, 2),
  },
];

export default function VideoTab({ propertyId, mediaPage, channelSpecs, videoEdits }: Props) {
  const [preset, setPreset] = useState('60s');
  const [timeline, setTimeline] = useState(PRESETS[0].template);
  const [title, setTitle] = useState('');
  const [channel, setChannel] = useState<string>(channelSpecs[0]?.channel ?? 'youtube');
  const [extraChannels, setExtraChannels] = useState<string[]>([]);
  const [selectedFootage, setSelectedFootage] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [banner, setBanner] = useState<{ tone: 'ok'|'err'|'warn'; text: string } | null>(null);
  const [rows, setRows] = useState<VideoEdit[]>(videoEdits);

  const footageVideos = useMemo(() => mediaPage.filter(m => m.asset_type === 'video'), [mediaPage]);
  const footageStills = useMemo(() => mediaPage.filter(m => m.asset_type === 'photo').slice(0, 100), [mediaPage]);

  function applyPreset(k: string) {
    setPreset(k);
    const p = PRESETS.find(x => x.key === k);
    if (p) setTimeline(p.template);
  }

  function toggleFootage(id: string) {
    setSelectedFootage(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  }

  function toggleExtraChannel(c: string) {
    setExtraChannels(prev => prev.includes(c) ? prev.filter(x => x !== c) : [...prev, c]);
  }

  async function submit() {
    setBanner(null);
    let parsed: any;
    try { parsed = JSON.parse(timeline); }
    catch { setBanner({ tone:'err', text:'Timeline JSON is invalid.' }); return; }
    setBusy(true);
    try {
      const res = await fetch('/api/marketing/media/video-render', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          property_id: propertyId, title: title || null, channel, aspect: channelSpecs.find(c => c.channel === channel)?.video_aspect_ratio ?? null,
          timeline: parsed, source_asset_ids: selectedFootage, extra_channels: extraChannels,
        }),
      });
      const j = await res.json();
      if (!res.ok) {
        if (j.error === 'shotstack_key_missing_in_vault') {
          setBanner({ tone:'err', text:'Shotstack key not configured — ask PBS to add SHOTSTACK_API_KEY to Supabase vault.' });
        } else {
          setBanner({ tone:'err', text:`Failed: ${j.error ?? res.statusText}` });
        }
        return;
      }
      setBanner({ tone:'ok', text:`Video edit queued · id=${j.id?.slice(0,8) ?? ''}${j.extra_ids?.length ? ` (+${j.extra_ids.length} extra channel renders)` : ''}.` });
      if (j.row) setRows(prev => [j.row, ...prev]);
    } catch (e: any) { setBanner({ tone:'err', text:`Failed: ${e.message}` }); }
    finally { setBusy(false); }
  }

  const bannerBg = banner?.tone === 'ok' ? '#EAF3EA' : banner?.tone === 'err' ? '#FBE9E7' : '#F7F0E1';
  const bannerFg = banner?.tone === 'ok' ? FOREST : banner?.tone === 'err' ? RED : INK;

  return (
    <div>
      {banner && (
        <div style={{ padding:'10px 14px', background:bannerBg, color:bannerFg, border:'1px solid '+HAIR, borderRadius:4, marginBottom:12, fontSize:12 }}>
          {banner.text} <button onClick={() => setBanner(null)} style={{ marginLeft:8, background:'none', border:'none', cursor:'pointer', color:INK_M }}>×</button>
        </div>
      )}

      <div style={{ display:'grid', gridTemplateColumns:'260px 1fr 260px', gap:12, marginBottom:16 }}>
        {/* Left · footage picker */}
        <div style={{ background:WHITE, border:'1px solid '+HAIR, borderRadius:6, padding:10 }}>
          <div style={{ fontSize:11, color:INK_M, textTransform:'uppercase', letterSpacing:'0.06em', fontWeight:600, marginBottom:8 }}>Footage · {footageVideos.length} video · {footageStills.length} stills</div>
          <div style={{ maxHeight:280, overflow:'auto', display:'flex', flexDirection:'column', gap:4 }}>
            {[...footageVideos, ...footageStills].map(m => (
              <label key={m.asset_id} style={{ display:'flex', gap:6, alignItems:'center', fontSize:11, color:INK, cursor:'pointer' }}>
                <input type="checkbox" checked={selectedFootage.includes(m.asset_id)} onChange={() => toggleFootage(m.asset_id)} />
                <span style={{ overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{m.asset_type === 'video' ? '▶ ' : '◻ '}{m.original_filename}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Middle · timeline JSON */}
        <div style={{ background:WHITE, border:'1px solid '+HAIR, borderRadius:6, padding:10 }}>
          <div style={{ display:'flex', gap:8, marginBottom:8, alignItems:'center', flexWrap:'wrap' }}>
            <span style={{ fontSize:11, color:INK_M, textTransform:'uppercase', letterSpacing:'0.06em', fontWeight:600 }}>Timeline</span>
            {PRESETS.map(p => (
              <button key={p.key} onClick={() => applyPreset(p.key)} style={{
                padding:'4px 10px', fontSize:11, borderRadius:3,
                border:'1px solid ' + (preset === p.key ? FOREST : HAIR),
                background: preset === p.key ? FOREST : WHITE,
                color: preset === p.key ? WHITE : INK, cursor:'pointer',
              }}>{p.label}</button>
            ))}
          </div>
          <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Title (optional)" style={{
            width:'100%', padding:'6px 10px', fontSize:12, border:'1px solid '+HAIR, borderRadius:4, background:WHITE, color:INK, marginBottom:8,
          }} />
          <textarea value={timeline} onChange={e => setTimeline(e.target.value)} rows={16} spellCheck={false} style={{
            width:'100%', padding:10, fontSize:11, border:'1px solid '+HAIR, borderRadius:4, background:WHITE, color:INK, fontFamily:'ui-monospace, SFMono-Regular, monospace', resize:'vertical',
          }} />
        </div>

        {/* Right · channels */}
        <div style={{ background:WHITE, border:'1px solid '+HAIR, borderRadius:6, padding:10 }}>
          <div style={{ fontSize:11, color:INK_M, textTransform:'uppercase', letterSpacing:'0.06em', fontWeight:600, marginBottom:8 }}>Primary channel</div>
          <select value={channel} onChange={e => setChannel(e.target.value)} style={{
            width:'100%', padding:'6px 10px', fontSize:12, border:'1px solid '+HAIR, borderRadius:4, background:WHITE, color:INK, marginBottom:12,
          }}>
            {channelSpecs.filter(c => c.video_aspect_ratio).map(c => <option key={c.channel} value={c.channel}>{c.display_name} · {c.video_aspect_ratio}</option>)}
          </select>
          <div style={{ fontSize:11, color:INK_M, textTransform:'uppercase', letterSpacing:'0.06em', fontWeight:600, marginBottom:6 }}>Also render for</div>
          <div style={{ maxHeight:180, overflow:'auto', display:'flex', flexDirection:'column', gap:4 }}>
            {channelSpecs.filter(c => c.video_aspect_ratio && c.channel !== channel).map(c => (
              <label key={c.channel} style={{ display:'flex', gap:6, alignItems:'center', fontSize:11, color:INK, cursor:'pointer' }}>
                <input type="checkbox" checked={extraChannels.includes(c.channel)} onChange={() => toggleExtraChannel(c.channel)} />
                <span>{c.display_name} · {c.video_aspect_ratio}</span>
              </label>
            ))}
          </div>
          <button onClick={submit} disabled={busy} style={{
            marginTop:12, width:'100%', padding:'8px 12px', fontSize:12, fontWeight:600, background:FOREST, color:WHITE, border:'none', borderRadius:4,
            cursor: busy ? 'default' : 'pointer', opacity: busy ? 0.6 : 1,
          }}>{busy ? 'Rendering…' : 'Render video ▸'}</button>
        </div>
      </div>

      <div style={{ marginBottom:8, fontSize:11, color:INK_M, textTransform:'uppercase', letterSpacing:'0.06em', fontWeight:600 }}>Render queue · {rows.length}</div>
      {rows.length === 0 ? (
        <div style={{ padding:20, textAlign:'center', color:INK_M, background:WHITE, border:'1px solid '+HAIR, borderRadius:4, fontSize:12 }}>No renders yet.</div>
      ) : (
        <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
          {rows.slice(0, 50).map(v => {
            const tone = v.status === 'completed' ? FOREST : v.status === 'failed' ? RED : INK;
            return (
              <div key={v.id} style={{ background:WHITE, border:'1px solid '+HAIR, borderRadius:4, padding:12, fontSize:12, color:INK }}>
                <div style={{ display:'flex', justifyContent:'space-between', gap:8, alignItems:'baseline', flexWrap:'wrap' }}>
                  <span style={{ fontWeight:600 }}>{v.title || '(untitled)'}  ·  {v.channel} {v.aspect ? ` · ${v.aspect}` : ''}</span>
                  <span style={{ fontSize:10, color:INK_M }}>{new Date(v.created_at).toLocaleString()}</span>
                </div>
                <div style={{ display:'flex', gap:8, marginTop:4, fontSize:10, color:INK_M, flexWrap:'wrap' }}>
                  <span>status: <strong style={{ color:tone }}>{v.status}</strong></span>
                  {v.shotstack_render_id && <span>shotstack: {v.shotstack_render_id.slice(0, 10)}…</span>}
                  {v.output_asset_id && <span>asset: {v.output_asset_id.slice(0, 8)}…</span>}
                  {v.cost_eur != null && <span>cost: €{Number(v.cost_eur).toFixed(2)}</span>}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
