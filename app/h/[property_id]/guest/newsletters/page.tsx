// app/h/[property_id]/guest/newsletters/page.tsx
// PBS 2026-07-21 · tenant delegate — mounts the canonical Newsletters body
// with propertyId scoping. Same delegation pattern used across the tenant tree.

import { notFound } from 'next/navigation';
import NewslettersBody from '@/app/guest/newsletters/page';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default function TenantNewslettersPage({
  params,
}: {
  params: { property_id: string };
}) {
  const pid = Number(params.property_id);
  if (!Number.isFinite(pid)) notFound();
  return <NewslettersBody propertyId={pid} />;
}
