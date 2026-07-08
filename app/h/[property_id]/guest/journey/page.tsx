// app/h/[property_id]/guest/journey/page.tsx
// PBS 2026-07-07 — Tenant delegate for guest journey (task #86).

import { notFound } from 'next/navigation';
import GuestJourneyBody from '@/app/guest/journey/page';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default function TenantGuestJourneyPage({
  params, searchParams,
}: {
  params: { property_id: string };
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const pid = Number(params.property_id);
  if (!Number.isFinite(pid)) notFound();
  return <GuestJourneyBody searchParams={searchParams} propertyId={pid} />;
}
