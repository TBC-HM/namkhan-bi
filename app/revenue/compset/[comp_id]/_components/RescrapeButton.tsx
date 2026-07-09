'use client';
// app/revenue/compset/[comp_id]/_components/RescrapeButton.tsx
// PBS 2026-07-09 pm: kicks the scrape-competitor-profile edge fn for this comp_id.

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function RescrapeButton({ compId, propertyName }: { compId: string; propertyName: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const onClick = async () => {
    setBusy(true);
    setMsg(null);
    try {
      const r = await fetch('/api/compset/rescrape', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ comp_id: compId }),
      });
      const j = await r.json();
      if (!r.ok || j.error) { setMsg(`Failed: ${j.error ?? `HTTP ${r.status}`}`); return; }
      setMsg(`Scraped ${propertyName} · ${j.fields_extracted ?? 0} fields.`);
      router.refresh();
    } catch (err) {
      setMsg('Failed: ' + (err instanceof Error ? err.message : String(err)));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      {msg && (
        <span style={{
          fontSize: 11,
          color: msg.startsWith('Failed') ? '#B04A2F' : '#084838',
        }}>{msg}</span>
      )}
      <button
        onClick={onClick}
        disabled={busy}
        style={{
          padding: '6px 14px', fontSize: 12, fontWeight: 600,
          background: busy ? '#5A5A5A' : '#084838',
          color: '#FFFFFF', border: 'none', borderRadius: 4,
          cursor: busy ? 'wait' : 'pointer',
        }}
      >
        {busy ? 'Scraping…' : 'Rescrape'}
      </button>
    </div>
  );
}
