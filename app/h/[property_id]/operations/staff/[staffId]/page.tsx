// app/h/[property_id]/operations/staff/[staffId]/page.tsx — property-scoped
import StaffDetailContent from '../../../../../operations/staff/_components/StaffDetailContent';
import { NAMKHAN_PROPERTY_ID, DONNA_PROPERTY_ID } from '@/lib/dept-cfg/by-property';

export const revalidate = 60;
export const dynamic = 'force-dynamic';

const PROPERTY_LABELS: Record<number, string> = {
  [NAMKHAN_PROPERTY_ID]: 'Namkhan',
  [DONNA_PROPERTY_ID]:   'Donna Portals',
};

export default async function StaffDetailScopedPage({
  params,
}: {
  params: { property_id: string; staffId: string };
}) {
  const propertyId = Number(params.property_id);
  const safeId = Number.isFinite(propertyId) ? propertyId : NAMKHAN_PROPERTY_ID;
  return (
    <StaffDetailContent
      staffId={params.staffId}
      propertyId={safeId}
      propertyLabel={PROPERTY_LABELS[safeId] ?? `Property ${safeId}`}
    />
  );
}
