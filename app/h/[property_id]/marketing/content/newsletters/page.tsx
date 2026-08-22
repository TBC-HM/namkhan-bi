// app/h/[property_id]/marketing/content/newsletters/page.tsx
// PBS 2026-08-22 · Tenant Newsletter delegate under Marketing → Content.
// Mounts the canonical Newsletters body with propertyId scoping AND overrides
// the top strip to render the MARKETING sub-strip (was previously showing
// the Guest/Contacts strip because NewslettersBody is originally under
// /guest/newsletters).

import { notFound } from 'next/navigation';
import NewslettersBody from '@/app/guest/newsletters/page';
import { MARKETING_SUBPAGES } from '@/app/marketing/_subpages';
import type { DashboardTab } from '@/app/(cockpit)/_design';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default function TenantMarketingContentNewslettersPage({
  params,
}: {
  params: { property_id: string };
}) {
  const pid = Number(params.property_id);
  if (!Number.isFinite(pid)) notFound();
  const tabs: DashboardTab[] = MARKETING_SUBPAGES.map((s) => ({
    key: s.href, label: s.label, href: s.href,
    active: s.href.endsWith('/marketing/content'),
  }));
  return (
    <NewslettersBody
      propertyId={pid}
      tabsOverride={tabs}
      titleOverride="Marketing · Newsletters"
    />
  );
}
