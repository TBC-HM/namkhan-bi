// app/h/[property_id]/marketing/media/page.tsx
// PBS 2026-07-12 — property-scoped delegate for /marketing/media.
// Mounts the flat MarketingMediaPage with the property_id from the route.
import MarketingMediaPage from '@/app/marketing/media/page';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function DonnaMediaPage({ params }: { params: Promise<{ property_id: string }> }) {
  const { property_id } = await params;
  const pid = Number(property_id);
  return <MarketingMediaPage propertyId={Number.isFinite(pid) ? pid : undefined} />;
}
