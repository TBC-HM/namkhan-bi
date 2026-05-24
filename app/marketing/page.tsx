// app/marketing/page.tsx
// PBS #204 — Marketing HoD landing on shared primitive.
import HodLanding from '@/app/_components/HodLanding';
export const dynamic = 'force-dynamic';
export default function MarketingPage() {
  return <HodLanding slug="marketing" />;
}
