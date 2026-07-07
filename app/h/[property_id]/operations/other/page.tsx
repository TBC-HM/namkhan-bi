// app/h/[property_id]/operations/other/page.tsx
// PBS 2026-07-08: NEW concrete Donna other page (previously served by the
// [...rest] catchall which uses <Page>, so the dept sub-strip was missing).
// DashboardPage picks up NAV_SUBGROUPS so both strips render.
// Namkhan (260955) redirects to /operations/other.

import { redirect } from 'next/navigation';
import { DashboardPage, Container, type DashboardTab } from '@/app/(cockpit)/_design';
import { OPERATIONS_SUBPAGES } from '@/app/operations/_subpages';
import { NAMKHAN_PROPERTY_ID } from '@/lib/dept-cfg/by-property';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default function DonnaOtherPage({ params }: { params: { property_id: string } }) {
  const propertyId = Number(params.property_id);
  if (propertyId === NAMKHAN_PROPERTY_ID) redirect('/operations/other');

  const tabs: DashboardTab[] = OPERATIONS_SUBPAGES.map((s) => ({
    key: s.href, label: s.label, href: s.href,
    active: s.label === 'Departments',
  }));

  return (
    <DashboardPage title="Operations · Other" tabs={tabs}>
      <div style={{ gridColumn: '1 / -1' }}>
        <Container title="Other · awaiting Donna feed" subtitle={`property_id=${propertyId} · Namkhan reference: /operations/other`}>
          <div style={{ padding: 20, color: '#5A5A5A', fontSize: 13, maxWidth: 720 }}>
            Other ancillary revenue for Donna Portals is queued. When the
            catch-all revenue feed (vouchers, misc services) is wired, this
            page renders the canonical layout matching Namkhan&apos;s
            /operations/other.
          </div>
        </Container>
      </div>
    </DashboardPage>
  );
}
