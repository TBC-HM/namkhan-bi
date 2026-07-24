// app/holding/users/page.tsx
// Holding-level user management — links to property-level settings.
// Full user management lives at /h/[pid]/settings/users per property.

import Link from 'next/link';
import { supabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

async function fetchUsers() {
  try {
    const { data } = await supabase
      .from('v_tenant_users' as any)
      .select('id, email, role, last_sign_in_at, created_at')
      .order('created_at', { ascending: false })
      .limit(50);
    return (data ?? []) as any[];
  } catch {
    return [];
  }
}

function ageStr(iso: string | null): string {
  if (!iso) return 'never';
  const d = Math.round((Date.now() - new Date(iso).getTime()) / 86_400_000);
  if (d === 0) return 'today';
  if (d === 1) return 'yesterday';
  if (d < 30) return `${d}d ago`;
  if (d < 365) return `${Math.round(d / 30)}mo ago`;
  return `${Math.round(d / 365)}y ago`;
}

export default async function HoldingUsersPage() {
  const users = await fetchUsers();

  return (
    <div style={{ maxWidth: 860, padding: '32px 24px' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: '#1B1B1B', margin: '0 0 4px' }}>
            Users & Access
          </h1>
          <p style={{ fontSize: 12, color: '#5A5A5A', margin: 0 }}>
            Holding-level view · manage per-property access in Settings → Users
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <Link href="/h/260955/settings/users" style={{ fontSize: 11, padding: '6px 12px', borderRadius: 4,
            border: '1px solid #E6DFCC', background: '#FFFFFF', color: '#1B1B1B', textDecoration: 'none' }}>
            Namkhan users →
          </Link>
          <Link href="/h/1000001/settings/users" style={{ fontSize: 11, padding: '6px 12px', borderRadius: 4,
            border: '1px solid #E6DFCC', background: '#FFFFFF', color: '#1B1B1B', textDecoration: 'none' }}>
            Donna users →
          </Link>
        </div>
      </div>

      <div style={{ border: '1px solid #E6DFCC', borderRadius: 6, overflow: 'hidden' }}>
        {users.length === 0 ? (
          <div style={{ padding: '20px 16px' }}>
            <p style={{ fontSize: 12, color: '#5A5A5A', margin: '0 0 12px' }}>
              User list is managed per-property. Use the links above to manage users for each property.
            </p>
            <p style={{ fontSize: 11, color: '#8A8A8A', margin: 0 }}>
              Holding-level: access to /holding/* is controlled by Supabase Auth roles.
              Contact IT (Kit) to add or remove holding-level access.
            </p>
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr style={{ background: '#FAFAF7', borderBottom: '1px solid #E6DFCC' }}>
                {['EMAIL', 'ROLE', 'LAST SIGN IN', 'JOINED'].map(h => (
                  <th key={h} style={{ padding: '8px 14px', textAlign: 'left', fontWeight: 700,
                    color: '#5A5A5A', fontSize: 11, letterSpacing: '0.05em' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {users.map((u: any, i: number) => (
                <tr key={u.id} style={{ borderBottom: i < users.length - 1 ? '1px solid #E6DFCC' : 'none' }}>
                  <td style={{ padding: '10px 14px', color: '#1B1B1B', fontWeight: 500 }}>{u.email}</td>
                  <td style={{ padding: '10px 14px', color: '#5A5A5A' }}>{u.role ?? 'user'}</td>
                  <td style={{ padding: '10px 14px', color: '#5A5A5A' }}>{ageStr(u.last_sign_in_at)}</td>
                  <td style={{ padding: '10px 14px', color: '#5A5A5A' }}>{ageStr(u.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
