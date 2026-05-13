// app/h/[property_id]/operations/staff/holidays/page.tsx — property-scoped Holidays tab
import HolidayScheduleTabContent from '../../../../../operations/staff/_components/HolidayScheduleTabContent';
import { NAMKHAN_PROPERTY_ID, DONNA_PROPERTY_ID } from '@/lib/dept-cfg/by-property';

export const revalidate = 60;
export const dynamic = 'force-dynamic';

const PROPERTY_LABELS: Record<number, string> = {
  [NAMKHAN_PROPERTY_ID]: 'Namkhan',
  [DONNA_PROPERTY_ID]:   'Donna Portals',
};

interface Props {
  params: { property_id: string };
  searchParams: Record<string, string | string[] | undefined>;
}

export default async function StaffHolidaysScoped({ params, searchParams }: Props) {
  const propertyId = Number(params.property_id);
  if (!Number.isFinite(propertyId)) {
    return (
      <HolidayScheduleTabContent
        propertyId={NAMKHAN_PROPERTY_ID}
        propertyLabel="Namkhan"
        searchParams={searchParams}
      />
    );
  }
  return (
    <HolidayScheduleTabContent
      propertyId={propertyId}
      propertyLabel={PROPERTY_LABELS[propertyId] ?? `Property ${propertyId}`}
      searchParams={searchParams}
    />
  );
}
