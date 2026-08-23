// app/h/[property_id]/guest/newsletters/templates/page.tsx
// PBS 2026-08-23 · Donna tenant delegate — mounts TemplatesListPage body with
// propertyId scoping. Replaces DeptSubpageStub so Donna operators see their
// own template library.

import { notFound } from 'next/navigation';
import TemplatesBody from '@/app/guest/newsletters/templates/page';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default function DonnaNewslettersTemplates({ params }: { params: { property_id: string } }) {
  const pid = Number(params.property_id);
  if (!Number.isFinite(pid)) notFound();
  return <TemplatesBody propertyId={pid} />;
}
