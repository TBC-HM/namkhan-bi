// app/marketing/youtube/page.tsx
// PBS 2026-07-13 — root YouTube URL redirects to /dashboard. The area is now split
// into 4 sub-pages: Dashboard · Playlists · Planning · Production.
import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

export default function YouTubeRootPage() {
  redirect('/marketing/youtube/dashboard');
}
