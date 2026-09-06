// app/h/[property_id]/operations/retreats/page.tsx
// Tenant router for the Retreats page.
// Namkhan (260955) → redirect to the legacy unprefixed page (L6).
// All other properties → show "not active" stub (retreats are Namkhan-only for now).

import { redirect } from 'next/navigation';
import { DashboardPage, Container, type DashboardTab } from '@/app/(cockpit)/_design';
import { OPERATIONS_SUBPAGES } from '@/app/operations/_subpages';
import { NAMKHAN_PROPERTY_ID } from '@/lib/dept-cfg/by-property';

export const revalidate = 0;
export const dynamic = 'force-dynamic';

interface Props {
  params: { property_id: string };
}

export default async function RetreatsTenantPage({ params }: Props) {
  const propertyId = Number(params.property_id);

  if (propertyId === NAMKHAN_PROPERTY_ID) {
    redirect('/operations/retreats');
  }

  // Stub for non-Namkhan properties
  const tabs: DashboardTab[] = OPERATIONS_SUBPAGES.map((s) => ({
    key: s.href,
    label: s.label,
    href: s.href,
    active: s.href.includes('/operations/retreats'),
  })) as DashboardTab[];

  return (
    <DashboardPage
      title="Retreats"
      subtitle={`Operations · Departments · Retreats · property_id=${propertyId}`}
      tabs={tabs}
    >
      <Container title="Not available" subtitle="Retreats are not configured for this property." density="compact">
        <div style={{ padding: 24, color: 'var(--tbl-fg-mute)', fontSize: 14 }}>
          Retreat packages are currently active at Namkhan only. No retreat booking channels are configured for property {propertyId}.
        </div>
      </Container>
    </DashboardPage>
  );
}
