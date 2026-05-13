// app/h/[property_id]/operations/staff/attendance/page.tsx — property-scoped
import AttendanceTabContent from '../../../../../operations/staff/_components/AttendanceTabContent';
import { NAMKHAN_PROPERTY_ID, DONNA_PROPERTY_ID } from '@/lib/dept-cfg/by-property';

export const revalidate = 60;
export const dynamic = 'force-dynamic';

const PROPERTY_LABELS: Record<number, string> = {
  [NAMKHAN_PROPERTY_ID]: 'Namkhan',
  [DONNA_PROPERTY_ID]:   'Donna Portals',
};

export default async function StaffAttendanceScoped({ params }: { params: { property_id: string } }) {
  const propertyId = Number(params.property_id);
  if (!Number.isFinite(propertyId)) {
    return <AttendanceTabContent propertyId={NAMKHAN_PROPERTY_ID} propertyLabel="Namkhan" />;
  }
  return (
    <AttendanceTabContent
      propertyId={propertyId}
      propertyLabel={PROPERTY_LABELS[propertyId] ?? `Property ${propertyId}`}
    />
  );
}
