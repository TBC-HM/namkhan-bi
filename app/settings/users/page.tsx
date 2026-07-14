// app/settings/users/page.tsx
// PBS 2026-07-09 v2 / 2026-07-13 v3: Supabase Auth user management.
// - Lists auth.users + tenancy grants (holding_role, property_ids)
// - Add-user form (email + name + Namkhan/Donna/Holding scope + role)
// - Send invitation button (password-reset email flow)
// - Active toggle (soft-delete via tenancy.property_users.status)
// - 2026-07-13 role-gate: only holding owners/admins can view this page.
//   Non-admins are redirected to '/' with an ?err=admin_required flash.
// - 2026-07-13 invited_at pulled from auth.users so UsersMatrix can render
//   the "Invitation sent" pill next to Last sign-in.
// - 2026-07-14 landing_page loaded from v_holding_users_flat → UserRow.

import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { DashboardPage, Container } from '@/app/(cockpit)/_design';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import UsersMatrix, { type UserRow } from './_components/UsersMatrix';
import AddUserForm from './_components/AddUserForm';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

// -----------------------------------------------------------------------------
// Admin gate — Supabase Auth cookie + v_holding_users_flat.role check
// Matches the pattern used by the /api/settings/users/* routes.
// -----------------------------------------------------------------------------
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

async function loadUsers(): Promise<UserRow[]> {
  const sb = getSupabaseAdmin();
  const { data: authRes, error: authErr } = await sb.auth.admin.listUsers({ perPage: 200 });
  if (authErr) throw new Error(`auth.users load failed: ${authErr.message}`);
  const users = authRes?.users ?? [];

  const [propRes, holdRes] = await Promise.all([
    sb.from('v_property_users_flat').select('user_id, property_id, role, status, full_name'),
    sb.from('v_holding_users_flat').select('auth_user_id, role, status, full_name, landing_page'),
  ]);
  const propByUser = new Map<string, Array<{ property_id: number; role: string; status: string }>>();
  const nameByUser = new Map<string, string>();
  for (const r of (propRes.data ?? []) as Array<{ user_id: string; property_id: number; role: string; status: string; full_name: string | null }>) {
    if (!propByUser.has(r.user_id)) propByUser.set(r.user_id, []);
    propByUser.get(r.user_id)!.push({ property_id: r.property_id, role: r.role, status: r.status });
    if (r.full_name && !nameByUser.has(r.user_id)) nameByUser.set(r.user_id, r.full_name);
  }
  const holdByUser = new Map<string, { role: string; status: string; landing_page: string | null }>();
  for (const r of (holdRes.data ?? []) as Array<{ auth_user_id: string; role: string; status: string; full_name: string | null; landing_page: string | null }>) {
    if (r.status === 'active') holdByUser.set(r.auth_user_id, { role: r.role, status: r.status, landing_page: r.landing_page });
    if (r.full_name && !nameByUser.has(r.auth_user_id)) nameByUser.set(r.auth_user_id, r.full_name);
  }

  return users.map((u) => ({
    id: u.id,
    email: u.email ?? '',
    full_name: nameByUser.get(u.id) ?? (u.user_metadata?.full_name as string | undefined) ?? null,
    last_sign_in_at: u.last_sign_in_at ?? null,
    created_at: u.created_at,
    // invited_at: Supabase Auth stamps this on inviteUserByEmail() calls.
    // Falls back to null for users that were signed up directly.
    invited_at: (u as unknown as { invited_at?: string | null }).invited_at ?? null,
    holding_role: holdByUser.get(u.id)?.role ?? null,
    property_grants: propByUser.get(u.id) ?? [],
    landing_page: holdByUser.get(u.id)?.landing_page ?? null,
  }));
}

export default async function UsersPage() {
  await requireHoldingAdmin();
  const users = await loadUsers();

  return (
    <DashboardPage
      title="Users · Access"
      subtitle="Who can log in · which property they see · which role · send invitations"
    >
      <div style={{ gridColumn: '1 / -1' }}>
        <Container title="Add user" subtitle="Create an auth user + assign property/role · Send invitation emails a magic-link" density="compact">
          <AddUserForm />
        </Container>
      </div>

      <div style={{ gridColumn: '1 / -1' }}>
        <Container title={`Workspace users · ${users.length}`}
                   subtitle="Matrix: Namkhan · Donna · Holding — check to grant access · Send invitation resends the sign-in link · Deactivate = soft (preserves data) · Delete = hard (auth account destroyed)"
                   density="compact">
          <UsersMatrix initial={users} />
        </Container>
      </div>
    </DashboardPage>
  );
}
