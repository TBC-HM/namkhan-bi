// app/cockpit/users/page.tsx
// PBS 2026-07-09: legacy /cockpit/users used the workspace_session cookie flow
// (Supabase Auth doesn't set that cookie → 404 from the /api route).
// Redirect to the new /settings/users page which uses Supabase Auth.
import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

export default function LegacyCockpitUsersRedirect() {
  redirect('/settings/users');
}
