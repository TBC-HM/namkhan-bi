// app/h/[property_id]/revenue/demand/page.tsx
// 2026-05-20: delegate to shared primitives body — both properties identical tree.

import { notFound } from 'next/navigation';
import DemandBody from '@/app/revenue/demand/page';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default function PropertyDemandPage({
  params,
  searchParams,
}: {
  params: { property_id: string };
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  const propertyId = Number(params.property_id);
  if (!Number.isFinite(propertyId)) notFound();
  return <DemandBody propertyId={propertyId} searchParams={searchParams ?? {}} />;
}
