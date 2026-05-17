// app/operations/staff/data/page.tsx — HR routes moved to /finance/hr/data
import { redirect } from 'next/navigation';
export default function StaffRedirect() {
  redirect('/finance/hr/data');
}
