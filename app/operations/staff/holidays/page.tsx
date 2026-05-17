// app/operations/staff/holidays/page.tsx — HR routes moved to /finance/hr/holidays
import { redirect } from 'next/navigation';
export default function StaffRedirect() {
  redirect('/finance/hr/holidays');
}
