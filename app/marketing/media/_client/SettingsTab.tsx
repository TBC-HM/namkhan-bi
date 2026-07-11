// app/marketing/media/_client/SettingsTab.tsx
// PBS 2026-07-12 — Settings: Guardrails (read-only), Channels (read-only), Reality profile (editable).
'use client';

import { useState } from 'react';

interface Rule { rule_id: number; rule_code: string; rule_name: string; rule_scope: string; effect: string; priority: number; message: string | null; }
interface ChannelSpec {
  channel: string; display_name: string; image_min_width: number | null; image_min_height: number | null; image_aspect_ratio: string | null;
  image_max_size_mb: number | null; video_aspect_ratio: string | null; video_max_duration_sec: number | null; notes: string | null;
}
interface Reality {
  property_id: number; location: string | null; region: string | null;
  architecture: string[] | null; materials: string[] | null; palette: string[] | null;
  landscape: string[] | null; forbidden: string[] | null; season_calendar: any;
}

interface Props {
  propertyId: number;
  channelSpecs: ChannelSpec[];
  rulesActive: Rule[];
  reality: Reality | null;
}

const HAIR   = '#E6DFCC';
const INK    = '#1B1B1B';
const INK_M  = '#5A5A5A';
const FOREST = '#084838';
const RED    = '#B03826';
const WHITE  = '#FFFFFF';

type Section = 'rules' | 'channels' | 'reality';

function csvIn(v: string[] | null | undefined): string { return (v ?? []).join(', '); }
function csvOut(s: string): string[] { return s.split(',').map(x => x.trim()).filter(Boolean); }

export default function SettingsTab({ propertyId, channelSpecs, rulesActive, reality }: Props) {
  const [open, setOpen] = useState<Section>('rules');
  const [loc, setLoc] = useState(reality?.location ?? '');
  const [region, setRegion] = useState(reality?.region ?? '');
  const [arch, setArch] = useState(csvIn(reality?.architecture));
  const [mats, setMats] = useState(csvIn(reality?.materials));
  const [palette, setPalette] = useState(csvIn(reality?.palette));
  const [land, setLand] = useState(csvIn(reality?.landscape));
  const [forbidden, setForbidden] = useState(csvIn(reality?.forbidden));
  const [season, setSeason] = useState(JSON.stringify(reality?.season_calendar ?? {}, null, 2));
  const [saving, setSaving] = useState(false);
  const [banner, setBanner] = useState<{ tone: 'ok'|'err'; text: string } | null>(null);

  async function saveReality() {
    setBanner(null);
    let seasonParsed: any;
    try { seasonParsed = JSON.parse(season || '{}'); }
    catch { setBanner({ tone:'err', text:'season_calendar is not valid JSON.' }); return; }
    setSaving(true);
    try {
      const res = await fetch('/api/marketing/media/reality-upsert', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          property_id: propertyId,
          location: loc || null, region: region || null,
          architecture: csvOut(arch), materials: csvOut(mats),
          palette: csvOut(palette), landscape: csvOut(land),
          forbidden: csvOut(forbidden), season_calendar: seasonParsed,
        }),
      });
      const j = await res.json();
      if (!res.ok) { setBanner({ tone:'err', text:`Failed: ${j.error ?? res.statusText}` }); return; }
      setBanner({ tone:'ok', text:'Reality profile saved.' });
    } catch (e: any) { setBanner({ tone:'err', text:`Failed: ${e.message}` }); }
    finally { setSaving(false); }
  }

  const bannerBg = banner?.tone === 'ok' ? '#EAF3EA' : '#FBE9E7';
  const bannerFg = banner?.tone === 'ok' ? FOREST : RED;
  const chip = (label: string, val: string | number | null) => (
    <div style={{ fontSize:10, color:INK_M }}>{label}: <span style={{ color:INK, fontWeight:600 }}>{val ?? '—'}</span></div>
  );

  return (
    <div>
      {banner && (
        <div style={{ padding:'10px 14px', background:bannerBg, color:bannerFg, border:'1px solid '+HAIR, borderRadius:4, marginBottom:12, fontSize:12 }}>
          {banner.text} <button onClick={() => setBanner(null)} style={{ marginLeft:8, background:'none', border:'none', cursor:'pointer', color:INK_M }}>×</button>
        </div>
      )}

      {/* Accordion: Guardrails */}
      <div style={{ background:WHITE, border:'1px solid '+HAIR, borderRadius:6, marginBottom:12 }}>
        <button onClick={() => setOpen(open === 'rules' ? 'channels' : 'rules')} style={{
          width:'100%', padding:'12px 16px', background:'none', border:'none', textAlign:'left', cursor:'pointer',
          display:'flex', justifyContent:'space-between', alignItems:'center',
        }}>
          <span style={{ fontSize:13, fontWeight:600, color:INK }}>Guardrails · {rulesActive.length}</span>
          <span style={{ fontSize:11, color:INK_M }}>{open === 'rules' ? '▾' : '▸'}</span>
        </button>
        {open === 'rules' && (
          <div style={{ padding:'0 16px 16px' }}>
            <div style={{ marginBottom:8, display:'flex', justifyContent:'space-between', alignItems:'center' }}>
              <span style={{ fontSize:11, color:INK_M }}>{rulesActive.length} active rules from public.v_media_rules_active</span>
              <button disabled title="Editable in a later brief" style={{
                padding:'4px 10px', fontSize:11, background:'#F5F0E1', color:INK_M, border:'1px solid '+HAIR, borderRadius:3, cursor:'not-allowed',
              }}>+ Add rule (later)</button>
            </div>
            <div style={{ overflowX:'auto' }}>
              <table style={{ width:'100%', fontSize:11, borderCollapse:'collapse' }}>
                <thead><tr style={{ textAlign:'left', color:INK_M }}>
                  <th style={{ padding:'6px 8px', borderBottom:'1px solid '+HAIR }}>Code</th>
                  <th style={{ padding:'6px 8px', borderBottom:'1px solid '+HAIR }}>Name</th>
                  <th style={{ padding:'6px 8px', borderBottom:'1px solid '+HAIR }}>Scope</th>
                  <th style={{ padding:'6px 8px', borderBottom:'1px solid '+HAIR }}>Effect</th>
                  <th style={{ padding:'6px 8px', borderBottom:'1px solid '+HAIR }}>Priority</th>
                  <th style={{ padding:'6px 8px', borderBottom:'1px solid '+HAIR }}>Message</th>
                </tr></thead>
                <tbody>{rulesActive.map(r => (
                  <tr key={r.rule_id}>
                    <td style={{ padding:'4px 8px', borderBottom:'1px solid '+HAIR, fontFamily:'ui-monospace, SFMono-Regular, monospace' }}>{r.rule_code}</td>
                    <td style={{ padding:'4px 8px', borderBottom:'1px solid '+HAIR }}>{r.rule_name}</td>
                    <td style={{ padding:'4px 8px', borderBottom:'1px solid '+HAIR }}>{r.rule_scope}</td>
                    <td style={{ padding:'4px 8px', borderBottom:'1px solid '+HAIR, color: r.effect === 'deny' ? RED : INK }}>{r.effect}</td>
                    <td style={{ padding:'4px 8px', borderBottom:'1px solid '+HAIR }}>{r.priority}</td>
                    <td style={{ padding:'4px 8px', borderBottom:'1px solid '+HAIR, color:INK_M }}>{r.message ?? ''}</td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Accordion: Channels */}
      <div style={{ background:WHITE, border:'1px solid '+HAIR, borderRadius:6, marginBottom:12 }}>
        <button onClick={() => setOpen(open === 'channels' ? 'reality' : 'channels')} style={{
          width:'100%', padding:'12px 16px', background:'none', border:'none', textAlign:'left', cursor:'pointer',
          display:'flex', justifyContent:'space-between', alignItems:'center',
        }}>
          <span style={{ fontSize:13, fontWeight:600, color:INK }}>Output channels · {channelSpecs.length}</span>
          <span style={{ fontSize:11, color:INK_M }}>{open === 'channels' ? '▾' : '▸'}</span>
        </button>
        {open === 'channels' && (
          <div style={{ padding:'0 16px 16px' }}>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(260px, 1fr))', gap:8 }}>
              {channelSpecs.map(c => (
                <div key={c.channel} style={{ border:'1px solid '+HAIR, borderRadius:4, padding:10 }}>
                  <div style={{ fontSize:12, fontWeight:600, color:INK, marginBottom:4 }}>{c.display_name}</div>
                  <div style={{ display:'flex', flexDirection:'column', gap:2 }}>
                    {chip('image', `${c.image_min_width ?? '—'}×${c.image_min_height ?? '—'} · ${c.image_aspect_ratio ?? 'any'}`)}
                    {chip('max size', c.image_max_size_mb ? `${c.image_max_size_mb} MB` : '—')}
                    {chip('video aspect', c.video_aspect_ratio)}
                    {chip('max video sec', c.video_max_duration_sec)}
                    {c.notes && <div style={{ fontSize:10, color:INK_M, marginTop:4, fontStyle:'italic' }}>{c.notes}</div>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Accordion: Reality profile */}
      <div style={{ background:WHITE, border:'1px solid '+HAIR, borderRadius:6 }}>
        <button onClick={() => setOpen(open === 'reality' ? 'rules' : 'reality')} style={{
          width:'100%', padding:'12px 16px', background:'none', border:'none', textAlign:'left', cursor:'pointer',
          display:'flex', justifyContent:'space-between', alignItems:'center',
        }}>
          <span style={{ fontSize:13, fontWeight:600, color:INK }}>Reality profile · property {propertyId}</span>
          <span style={{ fontSize:11, color:INK_M }}>{open === 'reality' ? '▾' : '▸'}</span>
        </button>
        {open === 'reality' && (
          <div style={{ padding:'0 16px 16px', display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
            <div>
              <label style={{ display:'block', fontSize:11, color:INK_M, marginBottom:4 }}>Location</label>
              <input value={loc} onChange={e => setLoc(e.target.value)} style={{ width:'100%', padding:'6px 10px', fontSize:12, border:'1px solid '+HAIR, borderRadius:4, background:WHITE, color:INK }} />
            </div>
            <div>
              <label style={{ display:'block', fontSize:11, color:INK_M, marginBottom:4 }}>Region</label>
              <input value={region} onChange={e => setRegion(e.target.value)} style={{ width:'100%', padding:'6px 10px', fontSize:12, border:'1px solid '+HAIR, borderRadius:4, background:WHITE, color:INK }} />
            </div>
            <div>
              <label style={{ display:'block', fontSize:11, color:INK_M, marginBottom:4 }}>Architecture (comma-separated)</label>
              <textarea value={arch} onChange={e => setArch(e.target.value)} rows={2} style={{ width:'100%', padding:'6px 10px', fontSize:12, border:'1px solid '+HAIR, borderRadius:4, background:WHITE, color:INK, resize:'vertical' }} />
            </div>
            <div>
              <label style={{ display:'block', fontSize:11, color:INK_M, marginBottom:4 }}>Materials</label>
              <textarea value={mats} onChange={e => setMats(e.target.value)} rows={2} style={{ width:'100%', padding:'6px 10px', fontSize:12, border:'1px solid '+HAIR, borderRadius:4, background:WHITE, color:INK, resize:'vertical' }} />
            </div>
            <div>
              <label style={{ display:'block', fontSize:11, color:INK_M, marginBottom:4 }}>Palette</label>
              <textarea value={palette} onChange={e => setPalette(e.target.value)} rows={2} style={{ width:'100%', padding:'6px 10px', fontSize:12, border:'1px solid '+HAIR, borderRadius:4, background:WHITE, color:INK, resize:'vertical' }} />
            </div>
            <div>
              <label style={{ display:'block', fontSize:11, color:INK_M, marginBottom:4 }}>Landscape</label>
              <textarea value={land} onChange={e => setLand(e.target.value)} rows={2} style={{ width:'100%', padding:'6px 10px', fontSize:12, border:'1px solid '+HAIR, borderRadius:4, background:WHITE, color:INK, resize:'vertical' }} />
            </div>
            <div style={{ gridColumn:'1 / -1' }}>
              <label style={{ display:'block', fontSize:11, color:INK_M, marginBottom:4 }}>Forbidden (never generate these)</label>
              <textarea value={forbidden} onChange={e => setForbidden(e.target.value)} rows={2} style={{ width:'100%', padding:'6px 10px', fontSize:12, border:'1px solid '+HAIR, borderRadius:4, background:WHITE, color:INK, resize:'vertical' }} />
            </div>
            <div style={{ gridColumn:'1 / -1' }}>
              <label style={{ display:'block', fontSize:11, color:INK_M, marginBottom:4 }}>Season calendar (JSON)</label>
              <textarea value={season} onChange={e => setSeason(e.target.value)} rows={4} spellCheck={false} style={{ width:'100%', padding:10, fontSize:11, border:'1px solid '+HAIR, borderRadius:4, background:WHITE, color:INK, fontFamily:'ui-monospace, SFMono-Regular, monospace', resize:'vertical' }} />
            </div>
            <div style={{ gridColumn:'1 / -1' }}>
              <button onClick={saveReality} disabled={saving} style={{
                padding:'8px 16px', fontSize:12, fontWeight:600, background:FOREST, color:WHITE, border:'none', borderRadius:4,
                cursor: saving ? 'default' : 'pointer', opacity: saving ? 0.6 : 1,
              }}>{saving ? 'Saving…' : 'Save reality profile'}</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
