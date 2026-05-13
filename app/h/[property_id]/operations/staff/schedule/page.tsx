// app/h/[property_id]/operations/staff/schedule/page.tsx — property-scoped
import ScheduleTabContent from '../../../../../operations/staff/_components/ScheduleTabContent';
import { NAMKHAN_PROPERTY_ID, DONNA_PROPERTY_ID } from '@/lib/dept-cfg/by-property';

export const revalidate = 60;
export const dynamic = 'force-dynamic';

const PROPERTY_LABELS: Record<number, string> = {
  [NAMKHAN_PROPERTY_ID]: 'Namkhan',
  [DONNA_PROPERTY_ID]:   'Donna Portals',
};

export default async function StaffScheduleScoped({ params }: { params: { property_id: string } }) {
  const propertyId = Number(params.property_id);
  if (!Number.isFinite(propertyId)) {
    return <ScheduleTabContent propertyId={NAMKHAN_PROPERTY_ID} propertyLabel="Namkhan" />;
  }
  return (
    <ScheduleTabContent
      propertyId={propertyId}
      propertyLabel={PROPERTY_LABELS[propertyId] ?? `Property ${propertyId}`}
    />
  );
}
