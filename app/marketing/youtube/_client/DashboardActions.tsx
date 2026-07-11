'use client';
// app/marketing/youtube/_client/DashboardActions.tsx
// PBS 2026-07-11 pm — Refresh + Disconnect buttons for the YT dashboard.

import { useRouter } from 'next/navigation';
import { useState } from 'react';

const HAIR   = '#E6DFCC';
const INK    = '#1B1B1B';
const INK_M  = '#5A5A5A';
const WHITE  = '#FFFFFF';
const RED    = '#B03826';

interface Props { propertyId: number }

export default function DashboardActions({ propertyId }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState<null | 'refresh' | 'disconnect'>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const btn: React.CSSProperties = {
    padding: '6px 12px', border: `1px solid ${HAIR}`, borderRadius: 3,
    background: WHITE, color: INK, fontSize: 11, cursor: 'pointer',
    letterSpacing: '.04em', textTransform: 'uppercase',
  };

  const onRefresh = async () => {
    setBusy('refresh'); setMsg(null);
    try {
      const r = await fetch('/api/marketing/youtube/refresh-dashboard', { method: 'POST' });
      const j = await r.json().catch(() => ({}));
      if (!r.ok || !j.ok) throw new Error(j.error ?? `HTTP ${r.status}`);
      router.refresh();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'refresh failed');
    } finally {
      setBusy(null);
    }
  };

  const onDisconnect = async () => {
    if (!confirm('Disconnect YouTube channel? Lumen will no longer be able to publish.')) return;
    setBusy('disconnect'); setMsg(null);
    try {
      const r = await fetch('/api/marketing/youtube/disconnect', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ property_id: propertyId }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok || !j.ok) throw new Error(j.error ?? `HTTP ${r.status}`);
      router.refresh();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'disconnect failed');
    } finally {
      setBusy(null);
    }
  };

  return (
    <div style={{ display: 'grid', gap: 6, justifyItems: 'end' }}>
      <button type="button" onClick={onRefresh} disabled={busy !== null} style={btn}>
        {busy === 'refresh' ? 'Refreshing…' : 'Refresh'}
      </button>
      <button type="button" onClick={onDisconnect} disabled={busy !== null}
        style={{ ...btn, color: RED, borderColor: '#E4C6C0' }}>
        {busy === 'disconnect' ? 'Disconnecting…' : 'Disconnect'}
      </button>
      {msg && <div style={{ fontSize: 10, color: RED, maxWidth: 160, textAlign: 'right' }}>{msg}</div>}
      <div style={{ fontSize: 10, color: INK_M }}>via Data API v3</div>
    </div>
  );
}
