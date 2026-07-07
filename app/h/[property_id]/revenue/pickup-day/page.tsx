// app/h/[property_id]/revenue/pickup-day/page.tsx
// Property-scoped delegate — both Namkhan and Donna render the same tree.
// Mirrors app/h/[property_id]/revenue/pickup/page.tsx pattern.

import { notFound } from 'next/navigation';
import PickupDayBody from '@/app/revenue/pickup-day/page';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default function PropertyPickupDayPage({
  params,
}: {
  params: { property_id: string };
}) {
  const propertyId = Number(params.property_id);
  if (!Number.isFinite(propertyId)) notFound();
  return <PickupDayBody propertyId={propertyId} />;
}
