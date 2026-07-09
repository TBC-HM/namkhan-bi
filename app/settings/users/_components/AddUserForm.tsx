// app/settings/users/_components/AddUserForm.tsx
// PBS 2026-07-09 v3: create new user + surface action_link fallback so PBS
// can copy/paste the invitation URL manually when Supabase SMTP isn't configured.
'use client';

import { useState, useTransition, type CSSProperties } from 'react';
import InviteResultCard from './InviteResultCard';

export default function AddUserForm() {
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [namkhan, setNamkhan] = useState(false);
  const [donna, setDonna] = useState(false);
  const [holding, setHolding] = useState(false);
  const [sendInvite, setSendInvite] = useState(true);
  const [pending, startTransition] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  const [result, setResult] = useState<{ email: string; action_link: string | null; email_fired: boolean } | null>(null);

  const create = () => {
    if (!email.trim() || !name.trim()) { setErr('Email + name required'); return; }
    const capturedEmail = email.trim();
    startTransition(async () => {
      setErr(null); setResult(null);
      const r = await fetch('/api/settings/users/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: capturedEmail,
          name: name.trim(),
          namkhan, donna, holding,
          send_invite: sendInvite,
        }),
      });
      const body = await r.json().catch(() => ({}));
      if (!r.ok) { setErr(body.error ?? `create failed (${r.status})`); return; }
      setResult({ email: capturedEmail, action_link: body.action_link ?? null, email_fired: !!body.email_fired });
      setEmail(''); setName(''); setNamkhan(false); setDonna(false); setHolding(false);
    });
  };

  return (
    <div style={{ padding: 4, display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 8 }}>
        <label style={fieldStyle}>
          <span style={labelStyle}>Full name</span>
          <input value={name} onChange={(e) => setName(e.target.value)} style={inputStyle} placeholder="e.g. Rom Jones" />
        </label>
        <label style={fieldStyle}>
          <span style={labelStyle}>Email</span>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} style={inputStyle} placeholder="user@company.com" />
        </label>
      </div>
      <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', marginTop: 4 }}>
        <label style={checkboxStyle}>
          <input type="checkbox" checked={namkhan} onChange={(e) => setNamkhan(e.target.checked)} /> Namkhan (260955)
        </label>
        <label style={checkboxStyle}>
          <input type="checkbox" checked={donna} onChange={(e) => setDonna(e.target.checked)} /> Donna (1000001)
        </label>
        <label style={checkboxStyle}>
          <input type="checkbox" checked={holding} onChange={(e) => setHolding(e.target.checked)} /> Holding (cross-property)
        </label>
        <label style={{ ...checkboxStyle, marginLeft: 'auto' }}>
          <input type="checkbox" checked={sendInvite} onChange={(e) => setSendInvite(e.target.checked)} /> Send invitation email
        </label>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
        <button type="button" onClick={create} disabled={pending} style={submitStyle}>
          {pending ? 'Creating…' : '+ Add user'}
        </button>
        {err && <span style={{ fontSize: 11, color: '#B04A2F' }}>{err}</span>}
      </div>
      {result && (
        <InviteResultCard
          email={result.email}
          actionLink={result.action_link}
          emailFired={result.email_fired}
          onDismiss={() => setResult(null)}
        />
      )}
    </div>
  );
}

const fieldStyle: CSSProperties = { display: 'flex', flexDirection: 'column', gap: 3 };
const labelStyle: CSSProperties = { fontSize: 10, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#5A5A5A', fontWeight: 600 };
const inputStyle: CSSProperties = { padding: '8px 10px', fontSize: 12, border: '1px solid #E6DFCC', borderRadius: 4, background: '#FFFFFF' };
const checkboxStyle: CSSProperties = { fontSize: 11, color: '#1B1B1B', display: 'flex', alignItems: 'center', gap: 5 };
const submitStyle: CSSProperties = {
  padding: '6px 14px', borderRadius: 4, border: 'none',
  background: '#084838', color: '#FFFFFF', fontSize: 11,
  letterSpacing: '0.08em', textTransform: 'uppercase', fontWeight: 600, cursor: 'pointer',
};
