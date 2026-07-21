// app/guest/newsletters/broadcasts/page.tsx
// PBS 2026-07-22 (Newsletter Engine v2): explicit /broadcasts URL that mirrors the
// default /guest/newsletters landing (which is now the Broadcasts tab). Kept for
// deep-link friendliness and to satisfy the ship brief's file scope.
// 2026-07-21 pm restore: drop searchParams prop (Next.js 15 PageProps typing;
// NewslettersPage doesn't consume it anyway).

import NewslettersPage from '../page';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default function BroadcastsPage() {
  return <NewslettersPage />;
}
