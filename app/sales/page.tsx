// app/sales/page.tsx
// PBS #204 — Sales HoD landing on shared primitive.
import HodLanding from '@/app/_components/HodLanding';
export const dynamic = 'force-dynamic';
export default function SalesPage() {
  return <HodLanding slug="sales" />;
}
