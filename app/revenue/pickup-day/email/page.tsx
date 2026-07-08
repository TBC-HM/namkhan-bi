// app/revenue/pickup-day/email/page.tsx
// PBS 2026-07-07 · 07-08: Simple send-day-report page — recipient + note + Send.
// Property-aware: accepts `propertyId` prop (Donna delegate passes it) and forwards
// to /api/pickup-day/email so the correct property's report is sent.

'use client';

import TenantLink from '@/components/nav/TenantLink';
import { useState } from 'react';

interface Props { propertyId?: number }

export default function EmailDayReportPage({ propertyId }: Props = {}) {
  const [to, setTo] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);

  const send = async () => {
    setBusy(true); setMsg(null);
    try {
      const r = await fetch('/api/pickup-day/email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to, note, property_id: propertyId }),
      });
      const j = await r.json();
      if (!r.ok || j.error) setMsg({ kind: 'err', text: j.error ?? `HTTP ${r.status}` });
      else setMsg({ kind: 'ok', text: `Sent to ${j.sent_to}${j.attached ? ` · attached ${j.attached}` : ''}` });
    } catch (err) {
      setMsg({ kind: 'err', text: err instanceof Error ? err.message : String(err) });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ background: '#FFFFFF', minHeight: '100vh', padding: '32px', maxWidth: 640, margin: '0 auto' }}>
      <TenantLink href="/revenue/pickup-day" style={{ fontSize: 12, color: '#5A5A5A', textDecoration: 'none' }}>← Day report</TenantLink>
      <h1 style={{ margin: '8px 0 4px', fontSize: 22, fontWeight: 700 }}>Email day report</h1>
      <p style={{ margin: '0 0 20px', fontSize: 12, color: '#5A5A5A' }}>Sends a short summary (next 14 nights KPIs) with the full 365-night CSV attached.</p>

      <label style={{ display: 'block', fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#5A5A5A' }}>Recipient email</label>
      <input value={to} onChange={e => setTo(e.target.value)} type="email" placeholder="you@thenamkhan.com"
        style={{ display: 'block', width: '100%', padding: '10px 12px', marginTop: 4, marginBottom: 16, border: '1px solid #E6DFCC', borderRadius: 4, fontSize: 13 }} />

      <label style={{ display: 'block', fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#5A5A5A' }}>Note (optional)</label>
      <textarea value={note} onChange={e => setNote(e.target.value)} rows={3} placeholder="Anything you want on top of the summary"
        style={{ display: 'block', width: '100%', padding: '10px 12px', marginTop: 4, marginBottom: 20, border: '1px solid #E6DFCC', borderRadius: 4, fontSize: 13 }} />

      {msg && (
        <div style={{ padding: '10px 14px', borderRadius: 4, marginBottom: 12, fontSize: 12,
          background: msg.kind === 'ok' ? '#F0F7F2' : '#FFF3F1',
          color: msg.kind === 'ok' ? '#084838' : '#B04A2F',
          border: '1px solid ' + (msg.kind === 'ok' ? '#0848380F' : '#B04A2F33') }}>
          {msg.text}
        </div>
      )}

      <button onClick={send} disabled={busy || !to}
        style={{ padding: '10px 18px', background: '#084838', color: '#FFFFFF', border: '1px solid #084838', borderRadius: 4, fontSize: 12, fontWeight: 600, cursor: busy ? 'wait' : 'pointer', opacity: (busy || !to) ? 0.5 : 1 }}>
        {busy ? 'Sending…' : 'Send now'}
      </button>
    </div>
  );
}
