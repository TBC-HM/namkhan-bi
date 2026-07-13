// app/settings/users/[user_id]/page.tsx
// PBS 2026-07-13: user detail page. Admin-gated (same rule as parent).
// Shows: name / email / initials · sign-in stats · role grants · actions.
// Recent-activity attribution is out of scope for v1 (cockpit_tickets has
// no user_id column — deferred).
import { redirect, notFound } from 'next/navigation';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { DashboardPage, Container } from '@/app/(cockpit)/_design';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import type { CSSProperties } from 'react';
import TenantLink from '@/components/nav/TenantLink';
import UserDetailActions from '../_components/UserDetailActions';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

async function requireHoldingAdmin(): Promise<void> {
  const cookieStore = await cookies();
  const sb = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll().map((c) => ({ name: c.name, value: c.value })),
        setAll: () => {},
      },
    },
  );
  const { data: { user } } = await sb.auth.getUser();
  if (!user) redirect('/login?err=auth_required');
  const admin = getSupabaseAdmin();
  const { data } = await admin
    .from('v_holding_users_flat')
    .select('role, status')
    .eq('auth_user_id', user.id)
    .maybeSingle();
  const role = data?.role ?? null;
  const status = data?.status ?? null;
  if (status !== 'active' || !role || !['owner', 'admin'].includes(role)) {
    redirect('/?err=admin_required');
  }
}

function initialsFrom(name: string | null | undefined, email: string): string {
  const src = (name && name.trim()) || email.split('@')[0] || '';
  const parts = src.split(/[\s._-]+/).filter(Boolean).slice(0, 2);
  return parts.map((p) => p[0]?.toUpperCase() ?? '').join('') || '?';
}

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  try { return new Date(iso).toISOString().replace('T', ' ').replace(/\.\d+Z$/, ' UTC'); } catch { return String(iso); }
}

interface Props { params: Promise<{ user_id: string }>; }

export default async function UserDetailPage({ params }: Props) {
  await requireHoldingAdmin();
  const { user_id } = await params;
  const admin = getSupabaseAdmin();

  const { data: authRes, error: authErr } = await admin.auth.admin.getUserById(user_id);
  if (authErr || !authRes?.user) notFound();
  const u = authRes.user;

  const [propRes, holdRes] = await Promise.all([
    admin.from('v_property_users_flat')
      .select('property_id, role, status, full_name, created_at, updated_at')
      .eq('user_id', user_id),
    admin.from('v_holding_users_flat')
      .select('role, status, full_name, org_id, created_at, updated_at')
      .eq('auth_user_id', user_id)
      .maybeSingle(),
  ]);

  const propertyGrants = (propRes.data ?? []) as Array<{ property_id: number; role: string; status: string; full_name: string | null; created_at: string | null; updated_at: string | null }>;
  const holdingGrant = holdRes.data as { role: string; status: string; full_name: string | null; org_id: number | null; created_at: string | null; updated_at: string | null } | null;

  const fullName = holdingGrant?.full_name
    ?? propertyGrants.find((g) => g.full_name)?.full_name
    ?? (u.user_metadata?.full_name as string | undefined)
    ?? null;
  const email = u.email ?? '';
  const initials = initialsFrom(fullName, email);
  const signInCount = (u.user_metadata?.sign_in_count as number | undefined) ?? null;

  return (
    <DashboardPage
      title={fullName ?? email}
      subtitle={`User · ${email}`}
    >
      {/* Back link */}
      <div style={{ gridColumn: '1 / -1', marginBottom: -8 }}>
        <TenantLink href="/settings/users" style={{ fontSize: 11, color: '#5A5A5A', textDecoration: 'none' }}>
          ← Back to Users &amp; Roles
        </TenantLink>
      </div>

      {/* Header card */}
      <div style={{ gridColumn: '1 / -1' }}>
        <Container title="Identity" density="compact">
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, padding: 4 }}>
            <div style={{
              width: 56, height: 56, borderRadius: '50%',
              background: '#084838', color: '#FFFFFF',
              display: 'grid', placeItems: 'center',
              fontSize: 20, fontWeight: 700, letterSpacing: '0.04em',
            }}>{initials}</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <div style={{ fontSize: 16, color: '#1B1B1B', fontWeight: 600 }}>{fullName ?? '—'}</div>
              <div style={{ fontSize: 12, color: '#5A5A5A' }}>{email}</div>
              <div style={{ fontSize: 10, color: '#5A5A5A', fontFamily: 'monospace' }}>{u.id}</div>
            </div>
          </div>
        </Container>
      </div>

      {/* Sign-in stats */}
      <div style={{ gridColumn: '1 / -1' }}>
        <Container title="Sign-in" subtitle="Timestamps from auth.users" density="compact">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10, padding: 4 }}>
            <Kv label="Last sign-in" value={fmtDate(u.last_sign_in_at)} />
            <Kv label="Invited at" value={fmtDate((u as unknown as { invited_at?: string | null }).invited_at ?? null)} />
            <Kv label="Confirmed at" value={fmtDate(u.email_confirmed_at)} />
            <Kv label="Created" value={fmtDate(u.created_at)} />
            <Kv label="Updated" value={fmtDate(u.updated_at)} />
            {signInCount !== null && <Kv label="Sign-in count" value={String(signInCount)} />}
          </div>
        </Container>
      </div>

      {/* Role grants */}
      <div style={{ gridColumn: '1 / -1' }}>
        <Container title="Role grants" subtitle="Property + Holding rows in tenancy" density="compact">
          <div style={{ padding: 4 }}>
            <div style={{ fontSize: 10, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#5A5A5A', marginBottom: 6 }}>Property grants</div>
            {propertyGrants.length === 0 ? (
              <div style={{ fontSize: 12, color: '#5A5A5A', fontStyle: 'italic', padding: '4px 0' }}>No property grants.</div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead>
                  <tr>
                    <th style={miniTh}>Property</th>
                    <th style={miniTh}>Role</th>
                    <th style={miniTh}>Status</th>
                    <th style={miniTh}>Updated</th>
                  </tr>
                </thead>
                <tbody>
                  {propertyGrants.map((g) => (
                    <tr key={g.property_id}>
                      <td style={miniTd}>{propertyLabel(g.property_id)}</td>
                      <td style={miniTd}>{g.role}</td>
                      <td style={miniTd}>
                        <span style={{
                          padding: '2px 8px', borderRadius: 999,
                          border: `1px solid ${g.status === 'active' ? '#0E7A4B' : '#B48A3A'}`,
                          color: g.status === 'active' ? '#0E7A4B' : '#B48A3A',
                          fontSize: 10, fontWeight: 700, letterSpacing: '0.04em',
                        }}>{g.status}</span>
                      </td>
                      <td style={miniTd}>{fmtDate(g.updated_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            <div style={{ fontSize: 10, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#5A5A5A', margin: '14px 0 6px' }}>Holding grant</div>
            {!holdingGrant ? (
              <div style={{ fontSize: 12, color: '#5A5A5A', fontStyle: 'italic', padding: '4px 0' }}>No holding grant.</div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead>
                  <tr>
                    <th style={miniTh}>Role</th>
                    <th style={miniTh}>Status</th>
                    <th style={miniTh}>Org ID</th>
                    <th style={miniTh}>Updated</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td style={miniTd}>{holdingGrant.role}</td>
                    <td style={miniTd}>
                      <span style={{
                        padding: '2px 8px', borderRadius: 999,
                        border: `1px solid ${holdingGrant.status === 'active' ? '#0E7A4B' : '#B48A3A'}`,
                        color: holdingGrant.status === 'active' ? '#0E7A4B' : '#B48A3A',
                        fontSize: 10, fontWeight: 700, letterSpacing: '0.04em',
                      }}>{holdingGrant.status}</span>
                    </td>
                    <td style={miniTd}>{holdingGrant.org_id ?? '—'}</td>
                    <td style={miniTd}>{fmtDate(holdingGrant.updated_at)}</td>
                  </tr>
                </tbody>
              </table>
            )}
          </div>
        </Container>
      </div>

      {/* Actions */}
      <div style={{ gridColumn: '1 / -1' }}>
        <Container title="Actions" subtitle="Resend invitation · Deactivate · Delete" density="compact">
          <UserDetailActions userId={u.id} email={email} />
        </Container>
      </div>
    </DashboardPage>
  );
}

function Kv({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <div style={{ fontSize: 10, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#5A5A5A', fontWeight: 700 }}>{label}</div>
      <div style={{ fontSize: 12, color: '#1B1B1B', fontFamily: 'monospace' }}>{value}</div>
    </div>
  );
}

function propertyLabel(pid: number): string {
  if (pid === 260955)  return 'Namkhan (260955)';
  if (pid === 1000001) return 'Donna (1000001)';
  return String(pid);
}

const miniTh: CSSProperties = {
  textAlign: 'left', padding: '6px 8px', borderBottom: '1px solid #E6DFCC',
  fontSize: 10, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#3A3A3A', fontWeight: 700,
};
const miniTd: CSSProperties = { padding: '6px 8px', borderBottom: '1px solid #F5F0E1', color: '#1B1B1B', fontSize: 12 };
