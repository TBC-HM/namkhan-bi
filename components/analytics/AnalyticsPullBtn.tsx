'use client';
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';

type PullReq = { endpoint: string; body: Record<string, unknown> };

export default function AnalyticsPullBtn({ requests, label, variant='primary' }: {
  requests: PullReq[];
  label: string;
  variant?: 'primary'|'secondary';
}) {
  const router = useRouter();
  const [,startTransition] = useTransition();
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [err, setErr] = useState('');

  const GREEN = '#084838';
  const st = {
    padding: '4px 12px', fontSize: 11, fontWeight: 600, borderRadius: 4,
    cursor: busy ? 'wait' : 'pointer', border: 'none', opacity: busy ? 0.6 : 1,
    background: done ? '#16A34A' : variant === 'primary' ? GREEN : '#FAFAF7',
    color: done ? '#fff' : variant === 'primary' ? '#fff' : GREEN,
    ...(variant === 'secondary' ? {border:'1px solid #E6DFCC'} : {}),
  };

  const run = async () => {
    if (busy) return;
    setBusy(true); setDone(false); setErr('');
    try {
      for (const r of requests) {
        const res = await fetch(r.endpoint, {
          method: 'POST',
          headers: {'Content-Type':'application/json'},
          body: JSON.stringify(r.body),
        });
        if (!res.ok) { const j = await res.json().catch(()=>({})); throw new Error(j.error ?? 'request failed'); }
      }
      setDone(true);
      startTransition(() => { router.refresh(); });
    } catch (e: any) {
      setErr(e.message ?? 'Error');
    }
    setBusy(false);
  };

  return (
    <span style={{display:'inline-flex',alignItems:'center',gap:6}}>
      <button onClick={run} style={st as React.CSSProperties}>
        {busy ? '⏳ Pulling…' : done ? '✓ Done' : label}
      </button>
      {err && <span style={{fontSize:10,color:'#B03826'}}>{err}</span>}
    </span>
  );
}
