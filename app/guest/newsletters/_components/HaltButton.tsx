// app/guest/newsletters/_components/HaltButton.tsx
// PBS 2026-07-04: cancel all pending sends and revert campaign to draft.
'use client';

import { useState } from 'react';

interface Props {
  campaign_id: string;
  campaign_name: string;
  pending_count: number;
  onDone?: () => void;
}

export default function HaltButton({ campaign_id, campaign_name, pending_count, onDone }: Props) {
  const [working, setWorking] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const halt = async () => {
    if (!confirm(`Halt "${campaign_name}"? ${pending_count} pending send${pending_count===1?'':'s'} will be cancelled and the campaign returns to Draft.`)) return;
    setWorking(true); setMsg(null);
    try {
      const res = await fetch('/api/newsletter/halt', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ campaign_id }),
      });
      const j = await res.json();
      if (j?.ok) {
        setMsg(`Halted · ${j.cancelled} cancelled`);
        if (onDone) setTimeout(onDone, 800);
      } else {
        setMsg('Halt failed: ' + (j?.error || 'unknown'));
      }
    } catch (e) {
      setMsg('Network error: ' + (e instanceof Error ? e.message : String(e)));
    } finally { setWorking(false); }
  };

  return (
    <>
      <button onClick={halt} disabled={working} style={{
        display:'inline-block', padding:'4px 10px', marginLeft:6, fontSize:11, fontWeight:600,
        background: working ? '#8A8A8A' : '#B03826', color:'#FFFFFF',
        border:'none', borderRadius:4, cursor: working ? 'default' : 'pointer',
      }}>
        {working ? 'Halting…' : 'Halt ■'}
      </button>
      {msg && <span style={{ marginLeft:6, fontSize:10, color:'#5A5A5A' }}>{msg}</span>}
    </>
  );
}
