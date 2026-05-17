// app/h/[property_id]/finance/hr/lifecycle/page.tsx — property-scoped HR · Lifecycle
import { notFound } from 'next/navigation';
import LifecycleTabContent from '@/app/operations/staff/_components/LifecycleTabContent';
import { financeSubPagesForProperty } from '@/app/finance/_subpages';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const KNOWN_LABEL: Record<number, string> = { 260955: 'Namkhan', 1000001: 'Donna' };

export default function PropertyFinanceHrLifecyclePage({
  params, searchParams,
}: {
  params: { property_id: string };
  searchParams: { view?: string; drilldown?: string };
}) {
  const propertyId = Number(params.property_id);
  if (!KNOWN_LABEL[propertyId]) notFound();
  return (
    <LifecycleTabContent
      propertyId={propertyId}
      propertyLabel={KNOWN_LABEL[propertyId]}
      searchParams={searchParams}
      subPagesOverride={financeSubPagesForProperty(propertyId)}
    />
  );
}
