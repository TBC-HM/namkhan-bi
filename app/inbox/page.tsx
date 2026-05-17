// app/inbox/page.tsx
// Legacy /inbox URL — kept so existing bookmarks, internal links, and
// HeaderPills fallbacks resolve. The inbox now lives at the
// property-scoped route /h/[property_id]/inbox so Namkhan and Donna
// Portals can coexist (apple-note 2026-05-14: Donna will need an
// identical inbox once forwarding to data@thedonnaportals.com is wired).
//
// Until session-derived property scoping lands, anyone hitting /inbox
// is redirected into the Namkhan (260955) inbox.

import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default function LegacyInboxRedirect() {
  redirect('/h/260955/inbox');
}
