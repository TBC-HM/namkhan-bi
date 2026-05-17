// app/finance/hr/schedule/page.tsx — Namkhan default (Schedule under HR/Finance)
import ScheduleTabContent from '@/app/operations/staff/_components/ScheduleTabContent';
import { NAMKHAN_PROPERTY_ID } from '@/lib/dept-cfg/by-property';
import { FINANCE_SUBPAGES } from '@/app/finance/_subpages';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

interface Props {
  searchParams: Record<string, string | string[] | undefined>;
}

export default async function FinanceHrSchedulePage({ searchParams }: Props) {
  return (
    <ScheduleTabContent
      propertyId={NAMKHAN_PROPERTY_ID}
      propertyLabel="Namkhan"
      searchParams={searchParams}
      subPagesOverride={FINANCE_SUBPAGES}
    />
  );
}
