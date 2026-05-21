// app/h/[property_id]/revenue/legacy2/page.tsx
// Property-scoped delegate for the frozen HoD legacy2 snapshot.

import { notFound } from 'next/navigation';
import RevenueHoDLegacy2 from '@/app/revenue/legacy2/page';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default function PropertyRevenueHoDLegacy2Page({
  params,
}: {
  params: { property_id: string };
}) {
  const propertyId = Number(params.property_id);
  if (!Number.isFinite(propertyId)) notFound();
  return <RevenueHoDLegacy2 propertyId={propertyId} />;
}
