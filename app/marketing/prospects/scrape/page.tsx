// app/marketing/prospects/scrape/page.tsx
// PBS 2026-07-21 · Phase 2 IA — scrape engine embedded into /marketing/audience.
// Redirect preserves inbound links. Advanced actor picker is still available inline.
import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

export default function ScrapeRedirect() {
  redirect('/marketing/audience?tab=scrape');
}
