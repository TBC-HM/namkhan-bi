// app/h/[property_id]/operations/page.tsx
// PBS #204 (2026-05-25) — property-scoped wrapper delegates to the
// shared HodLanding primitive. Same chrome on Namkhan and Donna.

import HodLanding from '@/app/_components/HodLanding';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default function OperationsHoDByProperty({ params }: { params: { property_id: string } }) {
  const propertyId = Number(params.property_id);
  return <HodLanding slug="operations" propertyId={propertyId} />;
}
