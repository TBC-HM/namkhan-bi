// app/settings/cockpit/page.tsx
// PBS 2026-05-09 — settings cleanup. /settings/cockpit is redundant; redirects
// to /cockpit (the canonical IT cockpit).

import { redirect } from 'next/navigation';
export const dynamic = 'force-dynamic';
export default function SettingsCockpitRedirect() {
  redirect('/cockpit');
}
