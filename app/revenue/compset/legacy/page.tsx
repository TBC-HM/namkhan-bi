// app/revenue/compset/legacy/page.tsx
// PBS #190 — legacy stub replaced with a redirect to the canonical compset page.
// No code in the app links here; URL still resolves cleanly for any bookmarks.

import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

export default function CompsetLegacyRedirect() {
  redirect('/revenue/compset');
}
