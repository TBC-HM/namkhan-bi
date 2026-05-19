// app/h/[property_id]/finance/dashboard/page.tsx
// NEW Finance section dashboard (additive — does not replace
// /h/[property_id]/finance DeptEntry).

import { notFound } from 'next/navigation';
import SectionPage from '../../_shared/SectionPage';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default function FinanceDashboardPage({ params }: { params: { property_id: string } }) {
  const propertyId = Number(params.property_id);
  if (!Number.isFinite(propertyId)) notFound();
  return (
    <SectionPage
      propertyId={propertyId}
      section="finance"
      pageSlug="finance"
      title="Finance"
      subtitle="cash · core · risk · treasury"
    />
  );
}
