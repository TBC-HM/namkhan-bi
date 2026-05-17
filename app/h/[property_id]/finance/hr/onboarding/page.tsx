// app/h/[property_id]/finance/hr/onboarding/page.tsx — redirect into Lifecycle
import { redirect } from 'next/navigation';

export default function PropertyHrOnboardingRedirect({ params }: { params: { property_id: string } }) {
  redirect(`/h/${params.property_id}/finance/hr/lifecycle?view=onboarding`);
}
