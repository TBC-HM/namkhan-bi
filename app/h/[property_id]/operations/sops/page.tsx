// app/h/[property_id]/operations/sops/page.tsx
// PBS 2026-07-08: Donna delegate — passes propertyId to the Namkhan SOPs page.

import { notFound } from 'next/navigation';
import OperationsSopsBody from '@/app/operations/sops/page';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default function PropertySopsPage({
  params,
}: {
  params: { property_id: string };
}) {
  const pid = Number(params.property_id);
  if (!Number.isFinite(pid)) notFound();
  return <OperationsSopsBody propertyId={pid} />;
}
