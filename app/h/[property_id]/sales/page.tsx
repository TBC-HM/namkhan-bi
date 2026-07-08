// app/h/[property_id]/sales/page.tsx
// PBS #204 (2026-05-25) — property-scoped wrapper delegates to the
// shared HodLanding primitive. Same chrome on Namkhan and Donna.
//
// PBS 2026-07-08 — structural mirror: pass empty conclusions so the
// CONCLUSIONS container renders on Donna URLs at parity with Namkhan
// /sales (which evaluates live sales rules). Structure not data.

import { redirect, notFound } from 'next/navigation';
import HodLanding from '@/app/_components/HodLanding';
import { NAMKHAN_PROPERTY_ID } from '@/lib/dept-cfg/by-property';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default function SalesHoDByProperty({ params }: { params: { property_id: string } }) {
  const pid = Number(params.property_id);
  if (!Number.isFinite(pid)) notFound();
  if (pid === NAMKHAN_PROPERTY_ID) redirect('/sales');
  return (
    <HodLanding
      slug="sales"
      propertyId={pid}
      conclusions={{
        insights: [],
        title: 'CONCLUSIONS · sales funnel · inquiries · conversion',
        subtitle: `Donna · property_id=${pid} · awaiting Donna-scoped rule wiring (structure mirrors Namkhan)`,
        emptyText: 'Everything nominal. No sales alarms firing.',
      }}
    />
  );
}
