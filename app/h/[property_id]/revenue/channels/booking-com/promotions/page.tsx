// app/h/[property_id]/revenue/channels/booking-com/promotions/page.tsx
// PBS 2026-08-25: real per-property surface (was a wiring-pending stub).
import { notFound } from 'next/navigation';
import PromotionsSurface from '@/app/revenue/channels/_components/PromotionsSurface';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default function PropertyBookingComPromotionsPage({ params }: { params: { property_id: string } }) {
  const pid = Number(params.property_id);
  if (!Number.isFinite(pid) || pid <= 0) notFound();
  return <PromotionsSurface slug="booking-com" propertyId={pid} />;
}
