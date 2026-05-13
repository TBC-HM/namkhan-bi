// app/operations/staff/[staffId]/page.tsx — Namkhan default
import StaffDetailContent from '../_components/StaffDetailContent';
import { NAMKHAN_PROPERTY_ID } from '@/lib/dept-cfg/by-property';

export const revalidate = 60;
export const dynamic = 'force-dynamic';

export default async function StaffDetailPage({ params }: { params: { staffId: string } }) {
  return (
    <StaffDetailContent
      staffId={params.staffId}
      propertyId={NAMKHAN_PROPERTY_ID}
      propertyLabel="Namkhan"
    />
  );
}
