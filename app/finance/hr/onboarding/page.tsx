// app/finance/hr/onboarding/page.tsx — redirect into /finance/hr/lifecycle?view=onboarding
// PBS 2026-05-15: onboarding + offboarding merged into a single Lifecycle tab.
import { redirect } from 'next/navigation';

export default function FinanceHrOnboardingRedirect() {
  redirect('/finance/hr/lifecycle?view=onboarding');
}
