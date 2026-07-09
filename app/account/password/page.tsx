// app/account/password/page.tsx
// PBS 2026-07-09 v2: doubles as the account-activation page.
// When an invited user clicks their email link, Supabase redirects here with
// one of THREE URL shapes depending on the flow variant:
//
//   A) PKCE code:      /account/password?code=xxx
//   B) OTP token_hash: /account/password?token_hash=xxx&type=invite|recovery
//   C) Implicit hash:  /account/password#access_token=xxx&refresh_token=yyy
//
// This page silently handles all three, establishes a session, then shows
// the password form. Once the new password is set the operator is redirected
// to `/`.
'use client';

import { useEffect, useState, type CSSProperties } from 'react';
import { createBrowserClient } from '@supabase/ssr';
import { useRouter } from 'next/navigation';

const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
);

type Mode = 'loading' | 'change' | 'activate' | 'error';

export default function AccountPasswordPage() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>('loading');
  const [email, setEmail] = useState<string>('');
  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        // First check if user already has a session (came from top-right dropdown).
        const { data: { user: existing } } = await supabase.auth.getUser();
        if (existing) {
          setEmail(existing.email ?? '');
          setMode('change');
          return;
        }

        // No session — parse URL to see if this is an activation click.
        const urlHash = window.location.hash.startsWith('#') ? window.location.hash.slice(1) : window.location.hash;
        const hashParams = new URLSearchParams(urlHash);
        const q = new URLSearchParams(window.location.search);

        // C) implicit — access_token + refresh_token in the fragment
        const accessToken = hashParams.get('access_token');
        const refreshToken = hashParams.get('refresh_token');
        if (accessToken && refreshToken) {
          const { data, error } = await supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
          if (error) throw error;
          setEmail(data.user?.email ?? '');
          window.history.replaceState(null, '', window.location.pathname);
          setMode('activate');
          return;
        }

        // B) OTP token_hash + type
        const tokenHash = q.get('token_hash');
        const type = q.get('type');
        if (tokenHash && (type === 'invite' || type === 'recovery' || type === 'signup' || type === 'email_change' || type === 'magiclink')) {
          const { data, error } = await supabase.auth.verifyOtp({
            token_hash: tokenHash,
            type: type as 'invite' | 'recovery' | 'signup' | 'email_change' | 'magiclink',
          });
          if (error) throw error;
          setEmail(data.user?.email ?? '');
          window.history.replaceState(null, '', window.location.pathname);
          setMode(type === 'invite' || type === 'signup' ? 'activate' : 'change');
          return;
        }

        // A) PKCE code
        const code = q.get('code');
        if (code) {
          const { data, error } = await supabase.auth.exchangeCodeForSession(code);
          if (error) throw error;
          setEmail(data.user?.email ?? '');
          window.history.replaceState(null, '', window.location.pathname);
          setMode('activate');
          return;
        }

        // Nothing worked — bounce to login.
        router.replace('/login?next=/account/password');
      } catch (e) {
        setErr((e as Error).message);
        setMode('error');
      }
    })();
  }, [router]);

  async function save() {
    setErr(null); setMsg(null);
    if (pw.length < 8) { setErr('Password must be at least 8 characters.'); return; }
    if (pw !== pw2) { setErr('Passwords do not match.'); return; }
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password: pw });
    setBusy(false);
    if (error) { setErr(error.message); return; }
    setMsg('✓ password saved — redirecting…');
    setTimeout(() => { router.push('/'); router.refresh(); }, 900);
  }

  const isActivation = mode === 'activate';
  const title = mode === 'change' ? 'Change password' : mode === 'activate' ? 'Activate your account' : mode === 'error' ? 'Link problem' : 'Loading…';
  const hint = mode === 'change'
    ? 'Enter a new password (min 8 chars). Signed session required — you\'ll stay signed in.'
    : isActivation
    ? `Welcome${email ? `, ${email}` : ''}. Pick a password to activate your account. You'll be signed in right after.`
    : mode === 'error'
    ? 'The activation link is invalid or expired. Ask PBS to send a new invitation.'
    : 'One moment…';

  return (
    <div style={pageStyle}>
      <div style={cardStyle}>
        <div style={eyebrowStyle}>{isActivation ? 'Beyond Circle · Welcome' : 'Account · Beyond Circle'}</div>
        <h1 style={titleStyle}>{title}</h1>
        <p style={hintStyle}>{hint}</p>

        {(mode === 'change' || mode === 'activate') && (
          <>
            <label style={labelStyle}>{isActivation ? 'Choose a password' : 'New password'}</label>
            <input
              type="password" value={pw} onChange={(e) => setPw(e.target.value)}
              autoComplete="new-password" style={inputStyle}
              onKeyDown={(e) => { if (e.key === 'Enter') save(); }}
            />
            <label style={{ ...labelStyle, marginTop: 12 }}>Confirm password</label>
            <input
              type="password" value={pw2} onChange={(e) => setPw2(e.target.value)}
              autoComplete="new-password" style={inputStyle}
              onKeyDown={(e) => { if (e.key === 'Enter') save(); }}
            />

            {err && <div style={errStyle}>{err}</div>}
            {msg && <div style={okStyle}>{msg}</div>}

            <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
              <button type="button" onClick={save} disabled={busy || !pw || !pw2} style={btnStyle}>
                {busy ? 'Saving…' : (isActivation ? 'Activate account' : 'Update password')}
              </button>
              {!isActivation && <a href="/" style={cancelStyle}>Cancel</a>}
            </div>
          </>
        )}

        {mode === 'error' && (
          <div>
            {err && <div style={errStyle}>{err}</div>}
            <a href="/login" style={{ display: 'inline-block', marginTop: 16, color: '#084838', fontWeight: 700 }}>← Back to sign in</a>
          </div>
        )}
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
  background: '#FFFFFF', border: '1px solid #C8C0A6',
  boxShadow: '0 10px 32px rgba(0,0,0,.10)',
  color: '#1B1B1B',
};
const eyebrowStyle: CSSProperties = {
  fontSize: 11, letterSpacing: '0.14em', textTransform: 'uppercase',
  color: '#084838', marginBottom: 8, fontWeight: 700,
};
const titleStyle: CSSProperties = { margin: '0 0 6px', fontSize: 22, color: '#084838', fontWeight: 700 };
const hintStyle: CSSProperties = { color: '#3A3A3A', fontSize: 12, marginBottom: 18, fontWeight: 500 };
const labelStyle: CSSProperties = {
  fontSize: 10, letterSpacing: '0.06em', textTransform: 'uppercase',
  color: '#3A3A3A', fontWeight: 700, display: 'block', marginBottom: 4,
};
const inputStyle: CSSProperties = {
  width: '100%', padding: '10px 12px', fontSize: 13,
  border: '1px solid #C8C0A6', borderRadius: 6, background: '#FFFFFF', color: '#1B1B1B',
  boxSizing: 'border-box',
};
const errStyle: CSSProperties = { color: '#B04A2F', fontSize: 12, marginTop: 10, fontWeight: 600 };
const okStyle: CSSProperties = { color: '#0B5B3A', fontSize: 12, marginTop: 10, fontWeight: 600 };
const btnStyle: CSSProperties = {
  flex: 1, padding: '10px', borderRadius: 6, border: 'none',
  background: '#084838', color: '#FFFFFF', fontWeight: 700, cursor: 'pointer',
  fontSize: 13, letterSpacing: '0.06em', textTransform: 'uppercase',
};
const cancelStyle: CSSProperties = {
  padding: '10px 14px', borderRadius: 6, border: '1px solid #C8C0A6',
  color: '#1B1B1B', textDecoration: 'none', fontWeight: 700, fontSize: 12,
  display: 'flex', alignItems: 'center',
};
