// app/revenue/channels/booking-com/promotions/page.tsx
// PBS 2026-07-07: Booking.com promotion activation. State is source-of-truth
// for the "Genius" and "Mobile" columns on the day report.
// PBS 2026-08-25: body moved to PromotionsSurface (one implementation for all
// OTAs). Legacy unprefixed tree = Namkhan; property stated, never defaulted.
// Property-scoped entry point: /h/<property_id>/revenue/channels/booking-com/promotions

import { NAMKHAN_PROPERTY_ID } from '@/lib/dept-cfg/by-property';
import PromotionsSurface from '../../_components/PromotionsSurface';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default function BookingComPromotionsPage() {
  return <PromotionsSurface slug="booking-com" propertyId={NAMKHAN_PROPERTY_ID} />;
}
