// app/operations/staff/recruitment/page.tsx — HR routes moved to /finance/hr/recruitment
import { redirect } from 'next/navigation';
export default function StaffRedirect() {
  redirect('/finance/hr/recruitment');
}
