// app/settings/email-categories/page.tsx
// PBS 2026-05-09 — settings cleanup. Only Property stays under /settings;
// the rest moves to /cockpit. Old route preserved as redirect to keep
// existing links/bookmarks alive. Original implementation history is in git.

import { redirect } from 'next/navigation';
export const dynamic = 'force-dynamic';
export default function SettingsEmailCategoriesRedirect() {
  redirect('/cockpit?tab=email-categories');
}
