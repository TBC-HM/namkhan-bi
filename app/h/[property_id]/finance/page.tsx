// app/h/[property_id]/finance/page.tsx
// PBS #204 (2026-05-25) — property-scoped wrapper delegates to the
// shared HodLanding primitive. Same chrome on Namkhan (260955) and
// Donna (1000001). HodLanding swaps cfg via getDeptCfg(slug, pid).
//
// PBS 2026-07-08 — structural mirror: pass empty conclusions so the
// CONCLUSIONS container renders on Donna URLs at parity with Namkhan
// /finance. Structure not data.
// PBS 2026-08-24 — removed Namkhan redirect; both properties now render
// at /h/{pid}/finance so the sub-strip fires at the property-scoped URL.

import { notFound } from 'next/navigation';
import HodLanding from '@/app/_components/HodLanding';
import { DONNA_PROPERTY_ID } from '@/lib/dept-cfg/by-property';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default function FinanceHoDByProperty({ params }: { params: { property_id: string } }) {
  const pid = Number(params.property_id);
  if (!Number.isFinite(pid)) notFound();
  if (pid === DONNA_PROPERTY_ID) {
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
  return <HodLanding slug="finance" propertyId={pid} />;
}
