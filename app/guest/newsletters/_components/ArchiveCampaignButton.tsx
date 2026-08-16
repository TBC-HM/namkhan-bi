// app/guest/newsletters/_components/ArchiveCampaignButton.tsx
'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

interface Props { campaign_id: string; campaign_name: string; }

export default function ArchiveCampaignButton({ campaign_id, campaign_name }: Props) {
  const router = useRouter();
  const [working, setWorking] = useState(false);

  const dismiss = async () => {
    if (!confirm(`Dismiss "${campaign_name}"?\nIt will be archived and removed from this view.`)) return;
    setWorking(true);
    try {
      const res = await fetch('/api/newsletter/archive-campaign', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ campaign_id }),
      });
      const j = await res.json();
      if (j?.ok) router.refresh();
    } finally { setWorking(false); }
  };

  return (
    <button onClick={dismiss} disabled={working} title="Dismiss (archive)" style={{
      display:'inline-flex', alignItems:'center', justifyContent:'center',
      width:26, height:26, marginLeft:4, fontSize:14, fontWeight:700,
      background:'#FFFFFF', color:'#777', border:'1px solid #E6DFCC',
      borderRadius:4, cursor: working ? 'default' : 'pointer', lineHeight:1,
    }}>{working ? '…' : '✕'}</button>
  );
}
