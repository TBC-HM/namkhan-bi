// app/h/[property_id]/operations/qa/proposals/page.tsx
// PBS 2026-07-08: Donna delegate — passes propertyId into the shared Proposals page.

import { notFound } from 'next/navigation';
import ProposalsBody from '@/app/operations/qa/proposals/page';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default function PropertySopProposalsPage({
  params,
}: {
  params: { property_id: string };
}) {
  const pid = Number(params.property_id);
  if (!Number.isFinite(pid)) notFound();
  return <ProposalsBody propertyId={pid} />;
}
