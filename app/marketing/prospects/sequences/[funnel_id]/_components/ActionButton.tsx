// app/marketing/prospects/sequences/[funnel_id]/_components/ActionButton.tsx
// PBS 2026-07-05: shared "confirm → POST → redirect" client button for sequence actions.
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

interface Props {
  label: string;
  workingLabel?: string;
  confirmMsg: string;
  rpc: string;
  payload: Record<string, unknown>;
  onSuccessRedirect?: string;
  variant?: 'green' | 'light' | 'red';
}

const GREEN='#084838'; const RED='#B03826'; const HAIR='#E6DFCC';

const styles: Record<string, React.CSSProperties> = {
  green: { padding:'8px 18px', fontSize:12, fontWeight:600, background:GREEN, color:'#FFFFFF', border:'1px solid '+GREEN, borderRadius:4, cursor:'pointer' },
  light: { padding:'8px 18px', fontSize:12, fontWeight:600, background:'#FFFFFF', color:GREEN, border:'1px solid '+HAIR, borderRadius:4, cursor:'pointer' },
  red:   { padding:'8px 18px', fontSize:12, fontWeight:600, background:'#FFFFFF', color:RED, border:'1px solid #E8B7AB', borderRadius:4, cursor:'pointer' },
};

export default function ActionButton({ label, workingLabel = 'Working…', confirmMsg, rpc, payload, onSuccessRedirect, variant = 'green' }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const run = async () => {
    if (!confirm(confirmMsg)) return;
    setBusy(true); setMsg(null);
    try {
      const res = await fetch('/api/marketing/sequences/action', {
        method:'POST', headers:{ 'Content-Type':'application/json' },
        body: JSON.stringify({ rpc, ...payload }),
      });
      const j = await res.json();
      if (j?.ok) {
        setMsg('Done');
        if (onSuccessRedirect) setTimeout(() => router.push(onSuccessRedirect), 500);
        else router.refresh();
      } else {
        setMsg('Failed: ' + (j?.error ?? 'unknown'));
      }
    } catch (e) { setMsg(e instanceof Error ? e.message : String(e)); }
    finally { setBusy(false); }
  };

  return (
    <div style={{ display:'inline-flex', alignItems:'center', gap:8 }}>
      <button onClick={run} disabled={busy} style={{ ...styles[variant], opacity: busy ? 0.5 : 1 }}>
        {busy ? workingLabel : label}
      </button>
      {msg && <span style={{ fontSize:11, color: msg.startsWith('Failed') ? RED : GREEN }}>{msg}</span>}
    </div>
  );
}
