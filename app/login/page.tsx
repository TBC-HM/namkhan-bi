// app/login/page.tsx
// ADR-112 · Supabase Auth email/password login.
// PBS 2026-07-09: replaces the legacy workspace_session magic-link login.
// PBS 2026-07-09 (v2): "Forgot password?" flow. Toggle switches the form to
// email-only; on submit we call supabase.auth.resetPasswordForEmail() which
// mails a link that lands the user at /auth/callback?next=/account/password.
'use client';

import { useState, type CSSProperties } from 'react';
import { createBrowserClient } from '@supabase/ssr';
import { useRouter, useSearchParams } from 'next/navigation';

const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
);

type Mode = 'signin' | 'forgot';

export default function LoginPage() {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get('next') || '/';
  const [mode, setMode] = useState<Mode>('signin');
  const [email, setEmail] = useState('');
  const [pw, setPw] = useState('');
  const [err, setErr] = useState('');
  const [ok, setOk] = useState('');
  const [busy, setBusy] = useState(false);

  async function signIn() {
    if (!email.trim() || !pw || busy) return;
    setBusy(true); setErr(''); setOk('');
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password: pw });
    setBusy(false);
    if (error) { setErr(error.message); return; }
    router.push(next);
    router.refresh();
  }

  async function forgot() {
    if (!email.trim() || busy) return;
    setBusy(true); setErr(''); setOk('');
    const redirectTo = `${location.origin}/auth/callback?next=${encodeURIComponent('/account/password')}`;
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo });
    setBusy(false);
    if (error) { setErr(error.message); return; }
    setOk(`Reset link sent to ${email.trim()}. Check your inbox.`);
  }

  const submit = mode === 'signin' ? signIn : forgot;

  return (
    <div style={pageStyle}>
      <div style={cardStyle}>
        <div style={eyebrowStyle}>The Beyond Circle · Workspace</div>
        <h1 style={titleStyle}>{mode === 'signin' ? 'Sign in' : 'Reset password'}</h1>
        <p style={hintStyle}>
          {mode === 'signin'
            ? 'Enter your email and password.'
            : 'Enter your email — we\'ll send you a reset link.'}
        </p>

        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="email"
          autoComplete="email"
          style={inputStyle}
          onKeyDown={(e) => { if (e.key === 'Enter') submit(); }}
        />
        {mode === 'signin' && (
          <input
            type="password"
            value={pw}
            onChange={(e) => setPw(e.target.value)}
            placeholder="password"
            autoComplete="current-password"
            style={{ ...inputStyle, marginTop: 8 }}
            onKeyDown={(e) => { if (e.key === 'Enter') submit(); }}
          />
        )}

        {err && <div style={errStyle}>{err}</div>}
        {ok && <div style={okStyle}>{ok}</div>}

        <button type="button" onClick={submit} disabled={busy} style={btnStyle}>
          {busy
            ? (mode === 'signin' ? 'Signing in…' : 'Sending…')
            : (mode === 'signin' ? 'Sign in' : 'Send reset link')}
        </button>

        <button
          type="button"
          onClick={() => { setMode(mode === 'signin' ? 'forgot' : 'signin'); setErr(''); setOk(''); }}
          style={linkBtnStyle}
        >
          {mode === 'signin' ? 'Forgot password?' : '← Back to sign in'}
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
const okStyle: CSSProperties = { color: '#0B5B3A', fontSize: 12, marginTop: 8 };
const btnStyle: CSSProperties = {
  width: '100%', marginTop: 14, padding: '10px', borderRadius: 6, border: 'none',
  background: '#084838', color: '#FFFFFF', fontWeight: 600, cursor: 'pointer',
  fontSize: 13, letterSpacing: '0.06em', textTransform: 'uppercase',
};
const linkBtnStyle: CSSProperties = {
  display: 'block', width: '100%', marginTop: 8, padding: '6px',
  background: 'transparent', border: 'none', color: '#5A5A5A',
  fontSize: 11, letterSpacing: '0.04em', cursor: 'pointer', textAlign: 'center',
};
