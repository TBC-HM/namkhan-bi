// app/h/[property_id]/guest/reputation/page.tsx
// PBS 2026-07-08: Tenant delegate for guest reputation.

import { notFound } from 'next/navigation';
import GuestReputationBody from '@/app/guest/reputation/page';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default function TenantGuestReputationPage({
  params, searchParams,
}: {
  params: { property_id: string };
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const pid = Number(params.property_id);
  if (!Number.isFinite(pid)) notFound();
  return <GuestReputationBody searchParams={searchParams} propertyId={pid} />;
}
