// app/h/[property_id]/revenue/briefing/page.tsx
// PBS 2026-07-15 — property-scoped mount of the Revenue Briefing page.
// Delegates to the shared Namkhan renderer with propertyId filtering so
// Donna + any future property gets the same inbox once guardrails ingest
// items for their property_id. Namkhan short-circuits back to /revenue/briefing.

import { redirect, notFound } from 'next/navigation';
import { NAMKHAN_PROPERTY_ID } from '@/lib/dept-cfg/by-property';
import RevenueBriefingPage from '@/app/revenue/briefing/page';

export const dynamic = 'force-dynamic';
export const revalidate = 30;

export default function PropertyRevenueBriefingPage({
  params,
  searchParams,
}: {
  params: { property_id: string };
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  const propertyId = Number(params.property_id);
  if (!Number.isFinite(propertyId)) notFound();
  if (propertyId === NAMKHAN_PROPERTY_ID) redirect('/revenue/briefing');

  return <RevenueBriefingPage propertyId={propertyId} searchParams={searchParams ?? {}} />;
}
