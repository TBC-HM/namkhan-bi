// app/h/[property_id]/revenue/parity/page.tsx
// PBS 2026-07-07: property-scoped mount of the parity deep-dive.
// Delegates to the shared Namkhan renderer (which now reads v_parity_summary_pb
// + v_parity_matrix_pb filtered by property_id) instead of the DonnaRevenueCanonical
// empty-state scaffold. Removes the 26x "Donna PMS feed pending" placeholder spam
// — Donna renders real zero-state tiles + empty tables until parity shopping runs
// on that property. Namkhan short-circuits back to /revenue/parity.

import { redirect, notFound } from 'next/navigation';
import { NAMKHAN_PROPERTY_ID } from '@/lib/dept-cfg/by-property';
import ParityPage from '@/app/revenue/parity/page';

export const dynamic = 'force-dynamic';
export const revalidate = 60;

export default function PropertyParityPage({
  params,
  searchParams,
}: {
  params: { property_id: string };
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  const propertyId = Number(params.property_id);
  if (!Number.isFinite(propertyId)) notFound();
  if (propertyId === NAMKHAN_PROPERTY_ID) redirect('/revenue/parity');

  return <ParityPage propertyId={propertyId} searchParams={searchParams ?? {}} />;
}
