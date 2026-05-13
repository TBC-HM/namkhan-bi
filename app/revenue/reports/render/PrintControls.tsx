'use client';

// Print + Copy + Email controls for the printable revenue report.
// PBS 2026-05-09 #report-builder repair:
//   - "Print" → window.print() (browser also offers Save-as-PDF dialog).
//   - "Copy link" → clipboard with the current URL (sharable).
//   - "Email"     → POSTs to /api/cockpit/reports/send. If SMTP is wired,
//                   that route sends a real email; otherwise it drops a
//                   ticket in cockpit_tickets for manual processing. We
//                   ALWAYS offer a mailto: fallback so a real human can
//                   forward by hand without waiting on infra.

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
      const body = res ? await res.json().catch(() => ({})) : ({} as any);
      if (res && res.ok) {
        const mode = body.mode ?? 'queued';
        if (mode === 'smtp') {
          alert(`Email sent to ${recipients.length} recipient(s).`);
        } else {
          alert(
            `SMTP not wired in this env — request queued as cockpit ticket #${body.ticket_id ?? '—'} for manual send.\n\nRecipients: ${recipients.join(', ')}`,
          );
        }
      } else {
        // Fallback: open a mailto so the user can send by hand.
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
    background: 'transparent',
    border: '1px solid #2a2520',
    color: busy ? '#7d7565' : 'var(--line-soft)',
    cursor: busy ? 'wait' : 'pointer',
    padding: '6px 10px',
    borderRadius: 4,
    fontFamily: 'JetBrains Mono, ui-monospace, monospace',
    fontSize: 11,
    letterSpacing: '0.10em',
    textTransform: 'uppercase',
    fontWeight: 600,
  };
}
