// app/cockpit-v2/docs/page.tsx
// Ask 3 — live documentation tab. Renders the LIVE markdown for the three
// canonical docs (claude_md, architecture, factorial_md) directly from
// documentation.documents. No caching; force-dynamic so every visit reads
// fresh state from Supabase.

import { fetchDocs } from '../_lib/data';
import { DocsView } from './DocsView';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function CockpitV2DocsPage() {
  const docs = await fetchDocs();
  return <DocsView docs={docs} />;
}
