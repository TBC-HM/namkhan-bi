// app/settings/users/_components/EditUserModal.tsx
// PBS 2026-07-09: modal for editing name / email / archiving a user.
// Backend: /api/settings/users/update
// PBS 2026-07-14: adds "Landing page" text input — per-user post-login
// redirect. Empty = default fallback. Absolute paths only.
'use client';

import { useEffect, useState, useTransition, type CSSProperties } from 'react';
import type { UserRow } from './UsersMatrix';

interface Props {
  user: UserRow;
  onClose: () => void;
  onSaved: (patch: Partial<UserRow>) => void;
  onArchived: (userId: string) => void;
}

export default function EditUserModal({ user, onClose, onSaved, onArchived }: Props) {
  const [name, setName] = useState<string>(user.full_name ?? '');
  const [email, setEmail] = useState<string>(user.email);
  const [landingPage, setLandingPage] = useState<string>(user.landing_page ?? '');
  const [pending, startTransition] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const save = () => {
    if (!email.trim()) { setErr('Email required'); return; }
    // Client-side landing-page validation matching the server route.
    const lpRaw = landingPage.trim();
    if (lpRaw !== '' && (!lpRaw.startsWith('/') || lpRaw.startsWith('//'))) {
      setErr('Landing page must be an absolute path starting with / (e.g. /holding/ceo).');
      return;
    }
    startTransition(async () => {
      setErr(null); setMsg(null);
      const r = await fetch('/api/settings/users/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: user.id,
          name: name.trim(),
          email: email.trim(),
          // Send even when empty ('' → server clears the column). Sending
          // undefined would leave the current value untouched.
          landing_page: lpRaw,
        }),
      });
      const body = await r.json().catch(() => ({}));
      if (!r.ok) { setErr(body.error ?? `save failed (${r.status})`); return; }
      onSaved({
        full_name: name.trim(),
        email: email.trim(),
        landing_page: lpRaw === '' ? null : lpRaw,
      });
      setMsg('✓ saved');
      setTimeout(() => { onClose(); }, 900);
    });
  };

  const archive = () => {
    if (!confirm(`Archive ${user.email}? All property + holding grants will be revoked. The auth account stays so you can re-activate later.`)) return;
    startTransition(async () => {
      setErr(null); setMsg(null);
      const r = await fetch('/api/settings/users/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: user.id, archive: true }),
      });
      const body = await r.json().catch(() => ({}));
      if (!r.ok) { setErr(body.error ?? `archive failed (${r.status})`); return; }
      onArchived(user.id);
      onClose();
    });
  };

  return (
    <div style={overlayStyle} onClick={onClose}>
      <div style={modalStyle} onClick={(e) => e.stopPropagation()}>
        <div style={headerStyle}>
          <div style={eyebrowStyle}>Edit user</div>
          <button type="button" onClick={onClose} style={closeBtnStyle} aria-label="Close">×</button>
        </div>

        <label style={labelStyle}>Full name</label>
        <input value={name} onChange={(e) => setName(e.target.value)} style={inputStyle} placeholder="e.g. Rom Jones" />

        <label style={{ ...labelStyle, marginTop: 10 }}>Email</label>
        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} style={inputStyle} />
        <div style={hintStyle}>
          Changing email updates the auth login + tenancy rows. Send a fresh invitation after if the address changed.
        </div>

        <label style={{ ...labelStyle, marginTop: 12 }}>Landing page (default: /dashboard)</label>
        <input
          type="text"
          value={landingPage}
          onChange={(e) => setLandingPage(e.target.value)}
          style={inputStyle}
          placeholder="/holding/ceo"
          autoComplete="off"
          spellCheck={false}
        />
        <div style={hintStyle}>
          Where the user lands after logging in. Leave blank for the default (owners → /holding/ceo, others → their property home).
        </div>

        {err && <div style={errStyle}>{err}</div>}
        {msg && <div style={okStyle}>{msg}</div>}

        <div style={footerStyle}>
          <button type="button" onClick={archive} disabled={pending} style={archiveBtnStyle}>
            Archive user
          </button>
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="button" onClick={onClose} disabled={pending} style={cancelBtnStyle}>Cancel</button>
            <button type="button" onClick={save} disabled={pending} style={saveBtnStyle}>
              {pending ? 'Saving…' : 'Save'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

const overlayStyle: CSSProperties = {
  position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)',
  display: 'grid', placeItems: 'center', zIndex: 9999,
};
const modalStyle: CSSProperties = {
  width: 420, padding: 24, borderRadius: 10, background: '#FFFFFF',
  border: '1px solid #C8C0A6', boxShadow: '0 20px 48px rgba(0,0,0,.18)', color: '#1B1B1B',
};
const headerStyle: CSSProperties = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 };
const eyebrowStyle: CSSProperties = {
  fontSize: 11, letterSpacing: '0.14em', textTransform: 'uppercase', color: '#084838', fontWeight: 700,
};
const closeBtnStyle: CSSProperties = {
  background: 'transparent', border: 'none', fontSize: 22, color: '#5A5A5A', cursor: 'pointer', lineHeight: 1,
};
const labelStyle: CSSProperties = {
  display: 'block', fontSize: 10, letterSpacing: '0.06em', textTransform: 'uppercase',
  color: '#3A3A3A', fontWeight: 700, marginBottom: 4,
};
const inputStyle: CSSProperties = {
  width: '100%', padding: '9px 11px', fontSize: 13,
  border: '1px solid #C8C0A6', borderRadius: 6, background: '#FFFFFF', color: '#1B1B1B', boxSizing: 'border-box',
};
const hintStyle: CSSProperties = { fontSize: 11, color: '#5A5A5A', marginTop: 4 };
const errStyle: CSSProperties = { color: '#B04A2F', fontSize: 12, marginTop: 8, fontWeight: 600 };
const okStyle: CSSProperties = { color: '#0B5B3A', fontSize: 12, marginTop: 8, fontWeight: 600 };
const footerStyle: CSSProperties = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 16 };
const saveBtnStyle: CSSProperties = {
  padding: '8px 16px', borderRadius: 6, border: 'none',
  background: '#084838', color: '#FFFFFF', fontSize: 12,
  letterSpacing: '0.06em', textTransform: 'uppercase', fontWeight: 700, cursor: 'pointer',
};
const cancelBtnStyle: CSSProperties = {
  padding: '8px 16px', borderRadius: 6, border: '1px solid #C8C0A6',
  background: '#FFFFFF', color: '#1B1B1B', fontSize: 12,
  letterSpacing: '0.06em', textTransform: 'uppercase', fontWeight: 700, cursor: 'pointer',
};
const archiveBtnStyle: CSSProperties = {
  padding: '8px 14px', borderRadius: 6, border: '1px solid #B04A2F',
  background: '#FFFFFF', color: '#B04A2F', fontSize: 11,
  letterSpacing: '0.06em', textTransform: 'uppercase', fontWeight: 700, cursor: 'pointer',
};
