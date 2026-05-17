// app/h/[property_id]/finance/hr/attendance/page.tsx — property-scoped Attendance under HR/Finance
import { notFound } from 'next/navigation';
import AttendanceTabContent from '@/app/operations/staff/_components/AttendanceTabContent';
import { financeSubPagesForProperty } from '@/app/finance/_subpages';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const KNOWN_LABEL: Record<number, string> = { 260955: 'Namkhan', 1000001: 'Donna' };

export default async function PropertyFinanceHrAttendancePage({ params }: { params: { property_id: string } }) {
  const propertyId = Number(params.property_id);
  if (!KNOWN_LABEL[propertyId]) notFound();
  return (
    <AttendanceTabContent
      propertyId={propertyId}
      propertyLabel={KNOWN_LABEL[propertyId]}
      subPagesOverride={financeSubPagesForProperty(propertyId)}
    />
  );
}
