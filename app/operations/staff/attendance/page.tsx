// app/operations/staff/attendance/page.tsx — HR routes moved to /finance/hr/attendance
import { redirect } from 'next/navigation';
export default function StaffRedirect() {
  redirect('/finance/hr/attendance');
}
