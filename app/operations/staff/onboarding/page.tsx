// app/operations/staff/onboarding/page.tsx — HR routes moved to /finance/hr/onboarding
import { redirect } from 'next/navigation';
export default function StaffRedirect() {
  redirect('/finance/hr/onboarding');
}
