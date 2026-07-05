// app/guest/newsletters/_components/DeleteCampaignButton.tsx
// PBS 2026-07-05: fully delete a scheduled newsletter (recipients + campaign).
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

interface Props { campaign_id: string; campaign_name: string; pending_count: number; }

export default function DeleteCampaignButton({ campaign_id, campaign_name, pending_count }: Props) {
  const router = useRouter();
  const [working, setWorking] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const del = async () => {
    if (!confirm(`Permanently delete "${campaign_name}"? This removes ${pending_count} pending recipient${pending_count===1?'':'s'} + the campaign row. Sent history is preserved (campaign reverts to draft in that case).`)) return;
    setWorking(true); setMsg(null);
    try {
      const res = await fetch('/api/newsletter/delete-campaign', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ campaign_id }),
      });
      const j = await res.json();
      if (j?.ok) {
        setMsg(j.campaign_deleted ? 'Deleted' : 'Reset to draft (sent history kept)');
        setTimeout(() => router.refresh(), 700);
      } else {
        setMsg('Delete failed: ' + (j?.error || 'unknown'));
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
      }}>{working ? 'Deleting…' : 'Delete ×'}</button>
      {msg && <span style={{ marginLeft:6, fontSize:10, color:'#5A5A5A' }}>{msg}</span>}
    </>
  );
}
