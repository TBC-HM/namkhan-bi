// app/h/[property_id]/operations/retail/page.tsx
// PBS 2026-07-08: NEW concrete Donna retail page (previously served by the
// [...rest] catchall which uses <Page>, so the dept sub-strip was missing).
// DashboardPage picks up NAV_SUBGROUPS so both operations top strip and
// department sub-strip render. Namkhan (260955) redirects to /operations/retail.

import { redirect } from 'next/navigation';
import { DashboardPage, Container, type DashboardTab } from '@/app/(cockpit)/_design';
import { OPERATIONS_SUBPAGES } from '@/app/operations/_subpages';
import { NAMKHAN_PROPERTY_ID } from '@/lib/dept-cfg/by-property';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default function DonnaRetailPage({ params }: { params: { property_id: string } }) {
  const propertyId = Number(params.property_id);
  if (propertyId === NAMKHAN_PROPERTY_ID) redirect('/operations/retail');

  const tabs: DashboardTab[] = OPERATIONS_SUBPAGES.map((s) => ({
    key: s.href, label: s.label, href: s.href,
    active: s.label === 'Departments',
  }));

  return (
    <DashboardPage title="Operations · Retail" tabs={tabs}>
      <div style={{ gridColumn: '1 / -1' }}>
        <Container title="Retail · awaiting Donna feed" subtitle={`property_id=${propertyId} · Namkhan reference: /operations/retail`}>
          <div style={{ padding: 20, color: '#5A5A5A', fontSize: 13, maxWidth: 720 }}>
            Retail operations surface for Donna Portals is queued. When the
            retail POS feed is wired, this page renders the same canonical
            layout as Namkhan&apos;s /operations/retail (revenue, top items,
            avg ticket, folio ↔ GL reconciliation).
          </div>
        </Container>
      </div>
    </DashboardPage>
  );
}
