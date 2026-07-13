// app/settings/users/_components/UsersMatrix.tsx
// PBS 2026-07-13 v4:
//   • Row NAME is now a link to /settings/users/[user_id] (detail page).
//   • New "Invitation" column between Email and Last sign-in:
//       - invited_at + !last_sign_in_at → amber "Invited <relative>"
//       - invited_at + last_sign_in_at  → subtle "✓ Accepted"
//       - !invited_at                    → "—"
//   • Last sign-in now uses relative time (2h ago / 3d ago) + absolute UTC tooltip.
//   • New Deactivate button (soft, RPC-based) + Delete button (hard, email-confirm modal).
//   • Buttons follow design tokens: amber (#B48A3A) for Deactivate, red (#B03826) for Delete.
// PBS 2026-07-09 v3: per-row Invite button surfaces action_link fallback.
'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition, type CSSProperties } from 'react';
import EditUserModal from './EditUserModal';
import InviteResultCard from './InviteResultCard';
import DeleteUserModal from './DeleteUserModal';
import TenantLink from '@/components/nav/TenantLink';

const NAMKHAN_PID = 260955;
const DONNA_PID   = 1000001;

export interface UserRow {
  id: string;
  email: string;
  full_name: string | null;
  last_sign_in_at: string | null;
  created_at: string;
  invited_at: string | null;
  holding_role: string | null;
  property_grants: Array<{ property_id: number; role: string; status: string }>;
}

// -----------------------------------------------------------------------------
// Relative time — small, dependency-free. Falls back to "—" for null input.
// -----------------------------------------------------------------------------
function relativeTime(iso: string | null): string {
  if (!iso) return '—';
  const then = new Date(iso).getTime();
  if (!isFinite(then)) return '—';
  const diffMs = Date.now() - then;
  const sec = Math.round(diffMs / 1000);
  if (sec < 60) return `${sec}s ago`;
  const min = Math.round(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const d = Math.round(hr / 24);
  if (d < 30) return `${d}d ago`;
  const mo = Math.round(d / 30);
  if (mo < 12) return `${mo}mo ago`;
  const y = Math.round(mo / 12);
  return `${y}y ago`;
}

function absoluteUTC(iso: string | null): string {
  if (!iso) return '';
  try { return new Date(iso).toISOString().replace('T', ' ').replace(/\.\d+Z$/, ' UTC'); } catch { return iso; }
}

export default function UsersMatrix({ initial }: { initial: UserRow[] }) {
  const router = useRouter();
  const [rows, setRows] = useState<UserRow[]>(initial);
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const [editing, setEditing] = useState<UserRow | null>(null);
  const [deleting, setDeleting] = useState<UserRow | null>(null);
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

  async function deactivate(user: UserRow) {
    if (!confirm(`Deactivate ${user.email}?\n\nThey lose access immediately but their auth account + historical data are preserved. You can re-grant later.`)) return;
    startTransition(async () => {
      setMsg(null);
      const r = await fetch('/api/settings/users/deactivate', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: user.id }),
      });
      const body = await r.json().catch(() => ({}));
      if (!r.ok) { setMsg(`✗ ${body.error ?? 'deactivate failed'}`); return; }
      setRows((prev) => prev.map((x) => x.id === user.id
        ? { ...x, property_grants: [], holding_role: null }
        : x));
      flash('✓ Deactivated', 2000);
      router.refresh();
    });
  }

  function flash(text: string, ms = 1500) { setMsg(text); setTimeout(() => setMsg(null), ms); }

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
            <th style={thStyleCenter}>Invitation</th>
            <th style={thStyleCenter}>Last sign in</th>
            <th style={thStyleCenter}>Actions</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((u) => {
            const invPill = renderInvitationPill(u);
            const lastRel = relativeTime(u.last_sign_in_at);
            const lastAbs = absoluteUTC(u.last_sign_in_at);
            return (
              <tr key={u.id}>
                <td style={tdStyle}>
                  <TenantLink
                    href={`/settings/users/${u.id}`}
                    style={{ fontSize: 12, color: '#084838', fontWeight: 600, textDecoration: 'none', borderBottom: '1px dotted #084838' }}
                    title="Open user details"
                  >
                    {u.full_name ?? u.email.split('@')[0] ?? '—'}
                  </TenantLink>
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
                <td style={tdCenterStyle}>{invPill}</td>
                <td style={{ ...tdCenterStyle, fontSize: 10, color: '#5A5A5A' }} title={lastAbs}>
                  {lastRel}
                </td>
                <td style={tdCenterStyle}>
                  <div style={{ display: 'flex', gap: 4, justifyContent: 'center', flexWrap: 'wrap' }}>
                    <button type="button" onClick={() => setEditing(u)} disabled={pending} style={btnStyleSecondary}>
                      Edit
                    </button>
                    <button type="button" onClick={() => sendInvite(u)} disabled={pending} style={btnStyle}>
                      Invite
                    </button>
                    <button type="button" onClick={() => deactivate(u)} disabled={pending} style={btnStyleAmber}>
                      Deactivate
                    </button>
                    <button type="button" onClick={() => setDeleting(u)} disabled={pending} style={btnStyleRed}>
                      Delete
                    </button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {msg && <div style={{ fontSize: 11, color: msg.startsWith('✓') ? '#0E7A4B' : '#B03826', marginTop: 8 }}>{msg}</div>}
      {inviteResult && (
        <InviteResultCard
          email={inviteResult.email}
          actionLink={inviteResult.action_link}
          emailFired={inviteResult.email_fired}
          onDismiss={() => setInviteResult(null)}
        />
      )}
      <div style={{ fontSize: 10, color: '#5A5A5A', marginTop: 8 }}>
        <strong>Holding</strong> = cross-property access · view + create invoices, contracts, memos. <strong>Admin</strong> = holding + manage users on this page. Ticking Admin requires Holding first. <strong>Deactivate</strong> = soft (auth account preserved). <strong>Delete</strong> = hard (auth account destroyed).
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
      {deleting && (
        <DeleteUserModal
          userId={deleting.id}
          email={deleting.email}
          onClose={() => setDeleting(null)}
          onDeleted={(userId) => {
            setRows((prev) => prev.filter((x) => x.id !== userId));
            setMsg('✓ Deleted');
            setTimeout(() => setMsg(null), 2000);
            router.refresh();
          }}
        />
      )}
    </div>
  );
}

// -----------------------------------------------------------------------------
// Invitation pill — amber "Invited <rel>" / subtle "Accepted" / em-dash.
// -----------------------------------------------------------------------------
function renderInvitationPill(u: UserRow) {
  if (!u.invited_at) {
    return <span style={{ fontSize: 10, color: '#5A5A5A' }}>—</span>;
  }
  if (u.last_sign_in_at) {
    return (
      <span
        style={{ fontSize: 10, color: '#0E7A4B', fontWeight: 600 }}
        title={`Invited ${absoluteUTC(u.invited_at)}\nAccepted ${absoluteUTC(u.last_sign_in_at)}`}
      >
        ✓ Accepted
      </span>
    );
  }
  return (
    <span
      style={{
        display: 'inline-block',
        padding: '2px 8px',
        borderRadius: 999,
        background: '#FFFFFF',
        border: '1px solid #B48A3A',
        color: '#B48A3A',
        fontSize: 10,
        fontWeight: 700,
        letterSpacing: '0.04em',
      }}
      title={`Invited ${absoluteUTC(u.invited_at)}`}
    >
      Invited {relativeTime(u.invited_at)}
    </span>
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
  padding: '4px 10px', borderRadius: 4, border: '1px solid #E6DFCC',
  background: '#FFFFFF', color: '#084838', fontSize: 10,
  letterSpacing: '0.06em', textTransform: 'uppercase', fontWeight: 700, cursor: 'pointer',
};
const btnStyleAmber: CSSProperties = {
  padding: '4px 10px', borderRadius: 999, border: '1px solid #B48A3A',
  background: '#FFFFFF', color: '#B48A3A', fontSize: 10,
  letterSpacing: '0.06em', textTransform: 'uppercase', fontWeight: 700, cursor: 'pointer',
};
const btnStyleRed: CSSProperties = {
  padding: '4px 10px', borderRadius: 999, border: '1px solid #B03826',
  background: '#B03826', color: '#FFFFFF', fontSize: 10,
  letterSpacing: '0.06em', textTransform: 'uppercase', fontWeight: 700, cursor: 'pointer',
};
