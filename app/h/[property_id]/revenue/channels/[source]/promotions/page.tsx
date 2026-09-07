// app/h/[property_id]/revenue/channels/[source]/promotions/page.tsx
// PBS 2026-08-25: property-scoped promotions for the OTAs that had no /h route
// at all (agoda, trip-com, tiket). Static expedia/booking-com siblings win for
// their slugs; this covers the rest. No property fallback (L22).
import { notFound } from 'next/navigation';
import { otaChannelForSlug } from '@/lib/ota-promotions';
import PromotionsSurface from '@/app/revenue/channels/_components/PromotionsSurface';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default function PropertySourcePromotionsPage({
  params,
}: { params: { property_id: string; source: string } }) {
  const pid = Number(params.property_id);
  if (!Number.isFinite(pid) || pid <= 0) notFound();
  if (!otaChannelForSlug(params.source)) notFound();
  return <PromotionsSurface slug={params.source} propertyId={pid} />;
}
