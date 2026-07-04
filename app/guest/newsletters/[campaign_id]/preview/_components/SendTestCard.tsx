// app/guest/newsletters/[campaign_id]/preview/_components/SendTestCard.tsx
// PBS 2026-07-04: compact "Send test" control on the newsletter preview page.
// Renders + sends via /api/newsletter/send-test → send-newsletter-test edge fn.
'use client';

import { useState } from 'react';

interface Props {
  campaign_id: string;
  default_email?: string;
}

export default function SendTestCard({ campaign_id, default_email = 'pb@thenamkhan.com' }: Props) {
  const [email, setEmail]         = useState(default_email);
  const [firstName, setFirstName] = useState('Paul');
  const [sending, setSending]     = useState(false);
  const [msg, setMsg]             = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);

  const send = async () => {
    setSending(true);
    setMsg(null);
    try {
      const res = await fetch('/api/newsletter/send-test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ campaign_id, to_email: email, first_name: firstName }),
      });
      const j = await res.json();
      if (j?.ok) {
        setMsg({ kind: 'ok', text: `Sent to ${email}${j.id ? ' · Resend id ' + j.id : ''}` });
      } else {
        setMsg({ kind: 'err', text: j?.error || 'Send failed' });
      }
    } catch (e) {
      const em = e instanceof Error ? e.message : 'Network error';
      setMsg({ kind: 'err', text: em });
    } finally {
      setSending(false);
    }
  };

  const HAIR='#E6DFCC'; const INK='#1B1B1B'; const NK_GREEN='#084838'; const CREAM='#F7F0E1';

  return (
    <div style={{
      background: CREAM, border: '1px solid ' + HAIR, borderRadius: 4,
      padding: '12px 16px', marginBottom: 16,
      display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap',
    }}>
      <div style={{ fontSize: 11, fontWeight: 600, color: INK, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
        Send test
      </div>
      <input
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="you@example.com"
        style={{
          flex: '1 1 200px', minWidth: 180, padding: '6px 10px',
          border: '1px solid ' + HAIR, borderRadius: 3,
          fontSize: 12, color: INK, background: '#FFFFFF',
        }}
      />
      <input
        type="text"
        value={firstName}
        onChange={(e) => setFirstName(e.target.value)}
        placeholder="First name"
        style={{
          width: 110, padding: '6px 10px',
          border: '1px solid ' + HAIR, borderRadius: 3,
          fontSize: 12, color: INK, background: '#FFFFFF',
        }}
      />
      <button
        onClick={send}
        disabled={sending}
        style={{
          padding: '6px 14px', background: sending ? '#8AA095' : NK_GREEN,
          color: '#FFFFFF', border: 'none', borderRadius: 3,
          fontSize: 12, fontWeight: 600, cursor: sending ? 'default' : 'pointer',
          letterSpacing: '0.04em',
        }}
      >
        {sending ? 'Sending…' : 'Send test →'}
      </button>
      {msg && (
        <div style={{
          flex: '1 0 100%', fontSize: 11,
          color: msg.kind === 'ok' ? '#1F5C2C' : '#B03826',
          marginTop: 4,
        }}>
          {msg.text}
        </div>
      )}
    </div>
  );
}
