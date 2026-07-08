// app/h/[property_id]/guest/page.tsx
// PBS 2026-07-08: Donna Contacts HoD uses the shared HodLanding primitive so
// the layout mirrors Namkhan (structure not data). Sub-strip is auto-rendered.

import { redirect, notFound } from 'next/navigation';
import HodLanding from '@/app/_components/HodLanding';
import { NAMKHAN_PROPERTY_ID } from '@/lib/dept-cfg/by-property';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default function DonnaContactsHod({
  params,
}: {
  params: { property_id: string };
}) {
  const pid = Number(params.property_id);
  if (!Number.isFinite(pid)) notFound();
  if (pid === NAMKHAN_PROPERTY_ID) redirect('/guest');
  return <HodLanding slug="guest" propertyId={pid} />;
}
