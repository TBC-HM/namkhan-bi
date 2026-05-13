// app/operations/staff/schedule/page.tsx — Namkhan default (Schedule tab inside Staff)
import ScheduleTabContent from '../_components/ScheduleTabContent';
import { NAMKHAN_PROPERTY_ID } from '@/lib/dept-cfg/by-property';

export const revalidate = 60;
export const dynamic = 'force-dynamic';

interface Props {
  searchParams: Record<string, string | string[] | undefined>;
}

export default async function StaffSchedulePage({ searchParams }: Props) {
  return (
    <ScheduleTabContent
      propertyId={NAMKHAN_PROPERTY_ID}
      propertyLabel="Namkhan"
      searchParams={searchParams}
    />
  );
}
