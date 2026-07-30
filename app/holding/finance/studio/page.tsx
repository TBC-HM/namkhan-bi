// app/holding/finance/studio/page.tsx
// Spreadsheet Studio — HOLDING surface (brief module-spreadsheet-studio-v1,
// menu placement PBS 2026-07-29: HOLDING Finance → Spreadsheet Studio).
// Holding-scope workbook registry + scratch sheets + user documents.
// The canon Builder stays property-scoped for now (holding-view builder is a
// later slice); property studios are linked below.

import { DashboardPage, Container } from '@/app/(cockpit)/_design';
import TenantLink from '@/components/nav/TenantLink';
import WorkbooksPanel from '@/app/h/[property_id]/finance/studio/_components/WorkbooksPanel';
import ScratchSheet from '@/app/h/[property_id]/finance/studio/_components/ScratchSheet';
import UserDocsPanel from '@/app/h/[property_id]/finance/studio/_components/UserDocsPanel';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default function HoldingStudioPage() {
  return (
    <DashboardPage title="Spreadsheet Studio · Beyond Circle (holding)">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <Container title="Property studios" subtitle="Canon builders over each property's gold views">
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <TenantLink href="/h/260955/finance/studio">The Namkhan → Studio</TenantLink>
            <TenantLink href="/h/1000001/finance/studio">Donna Portals → Studio</TenantLink>
          </div>
        </Container>
        <WorkbooksPanel scope="holding" propertyId={null} />
        <ScratchSheet scope="holding" propertyId={null} />
        <UserDocsPanel level="holding" propertyId={null} />
      </div>
    </DashboardPage>
  );
}
