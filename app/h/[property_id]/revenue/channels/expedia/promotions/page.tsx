// app/h/[property_id]/revenue/channels/expedia/promotions/page.tsx
// PBS 2026-08-25: was a DeptSubpageStub that redirected Namkhan to the legacy
// tree and showed Donna a "wiring pending" card. channel_promotions is already
// per-property, so there was nothing to wire — this now renders the real
// surface for whatever property the URL names. No fallback (L22).
import { notFound } from 'next/navigation';
import PromotionsSurface from '@/app/revenue/channels/_components/PromotionsSurface';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default function PropertyExpediaPromotionsPage({ params }: { params: { property_id: string } }) {
  const pid = Number(params.property_id);
  if (!Number.isFinite(pid) || pid <= 0) notFound();
  return <PromotionsSurface slug="expedia" propertyId={pid} />;
}
