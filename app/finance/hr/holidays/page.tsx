// app/finance/hr/holidays/page.tsx — Namkhan default (Holidays under HR/Finance)
import HolidayScheduleTabContent from '@/app/operations/staff/_components/HolidayScheduleTabContent';
import { NAMKHAN_PROPERTY_ID } from '@/lib/dept-cfg/by-property';
import { FINANCE_SUBPAGES } from '@/app/finance/_subpages';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

interface Props {
  searchParams: Record<string, string | string[] | undefined>;
}

export default async function FinanceHrHolidaysPage({ searchParams }: Props) {
  return (
    <HolidayScheduleTabContent
      propertyId={NAMKHAN_PROPERTY_ID}
      propertyLabel="Namkhan"
      searchParams={searchParams}
      subPagesOverride={FINANCE_SUBPAGES}
    />
  );
}
