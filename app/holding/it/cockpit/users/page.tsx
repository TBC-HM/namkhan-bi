// app/holding/it/cockpit/users/page.tsx
// Workspace users (RBAC admin) — V2 port of /cockpit/users. Lists every row
// from workspace_users with role_level + property_ids + dept_ids. Edit /
// deactivate is HOLDING-ONLY (role_level='holding' OR is_owner). Invites
// link to the existing /settings/users/new form (not touched here per #58
// scope rules).
//
// Author: IT-team agent · 2026-05-13 · #58.

import { fetchWorkspaceUsers } from '../_lib/data-port';
import { UsersView } from './UsersView';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function CockpitV2UsersPage() {
  const rows = await fetchWorkspaceUsers();
  return <UsersView initialRows={rows} />;
}
