// app/h/[property_id]/guest/prospects/page.tsx
// PBS 2026-07-08: Tenant delegate — mounts the Namkhan Prospects body with propertyId scoping.

import { notFound } from 'next/navigation';
import ContactsProspectsBody from '@/app/guest/prospects/page';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default function TenantContactsProspectsPage({
  params,
}: {
  params: { property_id: string };
}) {
  const pid = Number(params.property_id);
  if (!Number.isFinite(pid)) notFound();
  return <ContactsProspectsBody propertyId={pid} />;
}
