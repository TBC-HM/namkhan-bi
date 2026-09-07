// app/h/[property_id]/marketing/social/tripadvisor/page.tsx
// Tenant delegate — mounts the TripAdvisor analytics body from _impl.tsx
// with the property_id from the route param.
import { notFound } from 'next/navigation';
import TripAdvisorBody from '@/app/marketing/social/tripadvisor/_impl';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

interface Params { property_id: string }
type Sp = Record<string, string | string[] | undefined>;

export default function TenantTripAdvisorPage({
  params,
  searchParams,
}: {
  params: Params;
  searchParams?: Sp;
}) {
  const pid = Number(params.property_id);
  if (!Number.isFinite(pid)) notFound();
  return <TripAdvisorBody propertyId={pid} searchParams={searchParams ?? {}} />;
}
