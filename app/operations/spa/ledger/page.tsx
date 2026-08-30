// app/operations/spa/ledger/page.tsx
// PBS 2026-08-30 · The previous Spa overview, kept whole.
//
// When Overview became the manager cockpit this content did not go anywhere —
// the USALI rollup, the QB GL breakdown, the monthly trend and the raw
// transactions all still live here, for whoever was actually reading them.

import { DashboardPage, type DashboardTab } from '@/app/(cockpit)/_design';
import { OPERATIONS_SUBPAGES } from '@/app/operations/_subpages';
import { NAMKHAN_PROPERTY_ID } from '@/lib/dept-cfg/by-property';
import SpaSubnav from '../_shared/SpaSubnav';
import LegacySpaView from '../_cockpit/LegacySpaView';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default function SpaLedgerPage({ searchParams, propertyId }: {
  searchParams: Record<string, string | string[] | undefined>;
  propertyId?: number;
}) {
  const pid = propertyId ?? NAMKHAN_PROPERTY_ID;
  const tabs: DashboardTab[] = OPERATIONS_SUBPAGES.map((s) => ({
    key: s.href, label: s.label, href: s.href, active: s.href.endsWith('/spa'),
  })) as DashboardTab[];

  return (
    <DashboardPage title="Spa" subtitle="Operations · Spa · ledger view" tabs={tabs}>
      <div style={{ gridColumn: '1 / -1', display: 'flex', flexDirection: 'column', gap: 14 }}>
        <SpaSubnav active="ledger" />
        <LegacySpaView searchParams={searchParams} propertyId={pid} />
      </div>
    </DashboardPage>
  );
}
