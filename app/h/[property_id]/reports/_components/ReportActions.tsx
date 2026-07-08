'use client';

// app/h/[property_id]/reports/_components/ReportActions.tsx
// Per-row actions on Recent reports: Reopen + Send + Delete. PBS #148.
// Send: POST /api/cockpit/reports/send. Delete: rpc fn_soft_delete_report_run.

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';

interface Props {
  runId: number;
  reopenHref: string;
  reportType: string;
  reportUrl: string;
}

export default function ReportActions({ runId, reopenHref, reportType, reportUrl }: Props) {
  const sb = createClient();
  const [hidden, setHidden] = useState(false);
  const [sending, startSending] = useTransition();
  const [deleting, startDeleting] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);

  if (hidden) return null;

  const send = () => {
    const raw = window.prompt('Send report to (comma-separated emails):', '');
    if (!raw) return;
    const recipients = raw.split(',').map((s) => s.trim().toLowerCase()).filter((s) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s));
    if (recipients.length === 0) { setMsg('no valid email'); return; }
    startSending(async () => {
      try {
        const fullUrl = reportUrl.startsWith('http') ? reportUrl : `${window.location.origin}${reportUrl}`;
        const res = await fetch('/api/cockpit/reports/send', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ type: reportType, url: fullUrl, recipients }),
        });
        if (res.ok) setMsg('sent ✓');
        else setMsg('send failed');
      } catch { setMsg('send error'); }
      setTimeout(() => setMsg(null), 3000);
    });
  };

  const del = () => {
    if (!window.confirm('Delete this report run?')) return;
    startDeleting(async () => {
      const { error } = await sb.rpc('fn_soft_delete_report_run', { p_id: runId });
      if (error) { setMsg('delete failed'); setTimeout(() => setMsg(null), 3000); return; }
      setHidden(true);
    });
  };

  return (
    <div style={{ display: 'flex', gap: 6, alignItems: 'center', justifyContent: 'flex-end' }}>
      <Link href={reopenHref} target="_blank" rel="noopener noreferrer" style={linkStyle}>
        Reopen ↗
      </Link>
      <button type="button" onClick={send} disabled={sending} title="Email report" aria-label="Email report" style={sendBtnStyle}>
        {sending ? '…' : <span aria-hidden style={{ fontSize: 16, lineHeight: 1 }}>✉</span>}
      </button>
      <button type="button" onClick={del} disabled={deleting} aria-label="Delete" style={delBtnStyle}>
        {deleting ? '…' : 'Delete'}
      </button>
      {msg && <span style={{ fontSize: 10, color: 'var(--ink-soft, #5A5A5A)' }}>{msg}</span>}
    </div>
  );
}

const linkStyle: React.CSSProperties = {
  fontSize: 11,
  color: 'var(--primary, #1F3A2E)',
  textDecoration: 'none',
  fontWeight: 600,
  padding: '4px 8px',
};
const sendBtnStyle: React.CSSProperties = {
  padding: '4px 10px',
  fontSize: 11,
  fontWeight: 600,
  letterSpacing: '0.04em',
  textTransform: 'uppercase',
  background: 'var(--paper, #FFFFFF)',
  color: 'var(--ink, #1B1B1B)',
  border: '1px solid var(--hairline, #E6DFCC)',
  borderRadius: 4,
  cursor: 'pointer',
  fontFamily: 'inherit',
};
const delBtnStyle: React.CSSProperties = {
  padding: '4px 10px',
  fontSize: 11,
  fontWeight: 600,
  letterSpacing: '0.04em',
  textTransform: 'uppercase',
  background: 'var(--paper, #FFFFFF)',
  color: '#8A2A1D',
  border: '1px solid #E0CDC8',
  borderRadius: 4,
  cursor: 'pointer',
  fontFamily: 'inherit',
};
