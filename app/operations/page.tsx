// app/operations/page.tsx
// PBS #204 — Operations HoD landing on shared primitive.
import HodLanding from '@/app/_components/HodLanding';
export const dynamic = 'force-dynamic';
export default function OperationsPage() {
  return <HodLanding slug="operations" />;
}
