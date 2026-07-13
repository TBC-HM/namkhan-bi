'use client';
// app/settings/gmail/_client.tsx
// Connected / disconnected controls + "Send test email" button.

import { useState } from 'react';
import ComposeModal from '@/app/_components/ComposeModal';

const WHITE = '#FFFFFF', HAIR = '#E6DFCC', INK = '#1B1B1B', INK_M = '#5A5A5A', FOREST = '#084838', RED = '#B03826';

interface Props {
  state: 'connected' | 'disconnected';
  gmailAddress?: string;
  connectedAt?: string;
}

export default function GmailSettingsClient(props: Props) {
  const [busy, setBusy] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; text: string } | null>(null);
  const [composeOpen, setComposeOpen] = useState(false);

  async function onDisconnect() {
    if (!confirm('Disconnect Gmail? You can reconnect any time.')) return;
    setBusy(true);
    try {
      const r = await fetch('/api/user/gmail/disconnect', { method: 'POST' });
      if (r.ok) location.reload();
      else alert('Disconnect failed');
    } finally { setBusy(false); }
  }

  async function onSendTest() {
    if (!props.gmailAddress) return;
    setBusy(true);
    setTestResult(null);
    try {
      const r = await fetch('/api/user/gmail/send', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          to: props.gmailAddress,
          subject: 'Test from Namkhan BI',
          body_html: '<p>This is a test email sent from the Namkhan BI dashboard to prove the Gmail send flow works.</p><p style="color:#5A5A5A;font-size:12px">Sent at ' + new Date().toISOString() + '</p>',
        }),
      });
      const j = await r.json();
      if (r.ok) setTestResult({ ok: true, text: 'Sent · id ' + (j.id ?? '') });
      else setTestResult({ ok: false, text: 'Failed: ' + (j.detail ?? j.error ?? 'unknown') });
    } catch (e) {
      setTestResult({ ok: false, text: 'Error: ' + (e instanceof Error ? e.message : 'unknown') });
    } finally { setBusy(false); }
  }

  if (props.state === 'disconnected') {
    return (
      <div style={{ padding: 16, background: WHITE, border: '1px solid ' + HAIR, borderRadius: 6 }}>
        <div style={{ fontSize: 14, marginBottom: 12 }}>Your Gmail is not connected.</div>
        <a
          href="/api/user/gmail/connect"
          style={{ display: 'inline-block', padding: '8px 14px', background: FOREST, color: WHITE, borderRadius: 4, textDecoration: 'none', fontSize: 13, fontWeight: 600 }}
        >
          Connect Gmail
        </a>
      </div>
    );
  }

  return (
    <>
      <div style={{ padding: 16, background: WHITE, border: '1px solid ' + HAIR, borderRadius: 6 }}>
        <div style={{ fontSize: 14 }}>
          Connected as <strong>{props.gmailAddress}</strong>
          {props.connectedAt && (
            <span style={{ color: INK_M, marginLeft: 8, fontSize: 12 }}>
              since {new Date(props.connectedAt).toLocaleDateString()}
            </span>
          )}
        </div>
        <div style={{ display: 'flex', gap: 8, marginTop: 14, flexWrap: 'wrap' }}>
          <button
            onClick={onSendTest}
            disabled={busy}
            style={{ padding: '6px 12px', background: WHITE, color: INK, border: '1px solid ' + HAIR, borderRadius: 4, fontSize: 12, cursor: 'pointer', fontWeight: 500 }}
          >
            {busy ? 'Sending…' : 'Send test email'}
          </button>
          <button
            onClick={() => setComposeOpen(true)}
            disabled={busy}
            style={{ padding: '6px 12px', background: FOREST, color: WHITE, border: '1px solid ' + FOREST, borderRadius: 4, fontSize: 12, cursor: 'pointer', fontWeight: 600 }}
          >
            Compose new
          </button>
          <button
            onClick={onDisconnect}
            disabled={busy}
            style={{ padding: '6px 12px', background: WHITE, color: RED, border: '1px solid ' + RED, borderRadius: 4, fontSize: 12, cursor: 'pointer', fontWeight: 500, marginLeft: 'auto' }}
          >
            Disconnect
          </button>
        </div>
        {testResult && (
          <div style={{ marginTop: 12, fontSize: 12, color: testResult.ok ? FOREST : RED }}>
            {testResult.text}
          </div>
        )}
      </div>
      {composeOpen && <ComposeModal onClose={() => setComposeOpen(false)} onSent={() => setComposeOpen(false)} />}
    </>
  );
}
