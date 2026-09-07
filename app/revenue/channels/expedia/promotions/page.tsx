// app/revenue/channels/expedia/promotions/page.tsx
// PBS 2026-07-07: Expedia promotion activation.
// PBS 2026-08-25: body moved to PromotionsSurface (one implementation for all
// OTAs). This route is the LEGACY UNPREFIXED tree, which is Namkhan-only by
// construction — the property is stated explicitly, not defaulted.
// Property-scoped entry point: /h/<property_id>/revenue/channels/expedia/promotions

import { NAMKHAN_PROPERTY_ID } from '@/lib/dept-cfg/by-property';
import PromotionsSurface from '../../_components/PromotionsSurface';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default function ExpediaPromotionsPage() {
  return <PromotionsSurface slug="expedia" propertyId={NAMKHAN_PROPERTY_ID} />;
}
