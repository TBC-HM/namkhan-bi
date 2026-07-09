// app/settings/users/_components/UsersMatrix.tsx
// PBS 2026-07-09 v3: per-row Invite button now surfaces action_link fallback via
// InviteResultCard so PBS is never blocked by unconfigured Supabase SMTP.
'use client';

import { useState, useTransition, type CSSProperties } from 'react';
import EditUserModal from './EditUserModal';
import InviteResultCard from './InviteResultCard';

const NAMKHAN_PID = 260955;
const DONNA_PID   = 1000001;

export interface UserRow {
  id: string;
  email: string;
  full_name: string | null;
  last_sign_in_at: string | null;
  created_at: string;
  holding_role: string | null;
  property_grants: Array<{ property_id: number; role: string; status: string }>;
}

export default function UsersMatrix({ initial }: { initial: UserRow[] }) {
  const [rows, setRows] = useState<UserRow[]>(initial);
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const [editing, setEditing] = useState<UserRow | null>(null);
  const [inviteResult, setInviteResult] = useState<{ email: string; action_link: string | null; email_fired: boolean } | null>(null);

  const hasProp = (u: UserRow, pid: number) => u.property_grants.some((g) => g.property_id === pid && g.status === 'active');
  const isHoldingMember = (u: UserRow) => u.holding_role !== null && ['member','viewer','admin','owner'].includes(u.holding_role);
  const isAdmin = (u: UserRow) => u.holding_role === 'admin' || u.holding_role === 'owner';

  async function togglePropertyGrant(user: UserRow, propertyId: number, on: boolean) {
    startTransition(async () => {
      setMsg(null);
      const r = await fetch('/api/settings/users/grant-property', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: user.id, email: user.email, property_id: propertyId, active: on }),
      });
      if (!r.ok) { setMsg(`✗ ${(await r.json().catch(() => ({}))).error ?? 'failed'}`); return; }
      setRows((prev) => prev.map((x) => {
        if (x.id !== user.id) return x;
        const others = x.property_grants.filter((g) => g.property_id !== propertyId);
        if (on) return { ...x, property_grants: [...others, { property_id: propertyId, role: 'staff', status: 'active' }] };
        return { ...x, property_grants: others };
      }));
      flash('✓ saved');
    });
  }

  async function toggleHoldingRole(user: UserRow, role: 'member' | 'admin' | null) {
    startTransition(async () => {
      setMsg(null);
      const r = await fetch('/api/settings/users/grant-holding', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: user.id, email: user.email, active: role !== null, role }),
      });
      if (!r.ok) { setMsg(`✗ ${(await r.json().catch(() => ({}))).error ?? 'failed'}`); return; }
      setRows((prev) => prev.map((x) => x.id === user.id ? { ...x, holding_role: role } : x));
      flash('✓ saved');
    });
  }

  function onHoldingCheck(user: UserRow, on: boolean) {
    if (on) return toggleHoldingRole(user, isAdmin(user) ? 'admin' : 'member');
    return toggleHoldingRole(user, null);
  }
  function onAdminCheck(user: UserRow, on: boolean) {
    return toggleHoldingRole(user, on ? 'admin' : 'member');
  }

  async function sendInvite(user: UserRow) {
    startTransition(async () => {
      setMsg(null);
      setInviteResult(null);
      const r = await fetch('/api/settings/users/invite', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: user.email }),
      });
      const body = await r.json().catch(() => ({}));
      if (!r.ok) { setMsg(`✗ ${body.error ?? 'invite failed'}`); return; }
      setInviteResult({
        email: user.email,
        action_link: body.action_link ?? null,
        email_fired: !!body.email_fired,
      });
    });
  }

  function flash(text: string) { setMsg(text); setTimeout(() => setMsg(null), 1500); }

  return (
    <div style={{ padding: 4 }}>
      <table style={tableStyle}>
        <thead>
          <tr>
            <th style={thStyle}>Name</th>
            <th style={thStyle}>Email</th>
            <th style={thStyleCenter}>Namkhan</th>
            <th style={thStyleCenter}>Donna</th>
            <th style={thStyleCenter}>Holding</th>
            <th style={thStyleCenter}>Admin</th>
            <th style={thStyleCenter}>Last sign in</th>
            <th style={thStyleCenter}>Actions</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((u) => (
            <tr key={u.id}>
              <td style={tdStyle}>
                <div style={{ fontSize: 12, color: '#1B1B1B', fontWeight: 600 }}>{u.full_name ?? '—'}</div>
              </td>
              <td style={tdStyle}>
                <div style={{ fontSize: 12, color: '#1B1B1B' }}>{u.email}</div>
                <div style={{ fontSize: 9, color: '#5A5A5A' }}>{u.id.slice(0, 8)}…</div>
              </td>
              <td style={tdCenterStyle}>
                <input type="checkbox" checked={hasProp(u, NAMKHAN_PID)}
                       onChange={(e) => togglePropertyGrant(u, NAMKHAN_PID, e.target.checked)}
                       disabled={pending} />
              </td>
              <td style={tdCenterStyle}>
                <input type="checkbox" checked={hasProp(u, DONNA_PID)}
                       onChange={(e) => togglePropertyGrant(u, DONNA_PID, e.target.checked)}
                       disabled={pending} />
              </td>
              <td style={tdCenterStyle}>
                <input type="checkbox" checked={isHoldingMember(u)}
                       onChange={(e) => onHoldingCheck(u, e.target.checked)}
                       disabled={pending} />
              </td>
              <td style={tdCenterStyle}>
                <input type="checkbox" checked={isAdmin(u)}
                       onChange={(e) => onAdminCheck(u, e.target.checked)}
                       disabled={pending || !isHoldingMember(u)}
                       title={!isHoldingMember(u) ? 'Grant Holding first, then Admin' : 'Toggle admin (can manage users)'} />
              </td>
              <td style={{ ...tdCenterStyle, fontSize: 10, color: '#5A5A5A' }}>
                {u.last_sign_in_at ? new Date(u.last_sign_in_at).toLocaleDateString('en-GB') : '—'}
              </td>
              <td style={tdCenterStyle}>
                <div style={{ display: 'flex', gap: 4, justifyContent: 'center' }}>
                  <button type="button" onClick={() => setEditing(u)} disabled={pending} style={btnStyleSecondary}>
                    Edit
                  </button>
                  <button type="button" onClick={() => sendInvite(u)} disabled={pending} style={btnStyle}>
                    Invite
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {msg && <div style={{ fontSize: 11, color: msg.startsWith('✓') ? '#0B5B3A' : '#B04A2F', marginTop: 8 }}>{msg}</div>}
      {inviteResult && (
        <InviteResultCard
          email={inviteResult.email}
          actionLink={inviteResult.action_link}
          emailFired={inviteResult.email_fired}
          onDismiss={() => setInviteResult(null)}
        />
      )}
      <div style={{ fontSize: 10, color: '#5A5A5A', marginTop: 8 }}>
        <strong>Holding</strong> = cross-property access · view + create invoices, contracts, memos. <strong>Admin</strong> = holding + manage users on this page. Ticking Admin requires Holding first.
      </div>
      {editing && (
        <EditUserModal
          user={editing}
          onClose={() => setEditing(null)}
          onSaved={(patch) => {
            setRows((prev) => prev.map((x) => x.id === editing.id ? { ...x, ...patch } : x));
            setMsg('✓ user updated');
            setTimeout(() => setMsg(null), 2000);
          }}
          onArchived={(userId) => {
            setRows((prev) => prev.map((x) => x.id === userId
              ? { ...x, property_grants: [], holding_role: null }
              : x));
            setMsg('✓ user archived (grants revoked)');
            setTimeout(() => setMsg(null), 2500);
          }}
        />
      )}
    </div>
  );
}

const tableStyle: CSSProperties = { width: '100%', borderCollapse: 'collapse', fontSize: 12, color: '#1B1B1B' };
const thStyle: CSSProperties = {
  textAlign: 'left', padding: '8px 6px', borderBottom: '1px solid #E6DFCC',
  fontSize: 10, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#3A3A3A', fontWeight: 700,
};
const thStyleCenter: CSSProperties = { ...thStyle, textAlign: 'center' };
const tdStyle: CSSProperties = { padding: '6px', borderBottom: '1px solid #F5F0E1', color: '#1B1B1B' };
const tdCenterStyle: CSSProperties = { ...tdStyle, textAlign: 'center' };
const btnStyle: CSSProperties = {
  padding: '4px 10px', borderRadius: 4, border: '1px solid #084838',
  background: '#084838', color: '#FFFFFF', fontSize: 10,
  letterSpacing: '0.06em', textTransform: 'uppercase', fontWeight: 700, cursor: 'pointer',
};
const btnStyleSecondary: CSSProperties = {
  padding: '4px 10px', borderRadius: 4, border: '1px solid #C8C0A6',
  background: '#FFFFFF', color: '#084838', fontSize: 10,
  letterSpacing: '0.06em', textTransform: 'uppercase', fontWeight: 700, cursor: 'pointer',
};
