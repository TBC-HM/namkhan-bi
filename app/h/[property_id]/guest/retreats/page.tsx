// app/h/[property_id]/guest/retreats/page.tsx
// PBS 2026-07-22 · Tenant delegate — mounts the canonical /guest/retreats catalog
// with propertyId scoping. Same delegation pattern used across the tenant tree.
// Newsletter Module backlog §12.5.

import { notFound } from 'next/navigation';
import RetreatsCatalogBody from '@/app/guest/retreats/page';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default function TenantRetreatsCatalogPage({
  params,
}: {
  params: { property_id: string };
}) {
  const pid = Number(params.property_id);
  if (!Number.isFinite(pid)) notFound();
  return <RetreatsCatalogBody propertyId={pid} />;
}
