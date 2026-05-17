'use client';

// app/cockpit-v2/users/UsersView.tsx
// Read-mostly. Holding-only users can toggle active state and access flags
// via the existing /api/cockpit/users POST endpoint (owner-gated by cookie
// middleware). Invites are routed to /settings/users/new (existing form).
//
// Author: IT-team agent · 2026-05-13 · #58.

import { useMemo, useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { TOKENS, SERIF, MONO } from '../_components/tokens';
import type { V2WorkspaceUser } from '../_lib/data-port';

const DEPT_FLAGS: Array<{ key: keyof V2WorkspaceUser; label: string }> = [
  { key: 'access_revenue', label: 'Rev' },
  { key: 'access_sales', label: 'Sales' },
  { key: 'access_marketing', label: 'Mkt' },
  { key: 'access_operations', label: 'Ops' },
  { key: 'access_finance', label: 'Fin' },
];

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  return iso.slice(0, 10);
}

export function UsersView({ initialRows }: { initialRows: V2WorkspaceUser[] }) {
  const [rows, setRows] = useState<V2WorkspaceUser[]>(initialRows);
  const [, startTransition] = useTransition();
  const [busyEmail, setBusyEmail] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  async function reload() {
    const res = await fetch('/api/cockpit/users', { cache: 'no-store' });
    if (res.ok) {
      const j = await res.json();
      setRows((j.rows ?? []) as V2WorkspaceUser[]);
    }
  }

  async function patch(email: string, body: Record<string, unknown>) {
    setBusyEmail(email);
    setError(null);
    try {
      const res = await fetch('/api/cockpit/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'update', email, ...body }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        setError(`update failed: ${j.error ?? res.statusText}`);
        return;
      }
      await reload();
      startTransition(() => router.refresh());
    } finally {
      setBusyEmail(null);
    }
  }

  async function toggleActive(row: V2WorkspaceUser) {
    setBusyEmail(row.email);
    setError(null);
    try {
      const res = await fetch('/api/cockpit/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: row.active ? 'deactivate' : 'reactivate',
          email: row.email,
        }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        setError(`toggle failed: ${j.error ?? res.statusText}`);
        return;
      }
      await reload();
      startTransition(() => router.refresh());
    } finally {
      setBusyEmail(null);
    }
  }

  const counts = useMemo(() => {
    let owners = 0;
    let holding = 0;
    let active = 0;
    for (const r of rows) {
      if (r.is_owner) owners += 1;
      if (r.role_level === 'holding') holding += 1;
      if (r.active) active += 1;
    }
    return { owners, holding, active, total: rows.length };
  }, [rows]);

  return (
    <div style={{ color: TOKENS.ink, fontFamily: 'var(--sans)' }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'baseline',
          gap: 18,
          marginBottom: 14,
          flexWrap: 'wrap',
        }}
      >
        <h2 style={{ fontFamily: SERIF, fontSize: 22, margin: 0 }}>
          Workspace users
        </h2>
        <div style={{ fontFamily: MONO, fontSize: 11, color: TOKENS.text3 }}>
          {counts.total} total · {counts.active} active · {counts.holding} holding ·{' '}
          {counts.owners} owner
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 18, flexWrap: 'wrap' }}>
        <Link
          href="/settings/users/new"
          style={{
            padding: '6px 14px',
            background: TOKENS.brass,
            color: '#0a0a0a',
            fontFamily: MONO,
            fontSize: 11,
            letterSpacing: 0.5,
            textTransform: 'uppercase',
            fontWeight: 700,
            textDecoration: 'none',
            borderRadius: 2,
          }}
        >
          + Invite user
        </Link>
        <button
          type="button"
          onClick={reload}
          style={{
            padding: '6px 14px',
            background: 'transparent',
            border: `1px solid ${TOKENS.borderSoft}`,
            color: TOKENS.text2,
            fontFamily: MONO,
            fontSize: 11,
            letterSpacing: 0.5,
            textTransform: 'uppercase',
            cursor: 'pointer',
            borderRadius: 2,
          }}
        >
          Reload
        </button>
      </div>

      {error && (
        <div
          style={{
            padding: 12,
            marginBottom: 14,
            background: 'rgba(184,95,78,0.16)',
            border: `1px solid ${TOKENS.terracotta}`,
            color: TOKENS.terracotta,
            fontFamily: MONO,
            fontSize: 11,
            borderRadius: 2,
          }}
        >
          {error}
        </div>
      )}

      <div
        style={{
          border: `1px solid ${TOKENS.border}`,
          background: TOKENS.bgRaised,
          borderRadius: 2,
          overflow: 'auto',
        }}
      >
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <thead>
            <tr style={{ borderBottom: `1px solid ${TOKENS.border}` }}>
              <th style={th}>Email</th>
              <th style={th}>Name</th>
              <th style={th}>Role</th>
              <th style={th}>Properties</th>
              <th style={th}>Depts</th>
              {DEPT_FLAGS.map((d) => (
                <th key={d.key as string} style={thCenter}>
                  {d.label}
                </th>
              ))}
              <th style={thCenter}>Owner</th>
              <th style={thCenter}>Active</th>
              <th style={th}>Last login</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td
                  colSpan={11}
                  style={{
                    padding: 24,
                    textAlign: 'center',
                    color: TOKENS.text2,
                    fontSize: 13,
                  }}
                >
                  No workspace users found.
                </td>
              </tr>
            ) : (
              rows.map((r) => {
                const busy = busyEmail === r.email;
                return (
                  <tr
                    key={r.email}
                    style={{
                      borderBottom: `1px solid ${TOKENS.borderSoft}`,
                      opacity: r.active ? 1 : 0.45,
                    }}
                  >
                    <td style={td}>{r.email}</td>
                    <td style={td}>
                      {r.display_name ?? r.email.split('@')[0]}
                    </td>
                    <td style={{ ...td, fontFamily: MONO, color: TOKENS.text2 }}>
                      {r.role_level ?? '—'}
                    </td>
                    <td style={{ ...td, fontFamily: MONO, color: TOKENS.text2 }}>
                      {r.property_ids && r.property_ids.length > 0
                        ? r.property_ids.join(', ')
                        : '—'}
                    </td>
                    <td style={{ ...td, fontFamily: MONO, color: TOKENS.text2 }}>
                      {r.dept_ids && r.dept_ids.length > 0
                        ? r.dept_ids.join(', ')
                        : '—'}
                    </td>
                    {DEPT_FLAGS.map((d) => (
                      <td key={d.key as string} style={tdCenter}>
                        <input
                          type="checkbox"
                          checked={Boolean(r[d.key])}
                          disabled={busy || !!r.is_owner}
                          onChange={(e) =>
                            patch(r.email, { [d.key]: e.target.checked })
                          }
                          title={r.is_owner ? 'Owner has all access' : ''}
                        />
                      </td>
                    ))}
                    <td style={tdCenter}>
                      <input
                        type="checkbox"
                        checked={Boolean(r.is_owner)}
                        disabled={busy}
                        onChange={(e) =>
                          patch(r.email, { is_owner: e.target.checked })
                        }
                      />
                    </td>
                    <td style={tdCenter}>
                      <button
                        type="button"
                        onClick={() => toggleActive(r)}
                        disabled={busy}
                        style={{
                          background: r.active ? TOKENS.moss : TOKENS.text3,
                          color: '#0a0a0a',
                          border: 'none',
                          padding: '3px 10px',
                          borderRadius: 2,
                          fontFamily: MONO,
                          fontSize: 10,
                          letterSpacing: 0.5,
                          textTransform: 'uppercase',
                          fontWeight: 700,
                          cursor: busy ? 'wait' : 'pointer',
                        }}
                      >
                        {r.active ? 'Active' : 'Off'}
                      </button>
                    </td>
                    <td style={{ ...td, fontFamily: MONO, color: TOKENS.text3 }}>
                      {fmtDate(r.last_login_at)}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <div
        style={{
          marginTop: 14,
          fontFamily: MONO,
          fontSize: 10,
          color: TOKENS.text3,
        }}
      >
        Holding-only edits. Owner-gated by cookie middleware on
        /api/cockpit/users — non-owners get 404. Invites use existing form at
        /settings/users/new.
      </div>
    </div>
  );
}

const th: React.CSSProperties = {
  textAlign: 'left',
  padding: '10px 12px',
  fontFamily: MONO,
  fontSize: 10,
  letterSpacing: 0.6,
  color: TOKENS.text3,
  textTransform: 'uppercase',
  background: TOKENS.bgDeep,
};
const thCenter: React.CSSProperties = { ...th, textAlign: 'center' };
const td: React.CSSProperties = { padding: '8px 12px' };
const tdCenter: React.CSSProperties = { ...td, textAlign: 'center' };
