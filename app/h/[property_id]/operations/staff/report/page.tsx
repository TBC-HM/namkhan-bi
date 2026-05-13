// app/h/[property_id]/operations/staff/report/page.tsx — property-scoped
import ReportTabContent from '../../../../../operations/staff/_components/ReportTabContent';
import { NAMKHAN_PROPERTY_ID, DONNA_PROPERTY_ID } from '@/lib/dept-cfg/by-property';

export const revalidate = 60;
export const dynamic = 'force-dynamic';

const PROPERTY_LABELS: Record<number, string> = {
  [NAMKHAN_PROPERTY_ID]: 'Namkhan',
  [DONNA_PROPERTY_ID]:   'Donna Portals',
};

export default async function StaffReportScoped({ params }: { params: { property_id: string } }) {
  const propertyId = Number(params.property_id);
  if (!Number.isFinite(propertyId)) {
    return <ReportTabContent propertyId={NAMKHAN_PROPERTY_ID} propertyLabel="Namkhan" />;
  }
  return (
    <ReportTabContent
      propertyId={propertyId}
      propertyLabel={PROPERTY_LABELS[propertyId] ?? `Property ${propertyId}`}
    />
  );
}
