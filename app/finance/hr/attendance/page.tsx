// app/finance/hr/attendance/page.tsx — Namkhan default (Attendance under HR/Finance)
import AttendanceTabContent from '@/app/operations/staff/_components/AttendanceTabContent';
import { NAMKHAN_PROPERTY_ID } from '@/lib/dept-cfg/by-property';
import { FINANCE_SUBPAGES } from '@/app/finance/_subpages';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function FinanceHrAttendancePage() {
  return (
    <AttendanceTabContent
      propertyId={NAMKHAN_PROPERTY_ID}
      propertyLabel="Namkhan"
      subPagesOverride={FINANCE_SUBPAGES}
    />
  );
}
