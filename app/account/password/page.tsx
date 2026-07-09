// app/account/password/page.tsx
// PBS 2026-07-09: self-service password change. Requires an active session
// (middleware enforces it). Supabase does a re-auth internally on updateUser
// so no need to prompt for current password.

'use client';

import { useState, type CSSProperties } from 'react';
import { createBrowserClient } from '@supabase/ssr';
import { useRouter } from 'next/navigation';

const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
);

export default function ChangePasswordPage() {
  const router = useRouter();
  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function save() {
    setErr(null); setMsg(null);
    if (pw.length < 8) { setErr('Password must be at least 8 characters.'); return; }
    if (pw !== pw2) { setErr('Passwords do not match.'); return; }
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password: pw });
    setBusy(false);
    if (error) { setErr(error.message); return; }
    setMsg('✓ password updated. redirecting…');
    setTimeout(() => { router.push('/'); }, 1200);
  }

  return (
    <div style={pageStyle}>
      <div style={cardStyle}>
        <div style={eyebrowStyle}>Account · Beyond Circle</div>
        <h1 style={titleStyle}>Change password</h1>
        <p style={hintStyle}>
          Enter a new password (min 8 chars). Signed session required — you&apos;ll stay signed in.
        </p>

        <label style={labelStyle}>New password</label>
        <input
          type="password"
          value={pw}
          onChange={(e) => setPw(e.target.value)}
          autoComplete="new-password"
          style={inputStyle}
          onKeyDown={(e) => { if (e.key === 'Enter') save(); }}
        />
        <label style={{ ...labelStyle, marginTop: 12 }}>Confirm new password</label>
        <input
          type="password"
          value={pw2}
          onChange={(e) => setPw2(e.target.value)}
          autoComplete="new-password"
          style={inputStyle}
          onKeyDown={(e) => { if (e.key === 'Enter') save(); }}
        />

        {err && <div style={errStyle}>{err}</div>}
        {msg && <div style={okStyle}>{msg}</div>}

        <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
          <button type="button" onClick={save} disabled={busy || !pw || !pw2} style={btnStyle}>
            {busy ? 'Saving…' : 'Update password'}
          </button>
          <a href="/" style={cancelStyle}>Cancel</a>
        </div>
      </div>
    </div>
  );
}

const pageStyle: CSSProperties = {
  minHeight: '100vh', display: 'grid', placeItems: 'center',
  background: '#F4EFE2', color: '#1B1B1B',
  fontFamily: 'system-ui, sans-serif',
};
const cardStyle: CSSProperties = {
  width: 380, padding: 32, borderRadius: 12,
  background: '#FFFFFF', border: '1px solid #E6DFCC',
  boxShadow: '0 8px 30px rgba(0,0,0,.05)',
};
const eyebrowStyle: CSSProperties = {
  fontSize: 11, letterSpacing: '0.14em', textTransform: 'uppercase',
  color: '#5A5A5A', marginBottom: 8, fontWeight: 600,
};
const titleStyle: CSSProperties = { margin: '0 0 6px', fontSize: 22, color: '#084838', fontWeight: 700 };
const hintStyle: CSSProperties = { color: '#5A5A5A', fontSize: 12, marginBottom: 18 };
const labelStyle: CSSProperties = {
  fontSize: 10, letterSpacing: '0.06em', textTransform: 'uppercase',
  color: '#5A5A5A', fontWeight: 600, display: 'block', marginBottom: 4,
};
const inputStyle: CSSProperties = {
  width: '100%', padding: '10px 12px', fontSize: 13,
  border: '1px solid #E6DFCC', borderRadius: 6, background: '#FFFFFF',
  boxSizing: 'border-box',
};
const errStyle: CSSProperties = { color: '#B04A2F', fontSize: 12, marginTop: 10 };
const okStyle: CSSProperties = { color: '#0B5B3A', fontSize: 12, marginTop: 10 };
const btnStyle: CSSProperties = {
  flex: 1, padding: '10px', borderRadius: 6, border: 'none',
  background: '#084838', color: '#FFFFFF', fontWeight: 600, cursor: 'pointer',
  fontSize: 13, letterSpacing: '0.06em', textTransform: 'uppercase',
};
const cancelStyle: CSSProperties = {
  padding: '10px 14px', borderRadius: 6, border: '1px solid #E6DFCC',
  color: '#1B1B1B', textDecoration: 'none', fontWeight: 600, fontSize: 12,
  display: 'flex', alignItems: 'center',
};
