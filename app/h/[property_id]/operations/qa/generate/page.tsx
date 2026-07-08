// app/h/[property_id]/operations/qa/generate/page.tsx
// PBS 2026-07-07 · 2026-07-08: Donna delegate — passes propertyId + searchParams
// into the shared Generate page (which now accepts dept / purpose / proposal_id).

import { notFound } from 'next/navigation';
import GenerateBody from '@/app/operations/qa/generate/page';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default function PropertyGenerateSopPage({
  params,
  searchParams,
}: {
  params: { property_id: string };
  searchParams?: { dept?: string; purpose?: string; proposal_id?: string };
}) {
  const pid = Number(params.property_id);
  if (!Number.isFinite(pid)) notFound();
  return <GenerateBody propertyId={pid} searchParams={searchParams} />;
}
