// app/settings/manual-entries/page.tsx
// PBS 2026-05-09 — settings cleanup. Redirects to /cockpit.

import { redirect } from 'next/navigation';
export const dynamic = 'force-dynamic';
export default function SettingsManualEntriesRedirect() {
  redirect('/cockpit?tab=manual-entries');
}
