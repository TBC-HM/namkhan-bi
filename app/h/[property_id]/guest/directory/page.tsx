// app/h/[property_id]/guest/directory/page.tsx
// PBS 2026-07-08: Tenant delegate — mounts Namkhan Directory body with propertyId scoping.

import { notFound } from 'next/navigation';
import GuestDirectoryBody from '@/app/guest/directory/page';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default function TenantGuestDirectoryPage({
  params,
}: {
  params: { property_id: string };
}) {
  const pid = Number(params.property_id);
  if (!Number.isFinite(pid)) notFound();
  return <GuestDirectoryBody propertyId={pid} />;
}
