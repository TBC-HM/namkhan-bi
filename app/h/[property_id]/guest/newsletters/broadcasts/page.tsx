// app/h/[property_id]/guest/newsletters/broadcasts/page.tsx
// PBS 2026-08-23 · Donna tenant delegate — mounts BroadcastsPage body with
// propertyId scoping. Replaces DeptSubpageStub so Donna operators see their
// own broadcast campaigns (not Namkhan's).

import { notFound } from 'next/navigation';
import BroadcastsBody from '@/app/guest/newsletters/broadcasts/page';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default function DonnaNewslettersBroadcasts({ params }: { params: { property_id: string } }) {
  const pid = Number(params.property_id);
  if (!Number.isFinite(pid)) notFound();
  return <BroadcastsBody propertyId={pid} />;
}
