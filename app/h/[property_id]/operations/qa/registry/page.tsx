// app/h/[property_id]/operations/qa/registry/page.tsx
// PBS 2026-07-08: Donna delegate for QA · Registry. Delegates to the shared
// server component, forwarding propertyId.

import { notFound } from 'next/navigation';
import QaRegistryBody from '@/app/operations/qa/registry/page';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default function PropertyQaRegistryPage({
  params,
}: {
  params: { property_id: string };
}) {
  const pid = Number(params.property_id);
  if (!Number.isFinite(pid)) notFound();
  return <QaRegistryBody propertyId={pid} />;
}
