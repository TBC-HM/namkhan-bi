// app/operations/staff/schedule/page.tsx — HR routes moved to /finance/hr/schedule
import { redirect } from 'next/navigation';
export default function StaffRedirect() {
  redirect('/finance/hr/schedule');
}
