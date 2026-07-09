'use client';
// app/operations/sops/[sop_code]/send/_components/SopSendForm.tsx
// PBS 2026-07-09 pm: POSTs to /api/sop/send → relays to send-report-email edge fn (Resend).

import { useState } from 'react';

export default function SopSendForm({ sopCode, defaultSubject, preview }: { sopCode: string; defaultSubject: string; preview: string }) {
  const [to, setTo] = useState('');
  const [subject, setSubject] = useState(defaultSubject);
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);

  const send = async () => {
    if (!to.trim()) { setMsg({ kind: 'err', text: 'Recipient email required.' }); return; }
    setSending(true); setMsg(null);
    try {
      const r = await fetch('/api/sop/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sop_code: sopCode, to: to.trim(), subject, message }),
      });
      const j = await r.json();
      if (!r.ok || j.error) setMsg({ kind: 'err', text: j.error ?? `HTTP ${r.status}` });
      else setMsg({ kind: 'ok', text: `Sent to ${to.trim()}.` });
    } catch (err) {
      setMsg({ kind: 'err', text: err instanceof Error ? err.message : String(err) });
    } finally {
      setSending(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {msg && (
        <div style={{ padding: '8px 12px', borderRadius: 4, fontSize: 12,
          background: msg.kind === 'ok' ? '#F0F7F2' : '#FFF3F1',
          color: msg.kind === 'ok' ? '#084838' : '#B04A2F',
          border: '1px solid ' + (msg.kind === 'ok' ? '#0848380F' : '#B04A2F33') }}>{msg.text}</div>
      )}
      <Field label="Recipient email"><input type="email" value={to} onChange={(e) => setTo(e.target.value)} placeholder="team@thenamkhan.com" style={inp} /></Field>
      <Field label="Subject"><input value={subject} onChange={(e) => setSubject(e.target.value)} style={inp} /></Field>
      <Field label="Optional cover note"><textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={4} style={{ ...inp, minHeight: 80 }} /></Field>
      <div style={{ padding: 12, background: '#FAFAF7', border: '1px solid #E6DFCC', borderRadius: 4 }}>
        <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#5A5A5A', marginBottom: 6 }}>Preview</div>
        <div style={{ fontSize: 12, color: '#3A3A3A', whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>
          {preview.slice(0, 400)}{preview.length > 400 ? '…' : ''}
        </div>
      </div>
      <div style={{ display: 'flex', gap: 10, marginTop: 6 }}>
        <button onClick={send} disabled={sending} style={btnPrimary}>{sending ? 'Sending…' : 'Send by email'}</button>
        <a href={`/operations/sops/${encodeURIComponent(sopCode)}/preview`} style={btnGhost}>Preview</a>
        <a href="/operations/sops" style={btnGhost}>← Back</a>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#5A5A5A' }}>{label}</span>
      {children}
    </label>
  );
}

const inp: React.CSSProperties = { padding: '8px 10px', border: '1px solid #E6DFCC', borderRadius: 4, fontSize: 13, background: '#FFFFFF', color: '#1B1B1B', width: '100%' };
const btnPrimary: React.CSSProperties = { padding: '8px 16px', background: '#084838', color: '#FFFFFF', border: '1px solid #084838', borderRadius: 4, fontSize: 12, fontWeight: 600, cursor: 'pointer' };
const btnGhost: React.CSSProperties = { padding: '8px 14px', background: '#FFFFFF', color: '#5A5A5A', border: '1px solid #E6DFCC', borderRadius: 4, fontSize: 12, fontWeight: 500, textDecoration: 'none' };
