// app/marketing/prospects/sequences/ai-propose/_components/AiProposeForm.tsx
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

type Seg = 'welcome' | 'wellness' | 'couples' | 'culture';
type Step = { step_no: number; delay_days: number; subject: string; body_md: string; click_tag_map: Record<string, string> };
type Funnel = { name: string; target_segment_key: string; steps: Step[] };

const HAIR='#E6DFCC'; const INK='#1B1B1B'; const INK_M='#5A5A5A'; const GREEN='#084838'; const RED='#B03826'; const CREAM='#F7F0E1';

export default function AiProposeForm() {
  const router = useRouter();
  const [segment, setSegment] = useState<Seg>('wellness');
  const [funnelKey, setFunnelKey] = useState('wellness_ai');
  const [brief, setBrief] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [proposed, setProposed] = useState<Funnel | null>(null);
  const [msg, setMsg] = useState<{ kind:'ok'|'err'; text:string } | null>(null);

  const propose = async () => {
    setBusy('propose'); setMsg(null); setProposed(null);
    try {
      const res = await fetch('/api/marketing/funnels/ai-propose', {
        method:'POST', headers:{ 'Content-Type':'application/json' },
        body: JSON.stringify({ segment, custom_brief: brief.trim() || undefined }),
      });
      const j = await res.json();
      if (j?.ok && j.funnel) { setProposed(j.funnel as Funnel); setMsg({ kind:'ok', text: j.stub ? 'Fallback stub (no ANTHROPIC_API_KEY)' : `Claude proposed ${j.funnel.steps.length} steps` }); }
      else setMsg({ kind:'err', text: j?.error ?? 'propose failed' });
    } catch (e) { setMsg({ kind:'err', text: e instanceof Error ? e.message : String(e) }); }
    finally { setBusy(null); }
  };

  const save = async () => {
    if (!proposed) return;
    setBusy('save'); setMsg(null);
    try {
      const res = await fetch('/api/marketing/sequences/action', {
        method:'POST', headers:{ 'Content-Type':'application/json' },
        body: JSON.stringify({
          rpc:'fn_sequence_seed_from_ai',
          p_funnel_key: funnelKey.trim(),
          p_name: proposed.name,
          p_target_tag_key: proposed.target_segment_key,
          p_steps: proposed.steps,
          p_description: `AI-proposed sequence for segment=${segment}`,
        }),
      });
      const j = await res.json();
      if (j?.ok) { setMsg({ kind:'ok', text:`Saved as draft (${j.steps} steps)` }); setTimeout(() => router.push(`/marketing/prospects/sequences/${j.funnel_id}`), 700); }
      else setMsg({ kind:'err', text: j?.error ?? 'save failed' });
    } catch (e) { setMsg({ kind:'err', text: e instanceof Error ? e.message : String(e) }); }
    finally { setBusy(null); }
  };

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
      <div style={{ padding:16, background:CREAM, border:'1px solid '+HAIR, borderRadius:6, display:'grid', gap:12 }}>
        <div style={{ fontSize:13, fontWeight:600, color:INK }}>1. Choose a target segment</div>
        <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
          {(['welcome','wellness','couples','culture'] as Seg[]).map(s => (
            <button key={s} onClick={() => setSegment(s)}
              style={{ padding:'6px 14px', fontSize:12, fontWeight:600, background: segment === s ? GREEN : '#FFFFFF', color: segment === s ? '#FFFFFF' : INK, border:'1px solid '+(segment === s ? GREEN : HAIR), borderRadius:4, cursor:'pointer', textTransform:'capitalize' }}>
              {s}
            </button>
          ))}
        </div>
        <label style={{ display:'flex', flexDirection:'column', gap:4 }}>
          <span style={label}>Sequence key (used as URL slug in DB · lowercase, underscores)</span>
          <input value={funnelKey} onChange={e => setFunnelKey(e.target.value)} style={input} />
        </label>
        <label style={{ display:'flex', flexDirection:'column', gap:4 }}>
          <span style={label}>Custom brief (optional · e.g. &ldquo;emphasise the 2027 January detox retreat&rdquo;)</span>
          <textarea value={brief} onChange={e => setBrief(e.target.value)} rows={3} style={{ ...input, resize:'vertical' as const, fontFamily:'inherit' }} />
        </label>
        <div>
          <button onClick={propose} disabled={busy !== null}
            style={{ padding:'8px 20px', fontSize:12, fontWeight:600, background: busy ? '#C8C0A6' : GREEN, color:'#FFFFFF', border:'1px solid '+(busy ? '#C8C0A6' : GREEN), borderRadius:4, cursor: busy ? 'default' : 'pointer' }}>
            {busy === 'propose' ? 'Asking Claude…' : 'Ask Claude to propose sequence'}
          </button>
        </div>
        {msg && !proposed && <div style={{ fontSize:11, color: msg.kind==='ok' ? GREEN : RED }}>{msg.text}</div>}
      </div>

      {proposed && (
        <div style={{ padding:16, background:'#FFFFFF', border:'1px solid '+HAIR, borderRadius:6, display:'flex', flexDirection:'column', gap:12 }}>
          <div style={{ fontSize:13, fontWeight:600, color:INK }}>2. Review the proposal</div>
          <div style={{ padding:'8px 12px', background:CREAM, borderRadius:4, fontSize:12, color:INK }}>
            <strong>{proposed.name}</strong> · target tag: <code>{proposed.target_segment_key}</code> · {proposed.steps.length} steps
          </div>
          <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
            {proposed.steps.map(s => (
              <div key={s.step_no} style={{ border:'1px solid '+HAIR, borderRadius:6, padding:'10px 14px' }}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:6 }}>
                  <span style={{ fontSize:11, fontWeight:600, color:INK_M, letterSpacing:'0.06em' }}>Step {s.step_no} · +{s.delay_days} days</span>
                  {Object.keys(s.click_tag_map ?? {}).length > 0 && (
                    <span style={{ fontSize:10, color:INK_M }}>Click tags: {Object.entries(s.click_tag_map).map(([slug, tag]) => `${slug}→${tag}`).join(' · ')}</span>
                  )}
                </div>
                <div style={{ fontSize:13, fontWeight:600, color:INK, marginBottom:6 }}>{s.subject}</div>
                <div style={{ fontFamily:'Georgia, serif', fontSize:12, color:INK, whiteSpace:'pre-wrap', lineHeight:1.5, background:'#FDFCF8', padding:10, border:'1px solid '+HAIR, borderRadius:4, maxHeight:200, overflow:'auto' }}>
                  {s.body_md}
                </div>
              </div>
            ))}
          </div>
          <div style={{ display:'flex', gap:8, alignItems:'center' }}>
            <button onClick={save} disabled={busy !== null || !funnelKey.trim()}
              style={{ padding:'8px 20px', fontSize:12, fontWeight:600, background: busy || !funnelKey.trim() ? '#C8C0A6' : GREEN, color:'#FFFFFF', border:'1px solid '+(busy || !funnelKey.trim() ? '#C8C0A6' : GREEN), borderRadius:4, cursor: busy || !funnelKey.trim() ? 'default' : 'pointer' }}>
              {busy === 'save' ? 'Saving…' : 'Save as Draft sequence'}
            </button>
            <button onClick={() => setProposed(null)} disabled={busy !== null} style={{ padding:'8px 20px', fontSize:12, fontWeight:600, background:'#FFFFFF', color:INK, border:'1px solid '+HAIR, borderRadius:4, cursor:'pointer' }}>Discard</button>
            {msg && <span style={{ fontSize:11, color: msg.kind==='ok' ? GREEN : RED }}>{msg.text}</span>}
          </div>
        </div>
      )}
    </div>
  );
}

const label = { fontSize:11, fontWeight:600, color:INK_M, letterSpacing:'0.06em', textTransform:'uppercase' as const };
const input = { padding:'8px 12px', fontSize:12, background:'#FFFFFF', border:'1px solid '+HAIR, borderRadius:3, color:INK };
