// app/h/[property_id]/marketing/overview/page.tsx
// PBS 2026-07-11 pm — property-scoped delegate for /marketing/overview.
// Mounts the flat MarketingOverviewPage with the property_id from the route.
import MarketingOverviewPage from '@/app/marketing/overview/page';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function ScopedMarketingOverviewPage({ params }: { params: Promise<{ property_id: string }> }) {
  const { property_id } = await params;
  const pid = Number(property_id);
  return <MarketingOverviewPage propertyId={Number.isFinite(pid) ? pid : undefined} />;
}
