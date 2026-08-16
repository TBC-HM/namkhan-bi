// app/guest/newsletters/_components/RefireAllButton.tsx
'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
const BRAND = '#1F3A2E'; const HAIR = '#E6DFCC';
interface Props { property_id: number; draftCount: number; }
export default function RefireAllButton({ property_id, draftCount }: Props) {
  const router = useRouter();
  const [phase, setPhase] = useState<'idle'|'working'|'done'|'error'>('idle');
  const [msg, setMsg] = useState('');
  const run = async () => {
    if (!confirm(`Archive all ${draftCount} existing broadcast drafts and let the v2 team rewrite everything from scratch?\n\nThis uses the current property settings, retreats, and guardrails.`)) return;
    setPhase('working'); setMsg('Archiving and regenerating…');
    try {
      const res = await fetch('/api/newsletter/refire-broadcasts', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ property_id }),
      });
      const j = await res.json();
      if (j?.ok) {
        setMsg(`✓ Archived ${j.archived} · Generated ${j.generated} new drafts`);
        setPhase('done');
        setTimeout(() => { setPhase('idle'); router.refresh(); }, 2000);
      } else { setPhase('error'); setMsg(j?.error ?? 'Failed'); }
    } catch (e) { setPhase('error'); setMsg(String(e)); }
  };
  return (
    <div style={{ display:'inline-flex', flexDirection:'column', alignItems:'flex-end', gap:4 }}>
      <button onClick={run} disabled={phase==='working'} style={{
        padding:'6px 14px', fontSize:12, fontWeight:600,
        background: phase==='working' ? '#f0ebe0' : '#FFFFFF',
        color:'#B03826', border:'1px solid #B03826',
        borderRadius:4, cursor: phase==='working' ? 'default' : 'pointer',
      }}>
        {phase==='working' ? '↺ Refiring…' : '↺ Delete all + Refire with v2 team'}
      </button>
      {msg && <span style={{ fontSize:11, color: phase==='error' ? '#B03826' : phase==='done' ? '#2A6A3A' : '#5A5A5A' }}>{msg}</span>}
    </div>
  );
}
