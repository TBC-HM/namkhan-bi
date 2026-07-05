// app/guest/newsletters/_components/DeleteCampaignButton.tsx
// PBS 2026-07-05: cancel a scheduled newsletter. Always reverts the campaign
// row to Draft so you never lose your working "template" copy — you can
// re-schedule or edit again. Sent history is always preserved.
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

interface Props { campaign_id: string; campaign_name: string; pending_count: number; }

export default function DeleteCampaignButton({ campaign_id, campaign_name, pending_count }: Props) {
  const router = useRouter();
  const [working, setWorking] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const del = async () => {
    if (!confirm(`Cancel scheduled send of "${campaign_name}"?\n\n• Cancels ${pending_count} pending recipient${pending_count===1?'':'s'}\n• Campaign returns to your DRAFTS (fully editable + re-schedulable)\n• Sent history is preserved\n• The reusable template stays untouched`)) return;
    setWorking(true); setMsg(null);
    try {
      const res = await fetch('/api/newsletter/delete-campaign', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ campaign_id }),
      });
      const j = await res.json();
      if (j?.ok) {
        setMsg('Returned to Drafts');
        setTimeout(() => router.refresh(), 700);
      } else {
        setMsg('Cancel failed: ' + (j?.error || 'unknown'));
      }
    } catch (e) {
      setMsg('Network error: ' + (e instanceof Error ? e.message : String(e)));
    } finally { setWorking(false); }
  };

  return (
    <>
      <button onClick={del} disabled={working} style={{
        display:'inline-block', padding:'4px 10px', marginLeft:6, fontSize:11, fontWeight:600,
        background:'#FFFFFF', color:'#B03826', border:'1px solid #B03826',
        borderRadius:4, cursor: working ? 'default' : 'pointer',
      }}>{working ? 'Cancelling…' : 'Cancel schedule ↺'}</button>
      {msg && <span style={{ marginLeft:6, fontSize:10, color:'#5A5A5A' }}>{msg}</span>}
    </>
  );
}
