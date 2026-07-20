// app/marketing/prospects/scrape/page.tsx
// PBS 2026-07-21 · Phase 2 IA — scrape engine embedded into /marketing/audience.
// Redirect preserves inbound links. Advanced actor picker is still available inline.
import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

// Type preserved for legacy _components/ScrapeForm.tsx + ScrapeHistory.tsx imports.
// Components are orphaned (no longer routed) but must still compile until removed.
export type ScrapeLogRow = {
  id: number;
  actor: string;
  slug: string;
  input_summary: string | null;
  tag_hints: string[] | null;
  items_returned: number;
  inserted: number;
  skipped: number;
  tags_applied: number;
  duration_ms: number | null;
  ok: boolean;
  error: string | null;
  created_at: string;
};

export default function ScrapeRedirect() {
  redirect('/marketing/audience?tab=scrape');
}
