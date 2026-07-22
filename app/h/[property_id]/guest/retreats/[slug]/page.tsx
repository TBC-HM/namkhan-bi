// app/h/[property_id]/guest/retreats/[slug]/page.tsx
// PBS 2026-07-22 · Tenant delegate — mounts the canonical retreat detail page
// with propertyId scoping. Newsletter Module backlog §12.5.

import { notFound } from 'next/navigation';
import RetreatDetailBody from '@/app/guest/retreats/[slug]/page';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default function TenantRetreatDetailPage({
  params,
}: {
  params: { property_id: string; slug: string };
}) {
  const pid = Number(params.property_id);
  if (!Number.isFinite(pid)) notFound();
  return <RetreatDetailBody params={{ slug: params.slug }} propertyId={pid} />;
}
