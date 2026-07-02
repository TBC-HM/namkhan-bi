// app/h/[property_id]/revenue/cancellations/page.tsx
// PBS 2026-07-03: property-scoped mount of the cancellations deep-dive.
// Thin wrapper — hands off to the shared CancellationsPage renderer.

import CancellationsPage from '@/app/revenue/cancellations/page';

export const dynamic = 'force-dynamic';
export const revalidate = 60;

export default async function PropertyCancellations({
  params,
  searchParams,
}: {
  params: { property_id: string };
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const pid = Number(params.property_id);
  return <CancellationsPage searchParams={searchParams} propertyId={pid} />;
}
