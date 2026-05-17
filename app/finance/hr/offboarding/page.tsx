// app/finance/hr/offboarding/page.tsx — redirect into /finance/hr/lifecycle?view=offboarding
// PBS 2026-05-15: onboarding + offboarding merged into a single Lifecycle tab.
import { redirect } from 'next/navigation';

export default function FinanceHrOffboardingRedirect() {
  redirect('/finance/hr/lifecycle?view=offboarding');
}
