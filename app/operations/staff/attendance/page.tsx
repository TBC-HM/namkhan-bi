// app/operations/staff/attendance/page.tsx — Namkhan default (Attendance tab inside Staff)
import AttendanceTabContent from '../_components/AttendanceTabContent';
import { NAMKHAN_PROPERTY_ID } from '@/lib/dept-cfg/by-property';

export const revalidate = 60;
export const dynamic = 'force-dynamic';

export default async function StaffAttendancePage() {
  return <AttendanceTabContent propertyId={NAMKHAN_PROPERTY_ID} propertyLabel="Namkhan" />;
}
