// app/marketing/library/page.tsx
// PBS 2026-07-11 pm — LEGACY LIBRARY REDIRECT.
// The Library UI now lives inside the Media Hub as a sub-tab.
// This preserves the old URL (linked from campaigns, emails, etc.)
// and sends visitors to the canonical location.

import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

export default function MarketingLibraryRedirect() {
  redirect('/marketing/media');
}
