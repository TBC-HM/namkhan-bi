// app/login/page.tsx
// ADR-112 · Supabase Auth email/password login.
// PBS 2026-07-09: Sign in · Forgot password · Request access.
// PBS 2026-07-14: reads ?reason=idle to show a muted "signed out after 60 min
// of inactivity" line above the form when the middleware idle-timeout kicks
// the user back here.
// PBS 2026-07-14: post-signIn calls /api/auth/post-login to resolve the
// per-user landing_page override (tenancy.holding_users.landing_page).
// Ladder = user override > owner default (/holding/ceo) > property default (/)
// > /login?err=no_access. Explicit ?next= wins over the ladder.
'use client';

import { useEffect, useState, type CSSProperties } from 'react';
import { createBrowserClient } from '@supabase/ssr';
import { useRouter } from 'next/navigation';

const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
);

type Mode = 'signin' | 'forgot' | 'request';

const IDLE_MINUTES = Number(process.env.NEXT_PUBLIC_IDLE_TIMEOUT_MINUTES ?? '60') || 60;

export default function LoginPage() {
  const router = useRouter();
  const [next, setNext] = useState<string | null>(null);
  const [mode, setMode] = useState<Mode>('signin');
  const [email, setEmail] = useState('');
  const [pw, setPw] = useState('');
  const [name, setName] = useState('');
  const [reason, setReason] = useState('');
  const [reasonMsg, setReasonMsg] = useState('');
  const [err, setErr] = useState('');
  const [ok, setOk] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    try {
      const p = new URLSearchParams(window.location.search);
      const n = p.get('next');
      if (n && n.startsWith('/') && !n.startsWith('//')) setNext(n);
      const r = p.get('reason');
      if (r === 'idle') {
        setReasonMsg('Signed out after ' + IDLE_MINUTES + ' min of inactivity.');
      }
    } catch { /* ignore */ }
  }, []);

  async function resolveRedirect(): Promise<string> {
    // Call /api/auth/post-login (server) to get per-user landing_page or fallback.
    try {
      const r = await fetch('/api/auth/post-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ next }),
      });
      const body = await r.json().catch(() => ({}));
      const dest = typeof body?.redirect_to === 'string' ? body.redirect_to : null;
      if (dest && dest.startsWith('/') && !dest.startsWith('//')) return dest;
    } catch { /* fall through */ }
    // Fallback: explicit ?next=, else /holding/ceo (safer than the legacy /).
    return next ?? '/holding/ceo';
  }

  async function signIn() {
    if (!email.trim() || !pw || busy) return;
    setBusy(true); setErr(''); setOk('');
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password: pw });
    if (error) { setBusy(false); setErr(error.message); return; }
    const dest = await resolveRedirect();
    setBusy(false);
    router.push(dest);
    router.refresh();
  }

  async function forgot() {
    if (!email.trim() || busy) return;
    setBusy(true); setErr(''); setOk('');
    const redirectTo = `${location.origin}/account/password`;
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
    ? 'Enter your email — we will send you a reset link.'
    : 'Not on the platform yet? Ask PBS for access.';
  const primaryLabel = busy
    ? (mode === 'signin' ? 'Signing in…' : mode === 'forgot' ? 'Sending…' : 'Requesting…')
    : (mode === 'signin' ? 'Sign in' : mode === 'forgot' ? 'Send reset link' : 'Send request');

  return (
    <div style={pageStyle}>
      <div style={cardStyle}>
        <div style={eyebrowStyle}>The Beyond Circle · Workspace</div>
        {reasonMsg && mode === 'signin' && (
          <div style={reasonStyle}>{reasonMsg}</div>
        )}
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
const reasonStyle: CSSProperties = {
  fontSize: 11, color: '#6B6B6B', marginBottom: 10, fontWeight: 500,
  padding: '6px 10px', background: '#F5F1E5',
  border: '1px solid #E6DFCC', borderRadius: 6,
};
const inputStyle: CSSProperties = {
  width: '100%', padding: '10px 12px', fontSize: 13,
  border: '1px solid #C8C0A6', borderRadius: 6,
  background: '#FFFFFF', color: '#1B1B1B',
  boxSizing: 'border-box',
};
const errStyle: CSSProperties = { color: '#B04A2F', fontSize: 12, marginTop: 8, fontWeight: 600 };
const okStyle: CSSProperties = { color: '#0B5B3A', fontSize: 12, marginTop: 8, fontWeight: 600 };
const btnStyle: CSSProperties = {
  width: '100%', marginTop: 14, padding: '10px', borderRadius: 6, border: 'none',
  background: '#084838', color: '#FFFFFF', fontWeight: 700, cursor: 'pointer',
  fontSize: 13, letterSpacing: '0.06em', textTransform: 'uppercase',
};
const linkBtnStyle: CSSProperties = {
  background: 'transparent', border: 'none', color: '#084838',
  fontSize: 11, letterSpacing: '0.04em', cursor: 'pointer', padding: '6px 4px',
  fontWeight: 600,
};
