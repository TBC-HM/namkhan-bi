// app/operations/attendance/page.tsx — Namkhan default
import AttendancePageContent from './_components/AttendancePageContent';
import { NAMKHAN_PROPERTY_ID } from '@/lib/dept-cfg/by-property';

export const revalidate = 60;
export const dynamic = 'force-dynamic';

export default async function AttendancePage() {
  return <AttendancePageContent propertyId={NAMKHAN_PROPERTY_ID} propertyLabel="Namkhan" />;
}
