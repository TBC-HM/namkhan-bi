// app/marketing/prospects/sequences/new/_components/NewSequenceForm.tsx
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

type Tag = { tag_key: string; label: string; subscriber_count: number };
type Step = { step_no: number; delay_days: number; subject: string; body_md: string };

const HAIR='#E6DFCC'; const INK='#1B1B1B'; const INK_M='#5A5A5A'; const GREEN='#084838'; const RED='#B03826'; const CREAM='#F7F0E1';

export default function NewSequenceForm({ tags }: { tags: Tag[] }) {
  const router = useRouter();
  const [funnelKey, setFunnelKey] = useState('');
  const [name, setName] = useState('');
  const [tag, setTag] = useState('');
  const [description, setDescription] = useState('');
  const [steps, setSteps] = useState<Step[]>([{ step_no: 1, delay_days: 0, subject: '', body_md: '' }]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ kind:'ok'|'err'; text:string } | null>(null);

  const addStep = () => setSteps(s => [...s, { step_no: s.length + 1, delay_days: (s[s.length-1]?.delay_days ?? 0) + 3, subject: '', body_md: '' }]);
  const removeStep = (i: number) => setSteps(s => s.filter((_, j) => j !== i).map((x, j) => ({ ...x, step_no: j + 1 })));
  const updateStep = (i: number, patch: Partial<Step>) => setSteps(s => s.map((x, j) => j === i ? { ...x, ...patch } : x));

  const save = async () => {
    if (!funnelKey.trim() || !name.trim() || !tag || steps.some(s => !s.subject.trim() || !s.body_md.trim())) {
      setMsg({ kind:'err', text: 'Fill key, name, tag, and every step subject + body' });
      return;
    }
    setBusy(true); setMsg(null);
    try {
      const res = await fetch('/api/marketing/sequences/action', {
        method:'POST', headers:{ 'Content-Type':'application/json' },
        body: JSON.stringify({
          rpc:'fn_sequence_seed_from_ai',
          p_funnel_key: funnelKey.trim(),
          p_name: name.trim(),
          p_target_tag_key: tag,
          p_steps: steps,
          p_description: description.trim() || null,
        }),
      });
      const j = await res.json();
      if (j?.ok) { setMsg({ kind:'ok', text: `Saved (${j.steps} steps)` }); setTimeout(() => router.push(`/marketing/prospects/sequences/${j.funnel_id}`), 700); }
      else setMsg({ kind:'err', text: j?.error ?? 'save failed' });
    } catch (e) { setMsg({ kind:'err', text: e instanceof Error ? e.message : String(e) }); }
    finally { setBusy(false); }
  };

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
      <div style={{ padding:16, background:CREAM, border:'1px solid '+HAIR, borderRadius:6, display:'grid', gap:10, gridTemplateColumns:'1fr 1fr' }}>
        <label style={{ display:'flex', flexDirection:'column', gap:4 }}>
          <span style={lbl}>Funnel key (lowercase, underscores)</span>
          <input value={funnelKey} onChange={e => setFunnelKey(e.target.value.toLowerCase().replace(/\s+/g,'_'))} placeholder="e.g. spring_wellness" style={inp} />
        </label>
        <label style={{ display:'flex', flexDirection:'column', gap:4 }}>
          <span style={lbl}>Name (shown to team)</span>
          <input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Spring Wellness Nurture" style={inp} />
        </label>
        <label style={{ display:'flex', flexDirection:'column', gap:4 }}>
          <span style={lbl}>Target tag</span>
          <select value={tag} onChange={e => setTag(e.target.value)} style={inp}>
            <option value="">Pick a tag…</option>
            {tags.map(t => <option key={t.tag_key} value={t.tag_key}>{t.label} ({t.subscriber_count})</option>)}
          </select>
        </label>
        <label style={{ display:'flex', flexDirection:'column', gap:4 }}>
          <span style={lbl}>Description</span>
          <input value={description} onChange={e => setDescription(e.target.value)} placeholder="Optional short summary" style={inp} />
        </label>
      </div>

      <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'baseline' }}>
          <div style={{ fontSize:13, fontWeight:600, color:INK }}>Steps · {steps.length}</div>
          <button onClick={addStep} style={{ padding:'6px 14px', fontSize:12, fontWeight:600, background:'#FFFFFF', color:GREEN, border:'1px solid '+HAIR, borderRadius:4, cursor:'pointer' }}>+ Add step</button>
        </div>
        {steps.map((s, i) => (
          <div key={i} style={{ padding:14, background:'#FFFFFF', border:'1px solid '+HAIR, borderRadius:6, display:'flex', flexDirection:'column', gap:8 }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
              <span style={{ fontSize:11, fontWeight:600, color:INK_M, letterSpacing:'0.06em', textTransform:'uppercase' as const }}>Step {s.step_no}</span>
              <button onClick={() => removeStep(i)} disabled={steps.length === 1} style={{ padding:'3px 10px', fontSize:11, fontWeight:600, background:'#FFFFFF', color:RED, border:'1px solid #E8B7AB', borderRadius:3, cursor: steps.length === 1 ? 'default' : 'pointer', opacity: steps.length === 1 ? 0.4 : 1 }}>Remove</button>
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'120px 1fr', gap:8 }}>
              <label>
                <div style={lbl}>Delay days</div>
                <input type="number" min={0} value={s.delay_days} onChange={e => updateStep(i, { delay_days: Number(e.target.value) })} style={inp} />
              </label>
              <label>
                <div style={lbl}>Subject</div>
                <input value={s.subject} onChange={e => updateStep(i, { subject: e.target.value })} placeholder="Email subject" style={inp} />
              </label>
            </div>
            <label>
              <div style={lbl}>Body (markdown · use [label](url) links; auto-tagged on click)</div>
              <textarea value={s.body_md} onChange={e => updateStep(i, { body_md: e.target.value })} rows={8} style={{ ...inp, fontFamily:'Georgia, serif', resize:'vertical' as const }} />
            </label>
          </div>
        ))}
      </div>

      <div style={{ display:'flex', gap:8, alignItems:'center' }}>
        <button onClick={save} disabled={busy} style={{ padding:'8px 20px', fontSize:12, fontWeight:600, background: busy ? '#C8C0A6' : GREEN, color:'#FFFFFF', border:'1px solid '+(busy ? '#C8C0A6' : GREEN), borderRadius:4, cursor: busy ? 'default' : 'pointer' }}>
          {busy ? 'Saving…' : 'Save as Draft'}
        </button>
        {msg && <span style={{ fontSize:11, color: msg.kind==='ok' ? GREEN : RED }}>{msg.text}</span>}
      </div>
    </div>
  );
}

const lbl = { fontSize:10, fontWeight:600, color:INK_M, letterSpacing:'0.06em', textTransform:'uppercase' as const, marginBottom:3 };
const inp = { width:'100%', padding:'6px 10px', fontSize:12, background:'#FFFFFF', border:'1px solid '+HAIR, borderRadius:3, color:INK };
