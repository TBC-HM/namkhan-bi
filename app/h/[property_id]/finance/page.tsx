// app/h/[property_id]/finance/page.tsx
// PBS #204 (2026-05-25) — property-scoped wrapper delegates to the
// shared HodLanding primitive. Same chrome on Namkhan (260955) and
// Donna (1000001). HodLanding swaps cfg via getDeptCfg(slug, pid).
//
// PBS 2026-07-08 — structural mirror: pass empty conclusions so the
// CONCLUSIONS container renders on Donna URLs at parity with Namkhan
// /finance. Structure not data.

import { redirect, notFound } from 'next/navigation';
import HodLanding from '@/app/_components/HodLanding';
import { NAMKHAN_PROPERTY_ID } from '@/lib/dept-cfg/by-property';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default function FinanceHoDByProperty({ params }: { params: { property_id: string } }) {
  const pid = Number(params.property_id);
  if (!Number.isFinite(pid)) notFound();
  if (pid === NAMKHAN_PROPERTY_ID) redirect('/finance');
  return (
    <HodLanding
      slug="finance"
      propertyId={pid}
      conclusions={{
        insights: [],
        title: 'CONCLUSIONS · cash · AR · AP · payroll · margin · variance',
        subtitle: `Donna · property_id=${pid} · awaiting Donna-scoped rule wiring (structure mirrors Namkhan)`,
        emptyText: 'Everything nominal. No finance alarms firing.',
      }}
    />
  );
}
