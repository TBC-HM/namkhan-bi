// app/revenue/lighthouse/_shared/LighthouseActions.tsx
// PBS 2026-07-08: Download CSV + Email report action buttons for Lighthouse shell.
// Uses the ⬇ + ✉ icon convention shipped sitewide today.

'use client';

import { useState } from 'react';

interface Props { propertyId: number }

const iconBtn: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
  width: 34, height: 30, borderRadius: 4,
  background: 'var(--paper, #FFFFFF)', color: 'var(--ink, #1B1B1B)',
  border: '1px solid var(--hairline, #E6DFCC)', cursor: 'pointer',
  textDecoration: 'none',
};

export default function LighthouseActions({ propertyId }: Props) {
  const [sending, setSending] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function doEmail() {
    const to = window.prompt('Send Lighthouse compset report to (email address):');
    if (!to) return;
    setSending(true); setMsg(null);
    try {
      const r = await fetch('/api/lighthouse/email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to, property_id: propertyId }),
      });
      const j = await r.json().catch(() => ({}));
      setMsg(r.ok ? `✓ Sent to ${to}` : `✗ ${j.error ?? 'send failed'}`);
    } catch (e) {
      setMsg(`✗ ${e instanceof Error ? e.message : String(e)}`);
    } finally { setSending(false); }
  }

  return (
    <div style={{ display: 'inline-flex', gap: 8, alignItems: 'center' }} className="no-print">
      <a
        href={`/api/lighthouse/csv?property_id=${propertyId}`}
        title="Download compset CSV (Excel-friendly)"
        aria-label="Download compset CSV"
        style={iconBtn}
      >
        <span aria-hidden style={{ fontSize: 16, lineHeight: 1 }}>⬇</span>
      </a>
      <button
        type="button"
        onClick={doEmail}
        disabled={sending}
        title="Email compset report (summary + CSV attachment)"
        aria-label="Email compset report"
        style={{ ...iconBtn, opacity: sending ? 0.6 : 1 }}
      >
        <span aria-hidden style={{ fontSize: 16, lineHeight: 1 }}>{sending ? '…' : '✉'}</span>
      </button>
      {msg && <span style={{ fontSize: 11, color: msg.startsWith('✓') ? '#1F5C2C' : '#B04A2F' }}>{msg}</span>}
    </div>
  );
}
