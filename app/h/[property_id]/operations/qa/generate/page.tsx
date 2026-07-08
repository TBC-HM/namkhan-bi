// app/h/[property_id]/operations/qa/generate/page.tsx
// PBS 2026-07-07: Donna delegate — passes propertyId into the shared Generate page.

import { notFound } from 'next/navigation';
import GenerateBody from '@/app/operations/qa/generate/page';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default function PropertyGenerateSopPage({
  params,
}: {
  params: { property_id: string };
}) {
  const pid = Number(params.property_id);
  if (!Number.isFinite(pid)) notFound();
  return <GenerateBody propertyId={pid} />;
}
