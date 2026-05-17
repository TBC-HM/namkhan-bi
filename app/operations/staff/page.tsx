// app/operations/staff/page.tsx — HR routes moved to /finance/hr
import { redirect } from 'next/navigation';
export default function StaffRedirect() {
  redirect('/finance/hr');
}
