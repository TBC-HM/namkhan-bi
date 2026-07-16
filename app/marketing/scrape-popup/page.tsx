// app/marketing/scrape-popup/page.tsx
// Popup receiver for the bookmarklet. Receives HTML via postMessage from the
// opener, shows a small form (Lead / Subscriber / tags), POSTs to
// /api/marketing/scrape-web-contact and closes itself.
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import ScrapePopupClient from './_components/ScrapePopupClient';

export const dynamic = 'force-dynamic';

interface Search { url?: string; title?: string }

export default async function ScrapePopupPage({
  searchParams,
}: { searchParams: Promise<Search> }) {
  // Warm the admin client for consistent server context; the actual POST
  // happens through the client via /api/marketing/scrape-web-contact.
  void getSupabaseAdmin();
  const sp = await searchParams;
  return <ScrapePopupClient url={sp.url ?? ''} title={sp.title ?? ''} />;
}
