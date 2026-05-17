// app/h/[property_id]/finance/hr/page.tsx
//
// Donna (and any non-Namkhan) HR page. Re-uses the canonical
// StaffPageContent with the active property_id + the property-scoped
// finance sub-pages strip so Donna's nav stays Donna.
//
// For Namkhan, redirects to the global /finance/hr alias (same shared
// component, just different sub-strip).

import { redirect } from 'next/navigation';
import StaffPageContent from '@/app/operations/staff/_components/StaffPageContent';
import { NAMKHAN_PROPERTY_ID } from '@/lib/dept-cfg/by-property';
import { financeSubPagesForProperty } from '@/app/finance/_subpages';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

interface Props {
  params: { property_id: string };
  searchParams: Record<string, string | string[] | undefined>;
}

export default async function DonnaFinanceHrPage({ params, searchParams }: Props) {
  const propertyId = Number(params.property_id);
  if (propertyId === NAMKHAN_PROPERTY_ID) redirect('/finance/hr');

  return (
    <StaffPageContent
      propertyId={propertyId}
      searchParams={searchParams}
      subPagesOverride={financeSubPagesForProperty(propertyId)}
    />
  );
}
