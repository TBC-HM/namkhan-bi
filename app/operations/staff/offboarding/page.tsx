// app/operations/staff/offboarding/page.tsx — HR routes moved to /finance/hr/offboarding
import { redirect } from 'next/navigation';
export default function StaffRedirect() {
  redirect('/finance/hr/offboarding');
}
