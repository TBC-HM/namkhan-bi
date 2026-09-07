// app/revenue/channels/[source]/promotions/page.tsx
// PBS 2026-07-09 pm: dynamic promotions page — one per OTA source.
// Static routes for booking-com + expedia still win over this dynamic route
// (Next.js resolves static segments first); since PBS 2026-08-25 all three
// render the same PromotionsSurface, so the shadowing is cosmetic.
// Legacy unprefixed tree = Namkhan; property stated, never defaulted.

import { notFound } from 'next/navigation';
import { otaChannelForSlug } from '@/lib/ota-promotions';
import { NAMKHAN_PROPERTY_ID } from '@/lib/dept-cfg/by-property';
import PromotionsSurface from '../../_components/PromotionsSurface';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default function DynamicPromotionsPage({ params }: { params: { source: string } }) {
  if (!otaChannelForSlug(params.source)) notFound();
  return <PromotionsSurface slug={params.source} propertyId={NAMKHAN_PROPERTY_ID} />;
}
