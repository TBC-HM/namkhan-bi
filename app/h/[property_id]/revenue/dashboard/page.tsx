// app/h/[property_id]/revenue/dashboard/page.tsx
// NEW Revenue section dashboard — surfaces revenue.headline / channel /
// rateplan / ancillary containers from the registry. Additive — leaves
// /h/[property_id]/revenue (DeptEntry "Nova") intact.

import { notFound } from 'next/navigation';
import { REVENUE_SUBPAGES } from '@/app/revenue/_subpages';
import { rewriteSubPagesForProperty } from '@/lib/dept-cfg/rewrite-subpages';
import SectionPage from '../../_shared/SectionPage';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default function RevenueDashboardPage({ params }: { params: { property_id: string } }) {
  const propertyId = Number(params.property_id);
  if (!Number.isFinite(propertyId)) notFound();

  // Tabs = revenue subpages strip
  const subPages = rewriteSubPagesForProperty(REVENUE_SUBPAGES, propertyId);
  const tabs = subPages.map((s) => ({
    key: s.href,
    label: s.label,
    href: s.href,
    active: s.href.endsWith('/dashboard') || s.href === '/revenue',
  }));

  return (
    <SectionPage
      propertyId={propertyId}
      section="revenue"
      pageSlug="revenue"
      title="Revenue · Headline"
      subtitle="ADR · RevPAR · occupancy · channel · rateplan · ancillary"
      tabs={tabs}
    />
  );
}
