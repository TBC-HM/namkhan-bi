// app/login/page.tsx
// ADR-112 · Supabase Auth email/password login.
// PBS 2026-07-09: Sign in · Forgot password · Request access.
// v3: swapped useSearchParams (which requires a Suspense boundary and was
// leaking Next.js's "404: This page could not be found" fallback into the SSR
// output) for a client-only window.location.search read in useEffect.
'use client';

import { useEffect, useState, type CSSProperties } from 'react';
import { createBrowserClient } from '@supabase/ssr';
import { useRouter } from 'next/navigation';

const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
);

type Mode = 'signin' | 'forgot' | 'request';

export default function LoginPage() {
  const router = useRouter();
  const [next, setNext] = useState('/');
  const [mode, setMode] = useState<Mode>('signin');
  const [email, setEmail] = useState('');
  const [pw, setPw] = useState('');
  const [name, setName] = useState('');
  const [reason, setReason] = useState('');
  const [err, setErr] = useState('');
  const [ok, setOk] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    // Client-only: read ?next=… without pulling in useSearchParams (which
    // requires a Suspense boundary and would otherwise leak the 404 fallback).
    try {
      const p = new URLSearchParams(window.location.search);
      const n = p.get('next');
      if (n && n.startsWith('/')) setNext(n);
    } catch { /* ignore */ }
  }, []);

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

  async function requestAccess() {
    if (!email.trim() || !name.trim() || busy) return;
    setBusy(true); setErr(''); setOk('');
    try {
      const r = await fetch('/api/auth/request-access', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), name: name.trim(), reason: reason.trim() }),
      });
      const body = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(body.error ?? `request failed (${r.status})`);
      setOk(`Request sent. PBS will review and email you when it's approved.`);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const submit = mode === 'signin' ? signIn : mode === 'forgot' ? forgot : requestAccess;
  const titleText = mode === 'signin' ? 'Sign in' : mode === 'forgot' ? 'Reset password' : 'Request access';
  const hintText = mode === 'signin'
    ? 'Enter your email and password.'
    : mode === 'forgot'
    ? 'Enter your email — we\'ll send you a reset link.'
    : 'Not on the platform yet? Ask PBS for access.';
  const primaryLabel = busy
    ? (mode === 'signin' ? 'Signing in…' : mode === 'forgot' ? 'Sending…' : 'Requesting…')
    : (mode === 'signin' ? 'Sign in' : mode === 'forgot' ? 'Send reset link' : 'Send request');

  return (
    <div style={pageStyle}>
      <div style={cardStyle}>
        <div style={eyebrowStyle}>The Beyond Circle · Workspace</div>
        <h1 style={titleStyle}>{titleText}</h1>
        <p style={hintStyle}>{hintText}</p>

        {mode === 'request' && (
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="your name"
            autoComplete="name"
            style={{ ...inputStyle, marginBottom: 8 }}
            onKeyDown={(e) => { if (e.key === 'Enter') submit(); }}
          />
        )}
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
        {mode === 'request' && (
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="why you need access (optional)"
            rows={3}
            style={{ ...inputStyle, marginTop: 8, resize: 'vertical', fontFamily: 'inherit' }}
          />
        )}

        {err && <div style={errStyle}>{err}</div>}
        {ok && <div style={okStyle}>{ok}</div>}

        <button type="button" onClick={submit} disabled={busy} style={btnStyle}>
          {primaryLabel}
        </button>

        {/* Secondary navigation between the 3 modes. */}
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8 }}>
          {mode === 'signin' ? (
            <>
              <button type="button" onClick={() => { setMode('forgot'); setErr(''); setOk(''); }} style={linkBtnStyle}>
                Forgot password?
              </button>
              <button type="button" onClick={() => { setMode('request'); setErr(''); setOk(''); }} style={linkBtnStyle}>
                Request access
              </button>
            </>
          ) : (
            <button type="button" onClick={() => { setMode('signin'); setErr(''); setOk(''); }} style={{ ...linkBtnStyle, width: '100%', textAlign: 'center' }}>
              ← Back to sign in
            </button>
          )}
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
  background: 'transparent', border: 'none', color: '#5A5A5A',
  fontSize: 11, letterSpacing: '0.04em', cursor: 'pointer', padding: '6px 4px',
};
