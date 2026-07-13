// app/settings/users/_components/DeleteUserModal.tsx
// PBS 2026-07-13: strong-confirm modal for the HARD delete action. The user
// must type the target email exactly (case-insensitive) before the red Delete
// button enables. Backend: POST /api/settings/users/delete { user_id, confirm_email }.
'use client';

import { useEffect, useState, useTransition, type CSSProperties } from 'react';

interface Props {
  userId: string;
  email: string;
  onClose: () => void;
  onDeleted: (userId: string) => void;
}

export default function DeleteUserModal({ userId, email, onClose, onDeleted }: Props) {
  const [confirm, setConfirm] = useState('');
  const [pending, startTransition] = useTransition();
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const canDelete = confirm.trim().toLowerCase() === email.trim().toLowerCase() && !pending;

  const doDelete = () => {
    if (!canDelete) return;
    startTransition(async () => {
      setErr(null);
      const r = await fetch('/api/settings/users/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: userId, confirm_email: confirm.trim() }),
      });
      const body = await r.json().catch(() => ({}));
      if (!r.ok) { setErr(body.error ?? `delete failed (${r.status})`); return; }
      onDeleted(userId);
      onClose();
    });
  };

  return (
    <div style={overlayStyle} onClick={onClose}>
      <div style={modalStyle} onClick={(e) => e.stopPropagation()}>
        <div style={headerStyle}>
          <div style={eyebrowStyle}>Permanently delete user</div>
          <button type="button" onClick={onClose} style={closeBtnStyle} aria-label="Close">×</button>
        </div>

        <p style={warnStyle}>
          This will <strong>destroy the auth account</strong> for <strong>{email}</strong>, revoke all Namkhan / Donna / Holding grants, and cannot be undone.
        </p>
        <p style={hintStyle}>
          To confirm, type the user{'’'}s email address below.
        </p>

        <label style={labelStyle}>User email</label>
        <input
          type="email"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          style={inputStyle}
          placeholder={email}
          autoFocus
        />

        {err && <div style={errStyle}>{err}</div>}

        <div style={footerStyle}>
          <button type="button" onClick={onClose} disabled={pending} style={cancelBtnStyle}>Cancel</button>
          <button type="button" onClick={doDelete} disabled={!canDelete} style={{ ...deleteBtnStyle, opacity: canDelete ? 1 : 0.4, cursor: canDelete ? 'pointer' : 'not-allowed' }}>
            {pending ? 'Deleting…' : 'Delete permanently'}
          </button>
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
  width: 460, padding: 24, borderRadius: 10, background: '#FFFFFF',
  border: '1px solid #E6DFCC', boxShadow: '0 20px 48px rgba(0,0,0,.18)', color: '#1B1B1B',
};
const headerStyle: CSSProperties = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 };
const eyebrowStyle: CSSProperties = {
  fontSize: 11, letterSpacing: '0.14em', textTransform: 'uppercase', color: '#B03826', fontWeight: 700,
};
const closeBtnStyle: CSSProperties = {
  background: 'transparent', border: 'none', fontSize: 22, color: '#5A5A5A', cursor: 'pointer', lineHeight: 1,
};
const warnStyle: CSSProperties = { fontSize: 13, color: '#1B1B1B', lineHeight: 1.4, margin: 0 };
const hintStyle: CSSProperties = { fontSize: 12, color: '#5A5A5A', marginTop: 12, marginBottom: 6 };
const labelStyle: CSSProperties = {
  display: 'block', fontSize: 10, letterSpacing: '0.06em', textTransform: 'uppercase',
  color: '#5A5A5A', fontWeight: 700, marginBottom: 4,
};
const inputStyle: CSSProperties = {
  width: '100%', padding: '9px 11px', fontSize: 13,
  border: '1px solid #E6DFCC', borderRadius: 6, background: '#FFFFFF', color: '#1B1B1B', boxSizing: 'border-box',
};
const errStyle: CSSProperties = { color: '#B03826', fontSize: 12, marginTop: 8, fontWeight: 600 };
const footerStyle: CSSProperties = { display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 };
const cancelBtnStyle: CSSProperties = {
  padding: '8px 16px', borderRadius: 6, border: '1px solid #E6DFCC',
  background: '#FFFFFF', color: '#1B1B1B', fontSize: 12,
  letterSpacing: '0.06em', textTransform: 'uppercase', fontWeight: 700, cursor: 'pointer',
};
const deleteBtnStyle: CSSProperties = {
  padding: '8px 16px', borderRadius: 6, border: '1px solid #B03826',
  background: '#B03826', color: '#FFFFFF', fontSize: 12,
  letterSpacing: '0.06em', textTransform: 'uppercase', fontWeight: 700,
};
