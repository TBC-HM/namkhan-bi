// app/marketing/media/_client/AiStudioTab.tsx
// PBS 2026-07-12 — AI Studio: prompt / from-asset, GPT-Image-1 hidden engine.
// Target tier limited to social/internal (hero + OTA blocked client-side; server rules too).
'use client';

import { useEffect, useState } from 'react';

interface AiGen {
  id: string; property_id: number; mode: string; source_asset_id: string | null;
  prompt: string; effective_prompt: string | null; engine: string;
  target_tier: string; candidate_paths: string[] | null; chosen_asset_id: string | null;
  reality_check: string | null; reality_reason: string | null;
  cost_eur: number | null; cost_cap_eur: number | null;
  status: string; created_by: string | null; created_at: string;
}
interface MediaRow { asset_id: string; original_filename: string; primary_tier: string | null; public_url: string | null; asset_type: string; }

interface Props {
  propertyId: number;
  mediaPage: MediaRow[];
  aiGens: AiGen[];
}

const HAIR   = '#E6DFCC';
const INK    = '#1B1B1B';
const INK_M  = '#5A5A5A';
const FOREST = '#084838';
const RED    = '#B03826';
const WHITE  = '#FFFFFF';

const TIERS = [
  { key: 'tier_social_pool', label: 'Social pool' },
  { key: 'tier_internal',    label: 'Internal only' },
];

export default function AiStudioTab({ propertyId, mediaPage, aiGens }: Props) {
  const [mode, setMode] = useState<'prompt' | 'from_asset'>('prompt');
  const [prompt, setPrompt] = useState('');
  const [tier, setTier] = useState('tier_social_pool');
  const [sourceAssetId, setSourceAssetId] = useState<string>('');
  const [busy, setBusy] = useState(false);
  const [banner, setBanner] = useState<{ tone: 'ok'|'err'|'warn'; text: string } | null>(null);
  const [rows, setRows] = useState<AiGen[]>(aiGens);
  const [polling, setPolling] = useState<string | null>(null);

  useEffect(() => { setRows(aiGens); }, [aiGens]);

  async function refreshRow(id: string) {
    try {
      const res = await fetch(`/api/marketing/media/ai-generate?id=${encodeURIComponent(id)}`);
      const j = await res.json();
      if (res.ok && j.row) {
        setRows(prev => prev.map(r => r.id === id ? j.row : r));
        if (j.row.status === 'completed' || j.row.status === 'failed') setPolling(null);
      }
    } catch { /* ignore */ }
  }

  useEffect(() => {
    if (!polling) return;
    const t = setInterval(() => refreshRow(polling), 5000);
    return () => clearInterval(t);
  }, [polling]);

  async function submit() {
    setBanner(null);
    if (!prompt.trim()) { setBanner({ tone:'warn', text:'Add a prompt describing what you want.' }); return; }
    if (mode === 'from_asset' && !sourceAssetId) { setBanner({ tone:'warn', text:'Pick a source asset.' }); return; }
    setBusy(true);
    try {
      const res = await fetch('/api/marketing/media/ai-generate', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          property_id: propertyId, mode, prompt,
          target_tier: tier,
          source_asset_id: mode === 'from_asset' ? sourceAssetId : null,
        }),
      });
      const j = await res.json();
      if (!res.ok) {
        if (j.error === 'openai_key_missing_in_vault' || /openai/i.test(j.error ?? '')) {
          setBanner({ tone:'err', text:'OpenAI key not configured — ask PBS to add OPENAI_IMAGE_KEY to Supabase vault.' });
        } else {
          setBanner({ tone:'err', text:`Failed: ${j.error ?? res.statusText}` });
        }
        return;
      }
      setBanner({ tone:'ok', text:`Queued generation ${j.id ?? ''}.` });
      if (j.id) { setPolling(j.id); refreshRow(j.id); }
      setPrompt('');
    } catch (e: any) {
      setBanner({ tone:'err', text:`Failed: ${e.message}` });
    } finally { setBusy(false); }
  }

  async function accept(genId: string, candidatePath: string) {
    try {
      const res = await fetch('/api/marketing/media/ai-accept', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ generation_id: genId, candidate_path: candidatePath }),
      });
      const j = await res.json();
      if (!res.ok) { setBanner({ tone:'err', text:`Accept failed: ${j.error ?? res.statusText}` }); return; }
      setBanner({ tone:'ok', text:`Accepted → media library asset ${j.asset_id}.` });
      refreshRow(genId);
    } catch (e: any) { setBanner({ tone:'err', text:`Accept failed: ${e.message}` }); }
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

      <div style={{ background:WHITE, border:'1px solid '+HAIR, borderRadius:6, padding:16, marginBottom:16 }}>
        <div style={{ display:'flex', gap:12, marginBottom:12 }}>
          <button onClick={() => setMode('prompt')} style={{
            padding:'6px 12px', fontSize:12, fontWeight:600, borderRadius:4,
            border:'1px solid ' + (mode === 'prompt' ? FOREST : HAIR),
            background: mode === 'prompt' ? FOREST : WHITE, color: mode === 'prompt' ? WHITE : INK, cursor:'pointer',
          }}>from prompt</button>
          <button onClick={() => setMode('from_asset')} style={{
            padding:'6px 12px', fontSize:12, fontWeight:600, borderRadius:4,
            border:'1px solid ' + (mode === 'from_asset' ? FOREST : HAIR),
            background: mode === 'from_asset' ? FOREST : WHITE, color: mode === 'from_asset' ? WHITE : INK, cursor:'pointer',
          }}>from existing photo</button>
        </div>

        <label style={{ display:'block', fontSize:11, color:INK_M, marginBottom:4, textTransform:'uppercase', letterSpacing:'0.06em' }}>Prompt</label>
        <textarea value={prompt} onChange={e => setPrompt(e.target.value)} rows={4} placeholder="e.g. Namkhan river bend at golden hour, teak villa in the foreground, misty jungle canopy behind" style={{
          width:'100%', padding:10, fontSize:13, border:'1px solid '+HAIR, borderRadius:4, background:WHITE, color:INK, resize:'vertical', marginBottom:12,
        }} />

        <div style={{ display:'grid', gridTemplateColumns: mode === 'from_asset' ? '1fr 1fr' : '1fr', gap:12, marginBottom:12 }}>
          <div>
            <label style={{ display:'block', fontSize:11, color:INK_M, marginBottom:4, textTransform:'uppercase', letterSpacing:'0.06em' }}>Target tier</label>
            <select value={tier} onChange={e => setTier(e.target.value)} style={{
              width:'100%', padding:'6px 10px', fontSize:12, border:'1px solid '+HAIR, borderRadius:4, background:WHITE, color:INK,
            }}>
              {TIERS.map(t => <option key={t.key} value={t.key}>{t.label}</option>)}
            </select>
            <div style={{ fontSize:10, color:INK_M, marginTop:4 }}>Hero + OTA tiers are blocked from AI generation.</div>
          </div>
          {mode === 'from_asset' && (
            <div>
              <label style={{ display:'block', fontSize:11, color:INK_M, marginBottom:4, textTransform:'uppercase', letterSpacing:'0.06em' }}>Source asset</label>
              <select value={sourceAssetId} onChange={e => setSourceAssetId(e.target.value)} style={{
                width:'100%', padding:'6px 10px', fontSize:12, border:'1px solid '+HAIR, borderRadius:4, background:WHITE, color:INK,
              }}>
                <option value="">— pick —</option>
                {mediaPage.filter(m => m.asset_type === 'photo').slice(0, 100).map(m => (
                  <option key={m.asset_id} value={m.asset_id}>{m.original_filename}</option>
                ))}
              </select>
            </div>
          )}
        </div>

        <button onClick={submit} disabled={busy} style={{
          padding:'8px 16px', fontSize:12, fontWeight:600, background:FOREST, color:WHITE,
          border:'none', borderRadius:4, cursor: busy ? 'default' : 'pointer', opacity: busy ? 0.6 : 1,
        }}>{busy ? 'Generating…' : 'Generate ▸ auto'}</button>
      </div>

      <div style={{ marginBottom:8, fontSize:11, color:INK_M, textTransform:'uppercase', letterSpacing:'0.06em', fontWeight:600 }}>Recent generations · {rows.length}</div>
      {rows.length === 0 ? (
        <div style={{ padding:20, textAlign:'center', color:INK_M, background:WHITE, border:'1px solid '+HAIR, borderRadius:4, fontSize:12 }}>
          No generations yet.
        </div>
      ) : (
        <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
          {rows.slice(0, 20).map(g => (
            <div key={g.id} style={{ background:WHITE, border:'1px solid '+HAIR, borderRadius:4, padding:12, fontSize:12, color:INK }}>
              <div style={{ display:'flex', justifyContent:'space-between', gap:8, alignItems:'baseline', flexWrap:'wrap' }}>
                <span style={{ fontWeight:600, overflow:'hidden', textOverflow:'ellipsis' }}>{g.prompt.slice(0, 80)}{g.prompt.length > 80 ? '…' : ''}</span>
                <span style={{ fontSize:10, color:INK_M }}>{new Date(g.created_at).toLocaleString()}</span>
              </div>
              <div style={{ display:'flex', gap:8, marginTop:4, fontSize:10, color:INK_M, flexWrap:'wrap' }}>
                <span>mode: {g.mode}</span>
                <span>tier: {g.target_tier}</span>
                <span>engine: {g.engine}</span>
                <span>status: <strong style={{ color: g.status === 'completed' ? FOREST : g.status === 'failed' ? RED : INK }}>{g.status}</strong></span>
                {g.reality_check && <span>reality: {g.reality_check}</span>}
                {g.cost_eur != null && <span>cost: €{Number(g.cost_eur).toFixed(2)}</span>}
              </div>
              {g.candidate_paths && g.candidate_paths.length > 0 && !g.chosen_asset_id && (
                <div style={{ display:'flex', gap:8, marginTop:8, flexWrap:'wrap' }}>
                  {g.candidate_paths.map((p, i) => (
                    <button key={i} onClick={() => accept(g.id, p)} style={{
                      padding:'4px 10px', fontSize:10, background:FOREST, color:WHITE, border:'none', borderRadius:3, cursor:'pointer',
                    }}>Accept candidate {i + 1}</button>
                  ))}
                </div>
              )}
              {g.chosen_asset_id && <div style={{ fontSize:10, color:FOREST, marginTop:4 }}>✓ accepted as asset {g.chosen_asset_id.slice(0, 8)}</div>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
