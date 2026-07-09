// app/settings/users/_components/UsersMatrix.tsx
// PBS 2026-07-09: matrix UI for property/holding access. Each row is a user.
// Columns: Namkhan (260955) · Donna (1000001) · Holding.
// Send invitation button per row triggers a password-reset email.
'use client';

import { useState, useTransition, type CSSProperties } from 'react';

const NAMKHAN_PID = 260955;
const DONNA_PID   = 1000001;

export interface UserRow {
  id: string;
  email: string;
  last_sign_in_at: string | null;
  created_at: string;
  holding_role: string | null;
  property_grants: Array<{ property_id: number; role: string; status: string }>;
}

export default function UsersMatrix({ initial }: { initial: UserRow[] }) {
  const [rows, setRows] = useState<UserRow[]>(initial);
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);

  function hasProp(row: UserRow, pid: number): boolean {
    return row.property_grants.some((g) => g.property_id === pid && g.status !== 'inactive');
  }

  async function togglePropertyGrant(user: UserRow, propertyId: number, on: boolean) {
    startTransition(async () => {
      setMsg(null);
      const r = await fetch('/api/settings/users/grant-property', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: user.id, email: user.email, property_id: propertyId, active: on }),
      });
      if (!r.ok) { setMsg(`✗ ${(await r.json()).error ?? 'failed'}`); return; }
      // Update local state
      setRows((prev) => prev.map((x) => {
        if (x.id !== user.id) return x;
        const others = x.property_grants.filter((g) => g.property_id !== propertyId);
        if (on) {
          return { ...x, property_grants: [...others, { property_id: propertyId, role: 'staff', status: 'active' }] };
        }
        return { ...x, property_grants: others };
      }));
      setMsg('✓ saved');
      setTimeout(() => setMsg(null), 1500);
    });
  }

  async function toggleHolding(user: UserRow, on: boolean) {
    startTransition(async () => {
      setMsg(null);
      const r = await fetch('/api/settings/users/grant-holding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: user.id, email: user.email, active: on }),
      });
      if (!r.ok) { setMsg(`✗ ${(await r.json()).error ?? 'failed'}`); return; }
      setRows((prev) => prev.map((x) => x.id === user.id ? { ...x, holding_role: on ? 'holding_admin' : null } : x));
      setMsg('✓ saved');
      setTimeout(() => setMsg(null), 1500);
    });
  }

  async function sendInvite(user: UserRow) {
    startTransition(async () => {
      setMsg(null);
      const r = await fetch('/api/settings/users/invite', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: user.email }),
      });
      if (!r.ok) { setMsg(`✗ ${(await r.json()).error ?? 'invite failed'}`); return; }
      setMsg(`✓ invitation sent to ${user.email}`);
      setTimeout(() => setMsg(null), 3000);
    });
  }

  return (
    <div style={{ padding: 4 }}>
      <table style={tableStyle}>
        <thead>
          <tr>
            <th style={thStyle}>Email</th>
            <th style={thStyleCenter}>Namkhan</th>
            <th style={thStyleCenter}>Donna</th>
            <th style={thStyleCenter}>Holding</th>
            <th style={thStyleCenter}>Last sign in</th>
            <th style={thStyleCenter}>Actions</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((u) => (
            <tr key={u.id}>
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
                <input type="checkbox" checked={!!u.holding_role}
                       onChange={(e) => toggleHolding(u, e.target.checked)}
                       disabled={pending} />
              </td>
              <td style={{ ...tdCenterStyle, fontSize: 10, color: '#5A5A5A' }}>
                {u.last_sign_in_at ? new Date(u.last_sign_in_at).toLocaleDateString('en-GB') : '—'}
              </td>
              <td style={tdCenterStyle}>
                <button type="button" onClick={() => sendInvite(u)} disabled={pending} style={btnStyle}>
                  Send invitation
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {msg && <div style={{ fontSize: 11, color: msg.startsWith('✓') ? '#0B5B3A' : '#B04A2F', marginTop: 8 }}>{msg}</div>}
    </div>
  );
}

const tableStyle: CSSProperties = { width: '100%', borderCollapse: 'collapse', fontSize: 12 };
const thStyle: CSSProperties = {
  textAlign: 'left', padding: '8px 6px', borderBottom: '1px solid #E6DFCC',
  fontSize: 10, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#5A5A5A', fontWeight: 600,
};
const thStyleCenter: CSSProperties = { ...thStyle, textAlign: 'center' };
const tdStyle: CSSProperties = { padding: '6px', borderBottom: '1px solid #F5F0E1' };
const tdCenterStyle: CSSProperties = { ...tdStyle, textAlign: 'center' };
const btnStyle: CSSProperties = {
  padding: '4px 10px', borderRadius: 4, border: '1px solid #E6DFCC',
  background: '#FFFFFF', color: '#084838', fontSize: 10,
  letterSpacing: '0.06em', textTransform: 'uppercase', fontWeight: 600, cursor: 'pointer',
};
