// app/h/[property_id]/guest/newsletters/page.tsx
// PBS 2026-07-08: Tenant delegate — mounts Namkhan Newsletters body with propertyId scoping.

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
