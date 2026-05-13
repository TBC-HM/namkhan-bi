// app/h/[property_id]/operations/attendance/page.tsx — property-scoped
import AttendancePageContent from '../../../../operations/attendance/_components/AttendancePageContent';
import { NAMKHAN_PROPERTY_ID, DONNA_PROPERTY_ID } from '@/lib/dept-cfg/by-property';

export const revalidate = 60;
export const dynamic = 'force-dynamic';

const PROPERTY_LABELS: Record<number, string> = {
  [NAMKHAN_PROPERTY_ID]: 'Namkhan',
  [DONNA_PROPERTY_ID]:   'Donna Portals',
};

export default async function AttendancePageScoped({ params }: { params: { property_id: string } }) {
  const propertyId = Number(params.property_id);
  if (!Number.isFinite(propertyId)) {
    return <AttendancePageContent propertyId={NAMKHAN_PROPERTY_ID} propertyLabel="Namkhan" />;
  }
  return (
    <AttendancePageContent
      propertyId={propertyId}
      propertyLabel={PROPERTY_LABELS[propertyId] ?? `Property ${propertyId}`}
    />
  );
}
