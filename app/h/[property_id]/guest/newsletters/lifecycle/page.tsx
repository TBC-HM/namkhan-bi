// app/h/[property_id]/guest/newsletters/lifecycle/page.tsx
// PBS 2026-08-23 · Donna tenant delegate — mounts LifecyclePage body with
// propertyId scoping. Replaces DeptSubpageStub so Donna operators see their
// own lifecycle campaigns.

import { notFound } from 'next/navigation';
import LifecycleBody from '@/app/guest/newsletters/lifecycle/page';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default function DonnaNewslettersLifecycle({ params }: { params: { property_id: string } }) {
  const pid = Number(params.property_id);
  if (!Number.isFinite(pid)) notFound();
  return <LifecycleBody propertyId={pid} />;
}
