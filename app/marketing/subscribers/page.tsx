// app/marketing/subscribers/page.tsx
// PBS 2026-07-21 · Phase 2 IA — subscribers folded into unified /marketing/audience.
// Redirect preserves inbound links (nav, bookmarks, external).
import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

export default function SubscribersRedirect() {
  redirect('/marketing/audience?source=subscribers');
}
