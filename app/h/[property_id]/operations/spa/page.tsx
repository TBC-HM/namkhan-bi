// app/h/[property_id]/operations/spa/page.tsx
// PBS 2026-07-08: swapped from legacy <Page> to DashboardPage so both the
// operations top strip AND the department sub-strip render from NAV_SUBGROUPS.
// Namkhan (260955) redirects to its rich /operations/spa page.

import { redirect } from 'next/navigation';
import { DashboardPage, Container, type DashboardTab } from '@/app/(cockpit)/_design';
import { OPERATIONS_SUBPAGES } from '@/app/operations/_subpages';
import { NAMKHAN_PROPERTY_ID } from '@/lib/dept-cfg/by-property';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default function DonnaSpaPage({ params }: { params: { property_id: string } }) {
  const propertyId = Number(params.property_id);
  if (propertyId === NAMKHAN_PROPERTY_ID) redirect('/operations/spa');

  const tabs: DashboardTab[] = OPERATIONS_SUBPAGES.map((s) => ({
    key: s.href, label: s.label, href: s.href,
    active: s.label === 'Departments',
  }));

  return (
    <DashboardPage title="Operations · Spa" tabs={tabs}>
      <div style={{ gridColumn: '1 / -1' }}>
        <Container title="Spa · awaiting Donna feed" subtitle={`property_id=${propertyId} · Namkhan reference: /operations/spa`}>
          <div style={{ padding: 20, color: '#5A5A5A', fontSize: 13, maxWidth: 720 }}>
            Spa operations surface for Donna Portals is queued. When the
            booking data feed is wired (treatment-mix, occupancy, ADR,
            therapist utilisation), this page will render the canonical
            layout matching Namkhan&apos;s /operations/spa.
          </div>
        </Container>
      </div>
    </DashboardPage>
  );
}
