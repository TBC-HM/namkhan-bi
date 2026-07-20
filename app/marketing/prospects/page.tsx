// app/marketing/prospects/page.tsx
// PBS 2026-07-21 · Phase 2 IA — prospects folded into unified /marketing/audience.
// Redirect preserves inbound links (nav, bookmarks, external, sequences launcher).
import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

export default function ProspectsRedirect() {
  redirect('/marketing/audience?source=prospects');
}
