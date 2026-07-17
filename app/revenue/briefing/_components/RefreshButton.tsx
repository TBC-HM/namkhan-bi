'use client';
// app/revenue/briefing/_components/RefreshButton.tsx
// PBS 2026-07-17 — manual re-evaluation trigger. The cron runs @ 06:00 Vientiane
// daily; this button lets the rev manager pull a fresh evaluation on demand.
// POSTs to /api/cron/briefing-evaluate?pid=... then router.refresh() so the
// updated briefing.items rows show up without a hard reload.

import { useRouter } from 'next/navigation';
import { useState } from 'react';

interface Props { propertyId: number }

export default function RefreshButton({ propertyId }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function handleRefresh() {
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch(`/api/cron/briefing-evaluate?pid=${propertyId}`, { method: 'POST' });
      const data = await res.json();
      const summary = (data?.results ?? [])
        .map((r: { property_id: number; insights: number; upserted: number; errors: number }) =>
          `${r.insights} evaluated · ${r.upserted} saved${r.errors ? ` · ${r.errors} errors` : ''}`)
        .join(' · ');
      setMsg(summary || 'done');
      router.refresh();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
      <button
        type="button"
        onClick={handleRefresh}
        disabled={busy}
        style={{
          fontSize: 12,
          padding: '6px 12px',
          borderRadius: 4,
          border: '1px solid #084838',
          background: busy ? '#E6DFCC' : '#084838',
          color: busy ? '#5A5A5A' : '#FFFFFF',
          fontWeight: 600,
          cursor: busy ? 'not-allowed' : 'pointer',
          letterSpacing: '0.04em',
          textTransform: 'uppercase',
        }}
      >
        {busy ? 'Evaluating…' : '↻ Refresh briefings'}
      </button>
      {msg && (
        <span style={{ fontSize: 11, color: '#5A5A5A' }}>{msg}</span>
      )}
    </div>
  );
}
