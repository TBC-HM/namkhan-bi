// app/h/[property_id]/operations/staff/data/page.tsx — property-scoped
import DataTabContent from '../../../../../operations/staff/_components/DataTabContent';
import { NAMKHAN_PROPERTY_ID, DONNA_PROPERTY_ID } from '@/lib/dept-cfg/by-property';

export const revalidate = 60;
export const dynamic = 'force-dynamic';

const PROPERTY_LABELS: Record<number, string> = {
  [NAMKHAN_PROPERTY_ID]: 'Namkhan',
  [DONNA_PROPERTY_ID]:   'Donna Portals',
};

export default async function StaffDataScoped({ params }: { params: { property_id: string } }) {
  const propertyId = Number(params.property_id);
  if (!Number.isFinite(propertyId)) {
    return <DataTabContent propertyId={NAMKHAN_PROPERTY_ID} propertyLabel="Namkhan" />;
  }
  return (
    <DataTabContent
      propertyId={propertyId}
      propertyLabel={PROPERTY_LABELS[propertyId] ?? `Property ${propertyId}`}
    />
  );
}
