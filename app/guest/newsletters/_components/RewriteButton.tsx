// app/guest/newsletters/_components/RewriteButton.tsx
// Opens an inline prompt modal: "Why rewrite / what do you want instead?"
// Calls the v2 refine endpoint, auto-accepts the result, saves, refreshes.
'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

const HAIR = '#E6DFCC'; const INK = '#1B1B1B'; const BRAND = '#1F3A2E';

interface Props { campaign_id: string; property_id: number; }

export default function RewriteButton({ campaign_id, property_id }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [instruction, setInstruction] = useState('');
  const [phase, setPhase] = useState<'idle'|'working'|'done'|'error'>('idle');
  const [msg, setMsg] = useState('');

  const submit = async () => {
    if (!instruction.trim()) return;
    setPhase('working'); setMsg('');
    try {
      // 1. Call refine to get the new content
      const refineRes = await fetch('/api/marketing/newsletter-v2/refine', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ campaign_id, instruction: instruction.trim() }),
      });
      const refineJ = await refineRes.json();
      if (!refineJ?.ok || !refineJ?.proposal?.subject || !refineJ?.proposal?.body_md) {
        setPhase('error'); setMsg(refineJ?.error ?? 'Refine failed — try again'); return;
      }
      // 2026-08-17 fix: refine/route.ts returns { proposal: { subject, body_md } },
      // not top-level fields — the old code read refineJ.subject/.body_md, which are
      // always undefined, so every rewrite silently discarded Saya's real output and
      // fell into the generic error path. Also now forwards the Veda score + issues
      // so patch-campaign can log before/after to marketing.email_learnings — Rewrite
      // was the only path in the engine that never fed the learning loop.
      const veda = refineJ.veda as { score?: number; issues?: string[]; critique?: string } | null;
      const patchRes = await fetch('/api/newsletter/patch-campaign', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          campaign_id, property_id,
          subject: refineJ.proposal.subject, body_md: refineJ.proposal.body_md,
          instruction: instruction.trim(),
          veda_score: veda?.score ?? null,
          veda_issues: veda?.issues ?? null,
        }),
      });
      const patchJ = await patchRes.json();
      if (!patchJ?.ok) { setPhase('error'); setMsg(patchJ?.error ?? 'Save failed'); return; }
      setPhase('done');
      setMsg(typeof veda?.score === 'number' ? `Rewritten ✓ (Veda ${veda.score}/100)` : 'Rewritten ✓');
      setTimeout(() => { setOpen(false); setPhase('idle'); setInstruction(''); router.refresh(); }, 800);
    } catch (e) {
      // 2026-08-17 fix: String(e) on a thrown non-Error object (e.g. a fetch
      // Response body or a Postgrest-style error) renders as "[object Object]"
      // with the real reason hidden. Pull message/details/hint off any shape.
      setPhase('error');
      if (e instanceof Error) setMsg(e.message);
      else if (e && typeof e === 'object') {
        const anyE = e as Record<string, unknown>;
        const parts = [anyE.message, anyE.details, anyE.hint, anyE.error].filter((v): v is string => typeof v === 'string' && v.length > 0);
        setMsg(parts.length ? parts.join(' — ') : JSON.stringify(anyE));
      } else setMsg(String(e));
    }
  };

  return (
    <>
      <button onClick={() => setOpen(true)} style={{
        display:'inline-block', padding:'4px 10px', marginLeft:4, fontSize:11, fontWeight:600,
        background:'#FFFFFF', color:BRAND, border:`1px solid ${HAIR}`,
        borderRadius:4, cursor:'pointer',
      }}>↺ Rewrite</button>

      {open && (
        <div style={{
          position:'fixed', inset:0, background:'rgba(0,0,0,0.35)', zIndex:1000,
          display:'flex', alignItems:'center', justifyContent:'center',
        }} onClick={(e) => { if (e.target === e.currentTarget) setOpen(false); }}>
          <div style={{
            background:'#FFFFFF', borderRadius:8, padding:24, width:480, maxWidth:'90vw',
            boxShadow:'0 8px 32px rgba(0,0,0,0.18)',
          }}>
            <div style={{ fontSize:14, fontWeight:700, color:INK, marginBottom:8 }}>Rewrite this email</div>
            <div style={{ fontSize:12, color:'#5A5A5A', marginBottom:12 }}>
              Why are you rewriting it? What do you want instead?
            </div>
            <textarea
              value={instruction}
              onChange={e => setInstruction(e.target.value)}
              placeholder="e.g. 3 paragraphs, one per retreat, with a retreat hero image at the top. Use real retreat names."
              rows={4}
              style={{
                width:'100%', padding:'8px 10px', fontSize:13, border:`1px solid ${HAIR}`,
                borderRadius:4, resize:'vertical', fontFamily:'inherit', boxSizing:'border-box',
              }}
              autoFocus
            />
            {msg && (
              <div style={{ fontSize:11, marginTop:6, color: phase==='done' ? '#2A6A3A' : '#B03826' }}>{msg}</div>
            )}
            <div style={{ display:'flex', gap:8, marginTop:14, justifyContent:'flex-end' }}>
              <button onClick={() => setOpen(false)} disabled={phase==='working'} style={{
                padding:'6px 16px', fontSize:12, background:'#FFFFFF', color:INK,
                border:`1px solid ${HAIR}`, borderRadius:4, cursor:'pointer',
              }}>Cancel</button>
              <button onClick={submit} disabled={phase==='working' || !instruction.trim()} style={{
                padding:'6px 16px', fontSize:12, fontWeight:600, background:BRAND, color:'#FFFFFF',
                border:`1px solid ${BRAND}`, borderRadius:4,
                cursor: phase==='working' || !instruction.trim() ? 'default' : 'pointer',
                opacity: phase==='working' || !instruction.trim() ? 0.6 : 1,
              }}>
                {phase==='working' ? 'Rewriting…' : phase==='done' ? '✓ Done' : 'Rewrite'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
