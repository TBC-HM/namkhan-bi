// app/h/[property_id]/revenue/pricing/page.tsx
// Property-scoped Calendar page. Delegates to the canonical 7-tab pricing hub
// at /revenue/pricing with propertyId injected, so Donna gets the same surface
// as Namkhan (Pricing · Holidays · OTB Density · Pickup · Rate · Restrictions · Parity).
// 2026-05-22: replaced the DonnaRevenueCanonical empty-state stub with the real wiring.

import { redirect, notFound } from 'next/navigation';
import { NAMKHAN_PROPERTY_ID } from '@/lib/dept-cfg/by-property';
import PricingPage from '@/app/revenue/pricing/page';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

interface SearchParams {
  win?: string;
  gran?: string;
  cmp?: string;
  tab?: string;
  y?: string;
  school?: string;
}

export default function PropertyPricingPage({
  params,
  searchParams,
}: {
  params: { property_id: string };
  searchParams?: SearchParams;
}) {
  const propertyId = Number(params.property_id);
  if (!Number.isFinite(propertyId)) notFound();
  // Namkhan canonicalised under /revenue/pricing.
  if (propertyId === NAMKHAN_PROPERTY_ID) redirect('/revenue/pricing');

  return <PricingPage propertyId={propertyId} searchParams={searchParams ?? {}} />;
}
