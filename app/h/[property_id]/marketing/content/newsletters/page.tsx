// app/h/[property_id]/marketing/content/newsletters/page.tsx
// PBS 2026-08-21 · Tenant Newsletter delegate under Marketing → Content.
// Mounts the canonical Newsletters body with propertyId scoping.
// Same delegation pattern as /h/[property_id]/guest/newsletters/page.tsx.
// URL lives at /h/{pid}/marketing/content/newsletters per PBS URL law.

import { notFound } from 'next/navigation';
import NewslettersBody from '@/app/guest/newsletters/page';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default function TenantMarketingContentNewslettersPage({
  params,
}: {
  params: { property_id: string };
}) {
  const pid = Number(params.property_id);
  if (!Number.isFinite(pid)) notFound();
  return <NewslettersBody propertyId={pid} />;
}
