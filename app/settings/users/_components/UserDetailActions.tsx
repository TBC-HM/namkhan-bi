// app/settings/users/_components/UserDetailActions.tsx
// PBS 2026-07-13: three actions on the user detail page.
//   • Resend invitation (POST /api/settings/users/invite)
//   • Deactivate (POST /api/settings/users/deactivate) — soft, native confirm()
//   • Delete (POST /api/settings/users/delete) — hard, DeleteUserModal
'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition, type CSSProperties } from 'react';
import DeleteUserModal from './DeleteUserModal';

interface Props { userId: string; email: string; }

export default function UserDetailActions({ userId, email }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [actionLink, setActionLink] = useState<string | null>(null);

  const resend = () => {
    startTransition(async () => {
      setMsg(null); setActionLink(null);
      const r = await fetch('/api/settings/users/invite', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const body = await r.json().catch(() => ({}));
      if (!r.ok) { setMsg(`✗ ${body.error ?? 'invite failed'}`); return; }
      setMsg(body.email_fired ? '✓ Invitation resent' : '✓ Link generated (copy fallback below)');
      if (body.action_link) setActionLink(body.action_link);
    });
  };

  const deactivate = () => {
    if (!confirm(`Deactivate ${email}?\n\nThey lose access immediately but data is preserved. You can re-grant later.`)) return;
    startTransition(async () => {
      setMsg(null);
      const r = await fetch('/api/settings/users/deactivate', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: userId }),
      });
      const body = await r.json().catch(() => ({}));
      if (!r.ok) { setMsg(`✗ ${body.error ?? 'deactivate failed'}`); return; }
      setMsg('✓ Deactivated');
      setTimeout(() => router.push('/settings/users'), 900);
    });
  };

  return (
    <div style={{ padding: 4, display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <button type="button" onClick={resend} disabled={pending} style={btnPrimary}>
          Resend invitation
        </button>
        <button type="button" onClick={deactivate} disabled={pending} style={btnAmber}>
          Deactivate
        </button>
        <button type="button" onClick={() => setDeleting(true)} disabled={pending} style={btnRed}>
          Delete permanently
        </button>
      </div>
      {msg && (
        <div style={{ fontSize: 11, color: msg.startsWith('✓') ? '#0E7A4B' : '#B03826', fontWeight: 600 }}>
          {msg}
        </div>
      )}
      {actionLink && (
        <div style={{ padding: 10, background: '#F5F0E1', border: '1px solid #E6DFCC', borderRadius: 6, fontSize: 11, color: '#1B1B1B', wordBreak: 'break-all' }}>
          <div style={{ fontSize: 10, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#5A5A5A', fontWeight: 700, marginBottom: 4 }}>
            Fallback link (copy)
          </div>
          {actionLink}
        </div>
      )}
      {deleting && (
        <DeleteUserModal
          userId={userId}
          email={email}
          onClose={() => setDeleting(false)}
          onDeleted={() => { setDeleting(false); router.push('/settings/users'); }}
        />
      )}
    </div>
  );
}

const btnPrimary: CSSProperties = {
  padding: '6px 14px', borderRadius: 4, border: '1px solid #084838',
  background: '#084838', color: '#FFFFFF', fontSize: 11,
  letterSpacing: '0.06em', textTransform: 'uppercase', fontWeight: 700, cursor: 'pointer',
};
const btnAmber: CSSProperties = {
  padding: '6px 14px', borderRadius: 999, border: '1px solid #B48A3A',
  background: '#FFFFFF', color: '#B48A3A', fontSize: 11,
  letterSpacing: '0.06em', textTransform: 'uppercase', fontWeight: 700, cursor: 'pointer',
};
const btnRed: CSSProperties = {
  padding: '6px 14px', borderRadius: 999, border: '1px solid #B03826',
  background: '#B03826', color: '#FFFFFF', fontSize: 11,
  letterSpacing: '0.06em', textTransform: 'uppercase', fontWeight: 700, cursor: 'pointer',
};
