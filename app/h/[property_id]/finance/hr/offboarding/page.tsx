// app/h/[property_id]/finance/hr/offboarding/page.tsx — redirect into Lifecycle
import { redirect } from 'next/navigation';

export default function PropertyHrOffboardingRedirect({ params }: { params: { property_id: string } }) {
  redirect(`/h/${params.property_id}/finance/hr/lifecycle?view=offboarding`);
}
