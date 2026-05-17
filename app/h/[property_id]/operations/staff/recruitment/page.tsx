// app/h/[property_id]/operations/staff/recruitment/page.tsx — HR routes moved to /h/[property_id]/finance/hr/recruitment
import { redirect } from 'next/navigation';
export default function StaffRedirect({ params }: { params: { property_id: string } }) {
  redirect(`/h/${params.property_id}/finance/hr/recruitment`);
}
