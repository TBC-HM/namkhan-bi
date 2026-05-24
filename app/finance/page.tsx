// app/finance/page.tsx
// PBS #204 — Finance HoD landing on shared primitive (matches /revenue).
import HodLanding from '@/app/_components/HodLanding';
export const dynamic = 'force-dynamic';
export default function FinancePage() {
  return <HodLanding slug="finance" />;
}
