// app/settings/users/page.tsx
// PBS 2026-07-09 v2: Supabase Auth user management.
// Replaces the workspace_session-based /cockpit/users page.
// - Lists auth.users + tenancy grants (holding_role, property_ids)
// - Add-user form (email + name + Namkhan/Donna/Holding scope + role)
// - Send invitation button (password-reset email flow)
// - Active toggle (soft-delete via tenancy.property_users.status)

import { DashboardPage, Container } from '@/app/(cockpit)/_design';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import UsersMatrix, { type UserRow } from './_components/UsersMatrix';
import AddUserForm from './_components/AddUserForm';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

async function loadUsers(): Promise<UserRow[]> {
  const sb = getSupabaseAdmin();
  // auth.users via admin API — need service_role. Wrap in try since local dev
  // may not have keys set.
  const { data: authRes, error: authErr } = await sb.auth.admin.listUsers({ perPage: 200 });
  if (authErr) throw new Error(`auth.users load failed: ${authErr.message}`);
  const users = authRes?.users ?? [];

  // Bulk read grants.
  const [propRes, holdRes] = await Promise.all([
    sb.from('v_property_users_flat').select('user_id, property_id, role, status'),
    sb.from('v_holding_users_flat').select('auth_user_id, role, status'),
  ]);
  const propByUser = new Map<string, Array<{ property_id: number; role: string; status: string }>>();
  for (const r of (propRes.data ?? []) as Array<{ user_id: string; property_id: number; role: string; status: string }>) {
    if (!propByUser.has(r.user_id)) propByUser.set(r.user_id, []);
    propByUser.get(r.user_id)!.push({ property_id: r.property_id, role: r.role, status: r.status });
  }
  const holdByUser = new Map<string, { role: string; status: string }>();
  for (const r of (holdRes.data ?? []) as Array<{ auth_user_id: string; role: string; status: string }>) {
    holdByUser.set(r.auth_user_id, { role: r.role, status: r.status });
  }

  return users.map((u) => ({
    id: u.id,
    email: u.email ?? '',
    last_sign_in_at: u.last_sign_in_at ?? null,
    created_at: u.created_at,
    holding_role: holdByUser.get(u.id)?.role ?? null,
    property_grants: propByUser.get(u.id) ?? [],
  }));
}

export default async function UsersPage() {
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
                   subtitle="Matrix: Namkhan · Donna · Holding — check to grant access · Send invitation resends the sign-in link · Hard delete forbidden — deactivate instead"
                   density="compact">
          <UsersMatrix initial={users} />
        </Container>
      </div>
    </DashboardPage>
  );
}
