// app/settings/users/page.tsx
// PBS 2026-05-09 — settings cleanup. Redirects to /cockpit/users.

import { redirect } from 'next/navigation';
export const dynamic = 'force-dynamic';
export default function SettingsUsersRedirect() {
  redirect('/cockpit/users');
}
