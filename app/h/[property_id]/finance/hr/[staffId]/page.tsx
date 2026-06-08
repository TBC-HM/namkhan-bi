// app/h/[property_id]/finance/hr/[staffId]/page.tsx — property-scoped HR detail
// PBS 2026-06-08 #135 — mirror of /h/[property_id]/operations/staff/[staffId]
// so the back-link from the HR register lands here and keeps the Finance strip.
import StaffDetailContent from '@/app/operations/staff/_components/StaffDetailContent';
import { NAMKHAN_PROPERTY_ID, DONNA_PROPERTY_ID } from '@/lib/dept-cfg/by-property';

export const revalidate = 60;
export const dynamic = 'force-dynamic';

const PROPERTY_LABELS: Record<number, string> = {
  [NAMKHAN_PROPERTY_ID]: 'Namkhan',
  [DONNA_PROPERTY_ID]:   'Donna Portals',
};

export default async function StaffDetailHrScopedPage({
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
