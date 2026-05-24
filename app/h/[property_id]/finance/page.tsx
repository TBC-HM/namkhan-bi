// app/h/[property_id]/finance/page.tsx
// PBS #204 (2026-05-25) — property-scoped wrapper delegates to the
// shared HodLanding primitive. Same chrome on Namkhan (260955) and
// Donna (1000001). HodLanding swaps cfg via getDeptCfg(slug, pid).

import HodLanding from '@/app/_components/HodLanding';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default function FinanceHoDByProperty({ params }: { params: { property_id: string } }) {
  const propertyId = Number(params.property_id);
  return <HodLanding slug="finance" propertyId={propertyId} />;
}
