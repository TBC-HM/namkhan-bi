// app/h/[property_id]/guest/newsletters/sequences/page.tsx
// PBS 2026-07-21: Tenant delegate — mounts Namkhan sequences body with propertyId scoping.
// Mirrors the pattern used by /h/[property_id]/guest/newsletters/page.tsx.

import { notFound } from 'next/navigation';
import SequencesBody from '@/app/guest/newsletters/sequences/page';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default function TenantSequencesPage({
  params,
}: {
  params: { property_id: string };
}) {
  const pid = Number(params.property_id);
  if (!Number.isFinite(pid)) notFound();
  return <SequencesBody propertyId={pid} />;
}
