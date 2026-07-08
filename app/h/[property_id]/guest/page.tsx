// app/h/[property_id]/guest/page.tsx
// PBS 2026-07-08: Donna Contacts HoD uses the shared HodLanding primitive so
// the layout mirrors Namkhan (structure not data). Sub-strip is auto-rendered.
//
// Namkhan /guest is hand-rolled with 4 rule engines (retention · reputation ·
// newsletter · observations) reading Namkhan-scoped data. Donna renders the
// same 6-tile / 4-container / conclusions / build-a-report SHAPE via HodLanding
// with empty insights until Donna-scoped rule wiring lands.

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
  return (
    <HodLanding
      slug="guest"
      propertyId={pid}
      conclusions={{
        insights: [],
        title: 'CONCLUSIONS · retention · reputation · newsletter · observations',
        subtitle: `Donna · property_id=${pid} · awaiting Donna-scoped rule wiring (structure mirrors Namkhan)`,
        emptyText: 'Everything nominal. No contacts alarms firing.',
      }}
    />
  );
}
