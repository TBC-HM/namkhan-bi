// app/sales/leads/page.tsx
// PBS 2026-07-11 pm (dir 1) — /sales/leads → /sales/pipeline redirect.
// Preserves the old URL for existing bookmarks/tickets while the flow now
// lives at /sales/new + /sales/pipeline.
import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

export default function LeadsRedirect() {
  redirect('/sales/pipeline');
}
