// app/h/[property_id]/operations/staff/schedule/page.tsx — HR routes moved to /h/[property_id]/finance/hr/schedule
import { redirect } from 'next/navigation';
export default function StaffRedirect({ params }: { params: { property_id: string } }) {
  redirect(`/h/${params.property_id}/finance/hr/schedule`);
}
