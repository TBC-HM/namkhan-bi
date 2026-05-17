// app/h/[property_id]/revenue/compset/page.tsx
// Donna canonical Revenue · Comp-set — full canonical layout, empty-state data
// until Donna PMS/booking feed is wired. Namkhan redirects to legacy.

import { redirect } from 'next/navigation';
import { NAMKHAN_PROPERTY_ID } from '@/lib/dept-cfg/by-property';
import DonnaRevenueCanonical from '../_DonnaRevenueCanonical';
import { REVENUE_SURFACES } from '../_surfaces';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default function DonnaRevenueCompsetPage({
  params,
  searchParams,
}: {
  params: { property_id: string };
  searchParams?: { win?: string; cmp?: string };
}) {
  const propertyId = Number(params.property_id);
  if (propertyId === NAMKHAN_PROPERTY_ID) redirect('/revenue/compset');

  return (
    <DonnaRevenueCanonical
      propertyId={propertyId}
      win={searchParams?.win}
      cmp={searchParams?.cmp}
      cfg={REVENUE_SURFACES.compset}
    />
  );
}
