'use client';

// Print + Copy + Email controls for the printable revenue report.
// PBS 2026-07-03: contrast fix — buttons were `color: var(--line-soft)` on
// paper white, unreadable. Now paper white + ink text + hairline border,
// matches the design system pill treatment on the rest of the cockpit.

import { useState } from 'react';

interface Props {
  reportType: string;
}

export default function PrintControls({ reportType }: Props) {
  const [busy, setBusy] = useState(false);

  const onPrint = () => window.print();

  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      alert('Report URL copied — paste into chat or email.');
    } catch {
      alert(window.location.href);
    }
  };

  const onEmail = async () => {
    const recipientRaw = window.prompt(
      'Send this report to (comma-separated emails):',
      'pbsbase@gmail.com',
    );
    if (!recipientRaw) return;
    const recipients = recipientRaw
      .split(/[\s,;]+/)
      .map(s => s.trim())
      .filter(s => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(s));
    if (recipients.length === 0) {
      alert('No valid email addresses found.');
      return;
    }
    setBusy(true);
    try {
      const res = await fetch('/api/cockpit/reports/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: reportType,
          url: window.location.href,
          recipients,
          subject: `Namkhan · ${reportType} report`,
        }),
      }).catch(() => null);
      const body = res ? await res.json().catch(() => ({} as Record<string, unknown>)) : ({} as Record<string, unknown>);
      if (res && res.ok) {
        const mode = String(body.mode ?? 'queued');
        if (mode === 'smtp') {
          alert(`Email sent to ${recipients.length} recipient(s).`);
        } else {
          alert(
            `SMTP not wired in this env — request queued as cockpit ticket #${String(body.ticket_id ?? '—')} for manual send.\n\nRecipients: ${recipients.join(', ')}`,
          );
        }
      } else {
        const subject = encodeURIComponent(`Namkhan · ${reportType} report`);
        const bodyTxt = encodeURIComponent(
          `Latest ${reportType} report:\n\n${window.location.href}\n`,
        );
        window.location.href = `mailto:${recipients.join(',')}?subject=${subject}&body=${bodyTxt}`;
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ display: 'inline-flex', gap: 6 }} className="no-print">
      <button onClick={onPrint} style={btnStyle()} title="Print this report (or Save as PDF in the browser dialog)">
        Print
      </button>
      <button onClick={onCopy} style={btnStyle()} title="Copy report URL to clipboard">
        Copy link
      </button>
      <button onClick={onEmail} disabled={busy} style={btnStyle(busy)} title="Send this report by email">
        {busy ? 'Sending…' : 'Email'}
      </button>
    </div>
  );
}

function btnStyle(busy = false): React.CSSProperties {
  return {
    background: '#FFFFFF',
    border: '1px solid #E6DFCC',
    color: busy ? '#8A8A8A' : '#1B1B1B',
    cursor: busy ? 'wait' : 'pointer',
    padding: '6px 12px',
    borderRadius: 4,
    fontFamily: 'inherit',
    fontSize: 11,
    letterSpacing: '0.06em',
    textTransform: 'uppercase',
    fontWeight: 600,
  };
}
