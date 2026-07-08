// app/h/[property_id]/guest/behaviour/page.tsx
// PBS 2026-07-08: Tenant delegate — mounts Namkhan Behaviour body with propertyId scoping.

import { notFound } from 'next/navigation';
import GuestBehaviourBody from '@/app/guest/behaviour/page';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default function TenantGuestBehaviourPage({
  params, searchParams,
}: {
  params: { property_id: string };
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const pid = Number(params.property_id);
  if (!Number.isFinite(pid)) notFound();
  return <GuestBehaviourBody searchParams={searchParams} propertyId={pid} />;
}
