// app/login/page.tsx
// ADR-112 · Supabase Auth email/password login.
// PBS 2026-07-09: replaces the legacy workspace_session magic-link login.
// Google SSO wiring is deferred until the OAuth client is configured — for
// now email/password is the only path in.
'use client';

import { useState, type CSSProperties } from 'react';
import { createBrowserClient } from '@supabase/ssr';
import { useRouter, useSearchParams } from 'next/navigation';

const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
);

export default function LoginPage() {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get('next') || '/';
  const [email, setEmail] = useState('');
  const [pw, setPw] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  async function signIn() {
    if (!email.trim() || !pw || busy) return;
    setBusy(true); setErr('');
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password: pw });
    setBusy(false);
    if (error) { setErr(error.message); return; }
    // Middleware re-checks claims on the next request; refresh to make sure
    // server components see the fresh cookie.
    router.push(next);
    router.refresh();
  }

  return (
    <div style={pageStyle}>
      <div style={cardStyle}>
        <div style={eyebrowStyle}>The Beyond Circle · Workspace</div>
        <h1 style={titleStyle}>Sign in</h1>
        <p style={hintStyle}>Enter your email and password.</p>

        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="email"
          autoComplete="email"
          style={inputStyle}
          onKeyDown={(e) => { if (e.key === 'Enter') signIn(); }}
        />
        <input
          type="password"
          value={pw}
          onChange={(e) => setPw(e.target.value)}
          placeholder="password"
          autoComplete="current-password"
          style={{ ...inputStyle, marginTop: 8 }}
          onKeyDown={(e) => { if (e.key === 'Enter') signIn(); }}
        />

        {err && <div style={errStyle}>{err}</div>}

        <button type="button" onClick={signIn} disabled={busy} style={btnStyle}>
          {busy ? 'Signing in…' : 'Sign in'}
        </button>
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
  width: 360, padding: 32, borderRadius: 12,
  background: '#FFFFFF', border: '1px solid #E6DFCC',
  boxShadow: '0 8px 30px rgba(0,0,0,.05)',
};
const eyebrowStyle: CSSProperties = {
  fontSize: 11, letterSpacing: '0.14em', textTransform: 'uppercase',
  color: '#5A5A5A', marginBottom: 8, fontWeight: 600,
};
const titleStyle: CSSProperties = { margin: '0 0 6px', fontSize: 22, color: '#084838', fontWeight: 700 };
const hintStyle: CSSProperties = { color: '#5A5A5A', fontSize: 12, marginBottom: 18 };
const inputStyle: CSSProperties = {
  width: '100%', padding: '10px 12px', fontSize: 13,
  border: '1px solid #E6DFCC', borderRadius: 6, background: '#FFFFFF',
  boxSizing: 'border-box',
};
const errStyle: CSSProperties = { color: '#B04A2F', fontSize: 12, marginTop: 8 };
const btnStyle: CSSProperties = {
  width: '100%', marginTop: 14, padding: '10px', borderRadius: 6, border: 'none',
  background: '#084838', color: '#FFFFFF', fontWeight: 600, cursor: 'pointer',
  fontSize: 13, letterSpacing: '0.06em', textTransform: 'uppercase',
};
