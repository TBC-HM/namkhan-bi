// app/operations/staff/holidays/page.tsx — Namkhan default (Holidays tab)
import HolidayScheduleTabContent from '../_components/HolidayScheduleTabContent';
import { NAMKHAN_PROPERTY_ID } from '@/lib/dept-cfg/by-property';

export const revalidate = 60;
export const dynamic = 'force-dynamic';

interface Props {
  searchParams: Record<string, string | string[] | undefined>;
}

export default async function StaffHolidaysPage({ searchParams }: Props) {
  return (
    <HolidayScheduleTabContent
      propertyId={NAMKHAN_PROPERTY_ID}
      propertyLabel="Namkhan"
      searchParams={searchParams}
    />
  );
}
