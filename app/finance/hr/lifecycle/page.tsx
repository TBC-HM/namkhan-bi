// app/finance/hr/lifecycle/page.tsx — Namkhan default (HR · Lifecycle)
import LifecycleTabContent from '@/app/operations/staff/_components/LifecycleTabContent';
import { NAMKHAN_PROPERTY_ID } from '@/lib/dept-cfg/by-property';
import { FINANCE_SUBPAGES } from '@/app/finance/_subpages';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default function FinanceHrLifecyclePage({
  searchParams,
}: {
  searchParams: { view?: string; drilldown?: string };
}) {
  return (
    <LifecycleTabContent
      propertyId={NAMKHAN_PROPERTY_ID}
      propertyLabel="Namkhan"
      searchParams={searchParams}
      subPagesOverride={FINANCE_SUBPAGES}
    />
  );
}
