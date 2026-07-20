// app/marketing/prospects/page.tsx
// PBS 2026-07-21 · Phase 2 IA — prospects folded into unified /marketing/audience.
// Redirect preserves inbound links (nav, bookmarks, external, sequences launcher).
import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

// Type preserved for legacy _components/ProspectsClient.tsx import.
// The client is orphaned (no longer routed) but must still compile until removed.
export type ProspectRow = {
  subscriber_id: string;
  full_name: string | null;
  email: string | null;
  country: string | null;
  company: string | null;
  website: string | null;
  enrichment: string | null;
  interest_series: string | null;
  tags: string[] | null;
  enrolled_funnels: string[] | null;
  funnel_sends: number;
  funnel_pending: number;
  lifecycle_stage: string | null;
  booking_count: number | null;
  last_email_open_at: string | null;
  last_email_click_at: string | null;
  is_pinned: boolean;
  created_at: string | null;
  mx_valid: boolean | null;
  mx_checked_at: string | null;
};

export default function ProspectsRedirect() {
  redirect('/marketing/audience?source=prospects');
}
