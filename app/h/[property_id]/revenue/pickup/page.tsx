// app/h/[property_id]/revenue/pickup/page.tsx
// Property-scoped delegate — both Namkhan and Donna render the same tree.

import { notFound } from 'next/navigation';
import PickupBody from '@/app/revenue/pickup/page';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default function PropertyPickupPage({
  params,
}: {
  params: { property_id: string };
}) {
  const propertyId = Number(params.property_id);
  if (!Number.isFinite(propertyId)) notFound();
  return <PickupBody propertyId={propertyId} />;
}
