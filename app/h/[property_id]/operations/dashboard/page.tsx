// app/h/[property_id]/operations/dashboard/page.tsx
// NEW Operations section dashboard (additive — does not replace the
// existing /h/[property_id]/operations DeptEntry which redirects Namkhan
// to the legacy /operations).

import { notFound } from 'next/navigation';
import SectionPage from '../../_shared/SectionPage';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default function OperationsDashboardPage({ params }: { params: { property_id: string } }) {
  const propertyId = Number(params.property_id);
  if (!Number.isFinite(propertyId)) notFound();
  return (
    <SectionPage
      propertyId={propertyId}
      section="operations"
      pageSlug="operations"
      title="Operations"
      subtitle="today · in-house · availability · turnover"
    />
  );
}
