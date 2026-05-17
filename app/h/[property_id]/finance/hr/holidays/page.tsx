// app/h/[property_id]/finance/hr/holidays/page.tsx — property-scoped Holidays under HR/Finance
import { notFound } from 'next/navigation';
import HolidayScheduleTabContent from '@/app/operations/staff/_components/HolidayScheduleTabContent';
import { financeSubPagesForProperty } from '@/app/finance/_subpages';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const KNOWN_LABEL: Record<number, string> = { 260955: 'Namkhan', 1000001: 'Donna' };

interface Props {
  params: { property_id: string };
  searchParams: Record<string, string | string[] | undefined>;
}

export default async function PropertyFinanceHrHolidaysPage({ params, searchParams }: Props) {
  const propertyId = Number(params.property_id);
  if (!KNOWN_LABEL[propertyId]) notFound();
  return (
    <HolidayScheduleTabContent
      propertyId={propertyId}
      propertyLabel={KNOWN_LABEL[propertyId]}
      searchParams={searchParams}
      subPagesOverride={financeSubPagesForProperty(propertyId)}
    />
  );
}
