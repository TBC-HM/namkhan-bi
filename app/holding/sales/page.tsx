// app/holding/sales/page.tsx
// Holding · Sales landing — v1 has one surface: the onboarding pipeline
// (brief onboarding-engine-v1). Redirect until more sales sub-pages exist.
import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

export default function HoldingSalesPage() {
  redirect('/holding/sales/onboarding');
}
