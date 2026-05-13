// app/operations/staff/report/page.tsx — Namkhan default (Report tab)
import ReportTabContent from '../_components/ReportTabContent';
import { NAMKHAN_PROPERTY_ID } from '@/lib/dept-cfg/by-property';

export const revalidate = 60;
export const dynamic = 'force-dynamic';

export default async function StaffReportPage() {
  return <ReportTabContent propertyId={NAMKHAN_PROPERTY_ID} propertyLabel="Namkhan" />;
}
